import { useEffect, useState } from "react";
import { Download, Plus, X } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const LEGACY_INSTALLED_KEY = "shahezo-pwa-installed-v1";

function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as any).standalone)
  );
}

export default function PWAInstall({ variant = "store" }: { variant?: "store" | "admin" }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(() =>
    typeof window !== "undefined" ? ((window as any).__deferredPwaPrompt ?? null) : null
  );
  const [installed, setInstalled] = useState<boolean>(() => isRunningStandalone());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { localStorage.removeItem(LEGACY_INSTALLED_KEY); } catch {}

    const syncStandalone = () => {
      const standalone = isRunningStandalone();
      setInstalled(standalone);
      if (standalone) {
        setPrompt(null);
      }
    };

    syncStandalone();

    const capture = (event: Event) => {
      event.preventDefault();
      (window as any).__deferredPwaPrompt = event;
      setInstalled(false);
      setDismissed(false);
      setPrompt(event as InstallPrompt);
    };

    const onReady = () => {
      const deferred = (window as any).__deferredPwaPrompt as InstallPrompt | null;
      if (deferred && !isRunningStandalone()) {
        setInstalled(false);
        setDismissed(false);
        setPrompt(deferred);
      }
    };

    const done = () => {
      setInstalled(true);
      setPrompt(null);
      (window as any).__deferredPwaPrompt = null;
    };

    if ((window as any).__deferredPwaPrompt && !isRunningStandalone()) {
      setPrompt((window as any).__deferredPwaPrompt);
    }

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMqChange = () => syncStandalone();

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("pwa-prompt-ready", onReady);
    window.addEventListener("appinstalled", done);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onMqChange);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("pwa-prompt-ready", onReady);
      window.removeEventListener("appinstalled", done);
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", onMqChange);
      }
    };
  }, []);

  const triggerInstall = async () => {
    const activePrompt = prompt || ((window as any).__deferredPwaPrompt as InstallPrompt | null);
    if (!activePrompt) return;
    try {
      await activePrompt.prompt();
      const choice = await activePrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch {} finally {
      setPrompt(null);
      (window as any).__deferredPwaPrompt = null;
    }
  };

  if (installed || !prompt) return null;

  const isAdmin = variant === "admin";
  const title = isAdmin ? "تثبيت تطبيق إدارة شهيزو" : "تثبيت تطبيق شهيزو";
  const subtitle = isAdmin
    ? "لوحة تحكم مستقلة مع رنين فوري للطلبات"
    : "وصول أسرع للطلبات وتنبيهات فورية لحالة طلبك";

  return (
    <>
      {!isAdmin && (
        <button type="button" className="install-app-button" onClick={() => void triggerInstall()}>
          <Download size={14} />
          <span>تثبيت التطبيق</span>
          <Plus size={12} className="install-plus" />
        </button>
      )}

      {!dismissed && (
        <div
          role="dialog"
          aria-label={title}
          style={{
            position: "fixed",
            bottom: isAdmin ? "16px" : "76px",
            left: "12px",
            right: "12px",
            maxWidth: "430px",
            margin: "0 auto",
            zIndex: 9999,
            background: "#ffffff",
            color: "#2b120f",
            border: "1px solid #eadfd4",
            borderRadius: "18px",
            padding: "12px 14px",
            boxShadow: "0 14px 36px rgba(43, 18, 15, 0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            direction: "rtl",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <img
              src="/app-icon-192-v8.png"
              alt={title}
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                flexShrink: 0,
                background: "#ffffff",
                border: "1px solid #f0e6dc",
                objectFit: "cover",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: "13px", fontWeight: 900, color: "#870210", lineHeight: 1.3 }}>
                {title}
              </strong>
              <small style={{ display: "block", fontSize: "10.5px", color: "#6c554d", lineHeight: 1.35, marginTop: "2px" }}>
                {subtitle}
              </small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => void triggerInstall()}
              style={{
                background: "#870210",
                color: "#ffffff",
                border: "none",
                borderRadius: "11px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              تثبيت
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="إغلاق"
              style={{
                background: "#f6efe8",
                color: "#6c554d",
                border: "none",
                borderRadius: "9px",
                width: "30px",
                height: "30px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
