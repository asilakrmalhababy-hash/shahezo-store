import { useEffect, useState } from "react";
import { Download, Plus, X } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "shahezo-pwa-installed-v1";
const DISMISS_KEY = "shahezo-pwa-banner-dismissed-v1";

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(() => (window as any).__deferredPwaPrompt ?? null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as any).standalone) ||
      localStorage.getItem(INSTALLED_KEY) === "1"
    );
  });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as any).standalone) ||
      localStorage.getItem(INSTALLED_KEY) === "1";

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const capture = (event: Event) => {
      event.preventDefault();
      try { localStorage.removeItem(INSTALLED_KEY); } catch {}
      (window as any).__deferredPwaPrompt = event;
      setPrompt(event as InstallPrompt);
      setInstalled(false);
    };

    const done = () => {
      try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
      setInstalled(true);
      setPrompt(null);
      (window as any).__deferredPwaPrompt = null;
    };

    if ((window as any).__deferredPwaPrompt) {
      setPrompt((window as any).__deferredPwaPrompt);
    }

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    window.addEventListener("pwa-prompt-ready", () => {
      if ((window as any).__deferredPwaPrompt) {
        setPrompt((window as any).__deferredPwaPrompt);
      }
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const triggerInstall = async () => {
    const activePrompt = prompt || ((window as any).__deferredPwaPrompt as InstallPrompt | null);
    if (!activePrompt) return;
    try {
      await activePrompt.prompt();
      const choice = await activePrompt.userChoice;
      if (choice.outcome === "accepted") {
        try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
        setInstalled(true);
        setPrompt(null);
        (window as any).__deferredPwaPrompt = null;
      }
    } catch {}
  };

  const dismissBanner = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

  if (installed || !prompt) return null;

  return (
    <>
      <button type="button" className="install-app-button" onClick={() => void triggerInstall()}>
        <Download size={14} />
        <span>تثبيت تطبيق شهيزو</span>
        <Plus size={12} className="install-plus" />
      </button>

      {!dismissed && (
        <div
          role="region"
          aria-label="تثبيت تطبيق شهيزو"
          style={{
            position: "fixed",
            bottom: "74px",
            left: "12px",
            right: "12px",
            maxWidth: "460px",
            margin: "0 auto",
            zIndex: 9999,
            background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)",
            color: "#ffffff",
            borderRadius: "16px",
            padding: "12px 14px",
            boxShadow: "0 12px 32px rgba(135, 2, 16, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            direction: "rtl",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <img
              src="/app-icon-192-v4.png"
              alt="شهيزو"
              style={{ width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0, background: "#fff", objectFit: "cover" }}
            />
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: "12.5px", lineHeight: 1.3 }}>
                تثبيت تطبيق «شهيزو – SHAHEZO» 🥙
              </strong>
              <small style={{ display: "block", fontSize: "10px", color: "#fde3cf", lineHeight: 1.35 }}>
                اطلب شاورما وفلافل وعصائر بسرعة مع إشعارات حالة الطلب
              </small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => void triggerInstall()}
              style={{
                background: "#e86c12",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "7px 14px",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 3px 10px rgba(0,0,0,0.2)",
              }}
            >
              تثبيت الآن
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="إغلاق"
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                width: "28px",
                height: "28px",
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
