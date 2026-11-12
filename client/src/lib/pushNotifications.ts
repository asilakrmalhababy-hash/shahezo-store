export type PushPermissionState = NotificationPermission | "unsupported";

export type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}

function decodeApplicationServerKey(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeApplicationServerKey(value: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function ensureBrowserPushSubscription(publicKey: string): Promise<BrowserPushSubscription> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("متصفحك لا يدعم إشعارات Push لهذا التطبيق.");
  }
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = decodeApplicationServerKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription?.options.applicationServerKey) {
    const currentKey = encodeApplicationServerKey(subscription.options.applicationServerKey as ArrayBuffer);
    if (currentKey !== publicKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });
  }
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error("تعذر تجهيز اشتراك إشعارات المتصفح.");
  }
  return {
    endpoint: value.endpoint,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  };
}

export async function getExistingBrowserPushSubscription(): Promise<BrowserPushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  const value = subscription?.toJSON();
  if (!value?.endpoint || !value.keys?.p256dh || !value.keys.auth) return null;
  return { endpoint: value.endpoint, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}
