import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import webpush, { type PushSubscription } from 'web-push';
const sendNotification = (webpush as any).sendNotification || (webpush as any).default?.sendNotification;
const setVapidDetails = (webpush as any).setVapidDetails || (webpush as any).default?.setVapidDetails;
import { ENV } from "./env";

export type ProtectedPushSubscription = {
  endpointHash: string;
  encryptedPayload: string;
};

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

let cachedKeys: { publicKey: string; privateKey: string } | undefined;
let vapidConfigured = false;

function deriveSecret(salt: string, info: string): Buffer {
  const secret = ENV.cookieSecret || "shahezo-store-default-jwt-secret-key-2026";
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"),
    Buffer.from(salt, "utf8"),
    Buffer.from(info, "utf8"),
    32,
  ));
}

function getVapidKeys() {
  if (cachedKeys) return cachedKeys;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const privateBytes = deriveSecret("shahezo-web-push-v1", `vapid-p256-${attempt}`);
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(privateBytes);
      cachedKeys = {
        publicKey: ecdh.getPublicKey(undefined, "uncompressed").toString("base64url"),
        privateKey: privateBytes.toString("base64url"),
      };
      return cachedKeys;
    } catch {
      // An HKDF output outside the P-256 scalar range is discarded and re-derived.
    }
  }
  throw new Error("Web Push signing is unavailable");
}

export function getWebPushPublicKey() {
  return getVapidKeys().publicKey;
}

function configureVapid() {
  if (vapidConfigured) return;
  const keys = getVapidKeys();
  setVapidDetails("mailto:admin@shahezo-store.com", keys.publicKey, keys.privateKey);
  vapidConfigured = true;
}

export function isAllowedPushEndpoint(value: string) {
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:";
  } catch {
    return false;
  }
}

export function protectPushSubscription(subscription: PushSubscription): ProtectedPushSubscription {
  if (!isAllowedPushEndpoint(subscription.endpoint)) throw new Error("Unsupported push endpoint");
  const endpointHash = createHash("sha256").update(subscription.endpoint).digest("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveSecret("shahezo-web-push-v1", "subscription-encryption"), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.keys }), "utf8"),
    cipher.final(),
  ]);
  const encryptedPayload = `v1.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
  return { endpointHash, encryptedPayload };
}

export function unprotectPushSubscription(encryptedPayload: string): PushSubscription {
  if (!encryptedPayload.startsWith("v1.")) throw new Error("Unsupported stored push subscription");
  const packed = Buffer.from(encryptedPayload.slice(3), "base64url");
  if (packed.length < 29) throw new Error("Invalid stored push subscription");
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveSecret("shahezo-web-push-v1", "subscription-encryption"), iv);
  decipher.setAuthTag(authTag);
  const decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const subscription = JSON.parse(decoded) as PushSubscription;
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth || !isAllowedPushEndpoint(subscription.endpoint)) {
    throw new Error("Invalid stored push subscription");
  }
  return subscription;
}

export async function sendWebPush(subscription: PushSubscription, message: PushMessage) {
  configureVapid();
  const rawTopic = (message.tag || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return sendNotification(subscription, JSON.stringify(message), {
    TTL: 60 * 60 * 24,
    urgency: "high",
    ...(rawTopic ? { topic: rawTopic } : {}),
  });
}
