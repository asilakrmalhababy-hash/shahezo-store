import { trpc } from "@/lib/trpc";
import { COOKIE_NAME } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import "./theme-tokens.css";
import "./pwa.css";

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    (window as any).__deferredPwaPrompt = event;
    window.dispatchEvent(new Event("pwa-prompt-ready"));
  });

  // Global Kiosk / Native App Protection:
  // Disable long-press context menu (save image / copy text) & pinch/ctrl zoom, while keeping vertical pull-to-refresh
  const isEditableTarget = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable || Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
  };

  window.addEventListener("contextmenu", e => {
    if (!isEditableTarget(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("dragstart", e => {
    e.preventDefault();
  }, { passive: false });

  window.addEventListener("copy", e => {
    if (!isEditableTarget(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent multi-touch pinch zoom
  window.addEventListener("touchmove", e => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent iOS Safari gesture zoom
  window.addEventListener("gesturestart", e => e.preventDefault(), { passive: false });
  window.addEventListener("gesturechange", e => e.preventDefault(), { passive: false });
  window.addEventListener("gestureend", e => e.preventDefault(), { passive: false });

  // Prevent double-tap to zoom
  let lastTouchEnd = 0;
  window.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 280 && (!e.touches || e.touches.length === 0)) {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Prevent Ctrl/Cmd + Wheel or +/- zoom
  window.addEventListener("wheel", e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")) {
      e.preventDefault();
    }
  }, { passive: false });

}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(error => {
      console.warn("[PWA] Service worker registration unavailable", error instanceof Error ? error.message : "unknown error");
    });
  });
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, gcTime: 300_000, refetchOnWindowFocus: false, retry: 1 } } });

function isOwnerAdminRoute() {
  return /^\/admin(?:\/|$)/i.test(window.location.pathname);
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        if (!isOwnerAdminRoute()) return {};
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: isOwnerAdminRoute() ? "include" : "omit",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
