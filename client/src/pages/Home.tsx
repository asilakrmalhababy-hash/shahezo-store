
const INSTANT_CATALOG_KEY = "shahezo-instant-catalog-v1";
const IDB_NAME = "shahezo-offline-db";
const IDB_STORE = "kv";

function saveOfflineCatalogIdb(data: HomeData) {
  try {
    if (typeof indexedDB === "undefined") return;
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(data, INSTANT_CATALOG_KEY);
      } catch {}
    };
  } catch {}
}

function loadOfflineCatalogIdb(): Promise<HomeData | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(IDB_STORE, "readonly");
          const getReq = tx.objectStore(IDB_STORE).get(INSTANT_CATALOG_KEY);
          getReq.onsuccess = () => {
            const val = getReq.result;
            resolve(val && Array.isArray(val.products) ? val : null);
          };
          getReq.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

function getInstantLocalCatalog(): HomeData {
  try {
    const raw = localStorage.getItem(INSTANT_CATALOG_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.products)) return p;
    }
  } catch {}
  return { categories: [], products: [], banners: [], offers: [], settings: {} };
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  return online;
}

function SmartImage({
  src,
  alt,
  className,
  style,
  loading,
  decoding,
  fetchPriority,
  draggable,
  compact = false,
  minPlaceholderHeight,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  compact?: boolean;
  minPlaceholderHeight?: string;
}) {
  const isOnline = useOnlineStatus();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src, isOnline]);

  if (!src || failed) {
    if (compact) {
      return (
        <div
          className={className}
          style={{
            ...style,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f1ef",
            overflow: "hidden",
          }}
        >
          <img
            src="/chef-hat.png"
            alt="شهيزو"
            style={{ width: "62%", height: "62%", objectFit: "contain", filter: "grayscale(100%) opacity(0.32)" }}
          />
        </div>
      );
    }
    return (
      <div
        className={className}
        style={{
          ...style,
          minHeight: minPlaceholderHeight || style?.minHeight || "100%",
          width: "100%",
          height: style?.height && style.height !== "auto" ? style.height : "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "12px",
          background: "#f4f2f0",
          color: "#9ca3af",
          textAlign: "center",
        }}
      >
        <img
          src="/chef-hat.png"
          alt="شهيزو"
          style={{ width: "42px", height: "42px", objectFit: "contain", filter: "grayscale(100%) opacity(0.32)" }}
        />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", lineHeight: 1.3 }}>
          {!isOnline ? "لا يوجد لديك إنترنت" : "تعذر تحميل الصورة"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowDownWideNarrow, ArrowLeft, ArrowUpDown, BadgePercent, BellRing, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Copy,
  Heart, Home as HomeIcon, Leaf, LoaderCircle, MapPin, Menu, MessageCircle, Minus, Package,
  Plus, Search, ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Trash2, Truck, UserRound,
  X, Bot, Clock3, ShieldCheck, CheckCircle2, Flame, UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useStore, type CartLine } from "@/contexts/StoreContext";
import { cleanYemeniPhone, clearPendingOrderIdempotencyKey, getPendingOrderIdempotencyKey, isValidYemeniPhone, useCustomer } from "@/contexts/CustomerContext";
import PWAInstall from "@/components/PWAInstall";
import { buildMissingIngredientNote } from "@/lib/assistant-note";
import { ensureBrowserPushSubscription, getExistingBrowserPushSubscription, getPushPermissionState, requestPushPermission } from "@/lib/pushNotifications";

const formatPrice = (amount: number) => `${Math.max(0, amount).toLocaleString("en-US")} ر.ي`;
const stateLabels: Record<string, string> = { new: "جديد", preparing: "قيد التجهيز", ready: "جاهز للتوصيل", out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", cancelled: "ملغي" };

function useDebouncedValue<T>(value: T, delay = 220) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return debounced;
}

type PublicProduct = { id: number; name: string; slug: string; description: string | null; imageUrl: string | null; categoryId: number | null; price: number; unit: string; stock: number | null; minQuantity: number; quantityStep: number; isPublished: boolean; isAvailable: boolean; sortOrder: number; createdAt: Date; updatedAt: Date };

type HomeData = { categories: Array<{ id: number; name: string; description: string | null; imageUrl: string | null; color: string; slug: string }>; products: PublicProduct[]; banners: Array<{ id: number; title: string; body: string | null; imageUrl: string | null; actionText: string | null; actionUrl: string | null }>; offers: Array<{ id: number; title: string; description: string | null; code: string; discountType: string; discountValue: number }>; settings: Record<string, string> };

function Header({ data, onSearch }: { data?: HomeData; onSearch: (text: string) => void }) {
  const { cart } = useStore();
  const { name } = useCustomer();
  const [text, setText] = useState("");
  const cartCount = cart.reduce((sum, row) => sum + row.quantity, 0);
  const rawName = data?.settings.storeName || "شهيزو – SHAHEZO";
  const storeName = /أورجنال|أوريجنال|ORIGINAL/i.test(rawName) ? "شهيزو – SHAHEZO" : rawName;
  const brandSubtitle = "شهي ولذيذ · شاورما • فلافل • عصائر";
  const submitSearch = (event: FormEvent) => { event.preventDefault(); onSearch(text.trim()); };
  return <header className="store-header">
    <div className="header-main">
      <Link href="/" className="brand-lockup" aria-label={`${storeName} الرئيسية`}>
        <span className="brand-mark has-brand-image"><img src="/chef-hat.png" alt="شهيزو" /></span>
        <span className="brand-type"><strong style={{ letterSpacing: "0.02em", fontFamily: "inherit", fontSize: "15px" }}>شهيزو · SHAHEZO</strong><small>{brandSubtitle}</small></span>
      </Link>
      <form className="header-search" onSubmit={submitSearch}>
        <Search size={18} /><input value={text} onChange={event => setText(event.target.value)} placeholder="ابحث عن شاورما، فلافل، عصائر، وجبات..." aria-label="البحث عن المنتجات" />
        {text && <button type="button" className="search-clear" onClick={() => { setText(""); onSearch(""); }} aria-label="مسح البحث"><X size={14} /></button>}
      </form>
      <div className="header-actions">
        <Link href="/favorites" className="header-action mobile-header-shortcut" aria-label="المفضلة" title="المفضلة"><Heart size={19} /><span>المفضلة</span></Link>
        <Link href="/orders" className="header-action mobile-header-shortcut" aria-label="طلباتي" title="طلباتي"><Package size={19} /><span>طلباتي</span></Link>
        <Link href="/cart" className="header-cart"><ShoppingCart size={19} /><span>السلة</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
        <Link href="/account" className="account-chip"><CircleUserRound size={19} /><span>{name.trim().split(/\s+/)[0] || "حسابي"}</span></Link>
      </div>
    </div>
    <div className="header-subline">
      <nav className="desktop-links" aria-label="القائمة الرئيسية"><Link href="/">الرئيسية</Link><Link href="/categories">الأقسام</Link><Link href="/products">المنتجات</Link><Link href="/assistant" className="assistant-link"><Sparkles size={15} /> مساعد شهيزو</Link></nav>
      <div className="header-promise"><ShieldCheck size={15} /><span></span></div><PWAInstall />
    </div>
    {(() => { const paused = data?.settings.orderPaused === "true"; const wh = getPublicWorkingHoursStatus((data?.settings as any)?.workingHoursConfig); if (!paused && wh.isOpen) return null; return <div className="service-notice"><Clock3 size={15} />{paused ? (data?.settings.pausedMessage || "استقبال الطلبات متوقف مؤقتًا بسبب الذروة") : wh.message}</div>; })()}
  </header>;
}

// === SHAHEZO_WA_BAR_START ===
function ShahezoWhatsAppBar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setOpen(false);
    const onToggle = () => setOpen(prev => !prev);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("toggle-shahezo-wa", onToggle);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("toggle-shahezo-wa", onToggle);
    };
  }, []);
  if (location.startsWith("/account") || location.startsWith("/cart") || location.startsWith("/assistant")) {
    return null;
  }
  return (
    <div className="shahezo-wa-widget" aria-label="تواصل مباشر مع بوفية شهيزو">
      <button
        type="button"
        className={`shahezo-wa-fab ${open ? "is-open" : ""}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label="تواصل واتساب مع بوفية شهيزو"
        title="تواصل معنا عبر واتساب"
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M16.01 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.59 4.46 1.71 6.4L3.1 28.9l6.67-1.75a12.75 12.75 0 0 0 6.24 1.63h.01c7.06 0 12.8-5.73 12.8-12.8 0-3.42-1.33-6.64-3.75-9.05A12.72 12.72 0 0 0 16.01 3.2zm0 23.42h-.01a10.6 10.6 0 0 1-5.41-1.48l-.39-.23-3.96 1.04 1.06-3.86-.25-.4a10.58 10.58 0 0 1-1.63-5.67c0-5.85 4.76-10.62 10.61-10.62 2.83 0 5.49 1.1 7.5 3.11a10.54 10.54 0 0 1 3.1 7.52c0 5.85-4.76 10.61-10.62 10.61zm5.82-7.95c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.15 3.09 1.31 3.3.16.21 2.26 3.45 5.48 4.84.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37z" />
        </svg>
      </button>
      <div className={`shahezo-wa-strip ${open ? "is-open" : "is-closed"}`}>
        <div className="shahezo-wa-strip-head">
          <strong>🥙 تواصل مباشر · بوفية شهيزو</strong>
          <button type="button" className="shahezo-wa-close" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
        </div>
        <div className="shahezo-wa-row">
          <div className="shahezo-wa-label">
            <span>للطلب والاستفسار</span>
            <b dir="ltr">779 542 219</b>
          </div>
          <div className="shahezo-wa-actions">
            <a className="shahezo-wa-btn" href="https://wa.me/967779542219?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D8%A8%D9%88%D9%81%D9%8A%D8%A9%20%D8%B4%D9%87%D9%8A%D8%B2%D9%88%20%F0%9F%A5%99%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8%20%D8%A3%D9%88%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1" target="_blank" rel="noreferrer">واتساب</a>
            <a className="shahezo-call-btn" href="tel:779542219">اتصال</a>
          </div>
        </div>
        <div className="shahezo-wa-row">
          <div className="shahezo-wa-label">
            <span>خدمة العملاء</span>
            <b dir="ltr">772 206 455</b>
          </div>
          <div className="shahezo-wa-actions">
            <a className="shahezo-wa-btn" href="https://wa.me/967772206455?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D8%AE%D8%AF%D9%85%D8%A9%20%D8%B9%D9%85%D9%84%D8%A7%D8%A1%20%D8%A8%D9%88%D9%81%D9%8A%D8%A9%20%D8%B4%D9%87%D9%8A%D8%B2%D9%88%20%F0%9F%A5%99" target="_blank" rel="noreferrer">واتساب</a>
            <a className="shahezo-call-btn" href="tel:772206455">اتصال</a>
          </div>
        </div>
      </div>
    </div>
  );
}
// === SHAHEZO_WA_BAR_END ===

function BottomNav({ active }: { active: string }) {
  const links = [
    { href: "/", label: "الرئيسية", icon: HomeIcon },
    { href: "/categories", label: "الأقسام", icon: SlidersHorizontal },
    { href: "/assistant", label: "المساعد", icon: Sparkles, standout: true },
    { href: "/products", label: "المنتجات", icon: ShoppingBag },
    { href: "/account", label: "حسابي", icon: UserRound },
  ];
  return <nav className="bottom-nav" aria-label="التنقل"><div className="bottom-nav-inner">{links.map(item => {
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} className={`bottom-nav-link ${active === item.href ? "is-active" : ""} ${item.standout ? "nav-assistant" : ""}`}><span className="bottom-icon"><Icon size={item.standout ? 21 : 19} /></span><small>{item.label}</small></Link>;
  })}</div></nav>;
}

function EmptyState({ icon: Icon = Package, title, description, action, href }: { icon?: typeof Package; title: string; description: string; action?: string; href?: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={25} strokeWidth={1.6} /></span><h3>{title}</h3><p>{description}</p>{action && href && <Link href={href} className="button button-primary">{action}<ArrowLeft size={16} /></Link>}</div>;
}

type BannerConfig = {
  placement: "top" | "middle" | "bottom" | "popup";
  size: "auto" | "small" | "medium" | "large";
  clickMode: "full" | "hotspot" | "none";
  hx: number;
  hy: number;
  hw: number;
  hh: number;
  shade: boolean;
  showTitle: boolean;
  showBtn: boolean;
  popupOnce: boolean;
  startsAt?: string;
  endsAt?: string;
};

const defaultBannerCfg: BannerConfig = {
  placement: "top",
  size: "auto",
  clickMode: "full",
  hx: 8,
  hy: 44,
  hw: 34,
  hh: 24,
  shade: false,
  showTitle: false,
  showBtn: false,
  popupOnce: true,
};


function getPublicWorkingHoursStatus(raw?: string | null): { isOpen: boolean; message: string } {
  try {
    if (!raw) return { isOpen: true, message: "" };
    const cfg = JSON.parse(raw);
    if (!cfg || !cfg.enabled) return { isOpen: true, message: "" };
    const openStr = String(cfg.openTime || "07:00").trim();
    const closeStr = String(cfg.closeTime || "23:30").trim();
    const [oh, om] = openStr.split(":").map(Number);
    const [ch, cm] = closeStr.split(":").map(Number);
    if (!Number.isFinite(oh) || !Number.isFinite(om) || !Number.isFinite(ch) || !Number.isFinite(cm)) return { isOpen: true, message: "" };
    const nowYemen = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const curMin = nowYemen.getUTCHours() * 60 + nowYemen.getUTCMinutes();
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    const isOpen = openMin <= closeMin ? (curMin >= openMin && curMin < closeMin) : (curMin >= openMin || curMin < closeMin);
    const defaultMsg = `نعتذر، بوفية شهيزو مغلق حالياً. مواعيد العمل يومياً من ${openStr} إلى ${closeStr}`;
    return { isOpen, message: String(cfg.closedMessage || "").trim() || defaultMsg };
  } catch {
    return { isOpen: true, message: "" };
  }
}


function isBannerWithinSchedule(rawActionUrl?: string | null): boolean {
  const { cfg } = parseBannerMeta(rawActionUrl);
  const now = Date.now();
  if (cfg.startsAt) {
    const s = new Date(cfg.startsAt).getTime();
    if (Number.isFinite(s) && now < s) return false;
  }
  if (cfg.endsAt) {
    const e = new Date(cfg.endsAt).getTime();
    if (Number.isFinite(e) && now > e) return false;
  }
  return true;
}

function parseBannerMeta(rawActionUrl?: string | null): { targetUrl: string; cfg: BannerConfig } {
  const raw = String(rawActionUrl || "").trim();
  const marker = "#bcfg=";
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    return { targetUrl: raw, cfg: { ...defaultBannerCfg, clickMode: raw ? "full" : "none" } };
  }
  const targetUrl = raw.slice(0, idx).trim();
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(idx + marker.length)));
    return {
      targetUrl,
      cfg: {
        placement: ["top", "middle", "bottom", "popup"].includes(parsed.placement) ? parsed.placement : "top",
        size: ["auto", "small", "medium", "large"].includes(parsed.size) ? parsed.size : "auto",
        clickMode: ["full", "hotspot", "none"].includes(parsed.clickMode) ? parsed.clickMode : (targetUrl ? "full" : "none"),
        hx: typeof parsed.hx === "number" ? Math.max(0, Math.min(95, parsed.hx)) : 8,
        hy: typeof parsed.hy === "number" ? Math.max(0, Math.min(95, parsed.hy)) : 44,
        hw: typeof parsed.hw === "number" ? Math.max(5, Math.min(100, parsed.hw)) : 34,
        hh: typeof parsed.hh === "number" ? Math.max(5, Math.min(100, parsed.hh)) : 24,
        shade: Boolean(parsed.shade),
        showTitle: Boolean(parsed.showTitle),
        showBtn: Boolean(parsed.showBtn),
        popupOnce: parsed.popupOnce !== false,
        startsAt: typeof parsed.startsAt === "string" ? parsed.startsAt : "",
        endsAt: typeof parsed.endsAt === "string" ? parsed.endsAt : "",
      },
    };
  } catch {
    return { targetUrl, cfg: { ...defaultBannerCfg, clickMode: targetUrl ? "full" : "none" } };
  }
}

function BannerCarousel({ banners }: { banners: HomeData["banners"] }) {
  const [, navigate] = useLocation();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % banners.length), 5200);
    return () => window.clearInterval(timer);
  }, [banners.length]);
  if (!banners.length) return null;
  const banner = banners[index % banners.length];
  if (!banner?.imageUrl) return null;
  const { targetUrl, cfg } = parseBannerMeta(banner.actionUrl);

  const goTarget = () => {
    if (!targetUrl) return;
    if (targetUrl.startsWith("/")) navigate(targetUrl);
    else window.location.href = targetUrl;
  };

  const sizeHeights: Record<BannerConfig["size"], string | undefined> = {
    auto: undefined,
    small: "clamp(115px, 18vw, 180px)",
    medium: "clamp(175px, 25vw, 275px)",
    large: "clamp(235px, 34vw, 380px)",
  };
  const isAutoSize = cfg.size === "auto";
  const isFullClick = Boolean(targetUrl && cfg.clickMode === "full");
  const isHotspotClick = Boolean(targetUrl && cfg.clickMode === "hotspot");

  return (
    <section
      className="banner-frame"
      aria-label="إعلانات المتجر"
      onClick={isFullClick ? goTarget : undefined}
      onTouchStart={e => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={e => {
        if (touchStartX.current === null || banners.length < 2) return;
        const diff = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(diff) > 40) {
          setIndex(v => diff > 0 ? (v + 1) % banners.length : (v - 1 + banners.length) % banners.length);
        }
      }}
      style={{
        position: "relative",
        height: isAutoSize ? "auto" : sizeHeights[cfg.size],
        minHeight: isAutoSize ? 0 : sizeHeights[cfg.size],
        borderRadius: "20px",
        overflow: "hidden",
        margin: "6px 0 24px",
        background: "transparent",
        cursor: isFullClick ? "pointer" : "default",
        boxShadow: "0 10px 26px rgba(94, 1, 11, 0.08)",
      }}
    >
      <SmartImage
        src={banner.imageUrl}
        alt={banner.title || "إعلان المتجر"}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        minPlaceholderHeight="135px"
        style={isAutoSize ? {
          position: "relative",
          width: "100%",
          height: "auto",
          display: "block",
          objectFit: "contain",
          zIndex: 1,
        } : {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 1,
        }}
      />
      {cfg.shade && <div className="banner-shade" style={{ zIndex: 2 }} />}
      {(cfg.showTitle || (cfg.showBtn && banner.actionText && targetUrl)) && (
        <div className="banner-copy" style={{ zIndex: 3 }}>
          {cfg.showTitle && banner.title && <h2>{banner.title}</h2>}
          {cfg.showTitle && banner.body && <p>{banner.body}</p>}
          {cfg.showBtn && banner.actionText && targetUrl && (
            <button type="button" onClick={e => { e.stopPropagation(); goTarget(); }} className="button button-light">
              {banner.actionText}<ArrowLeft size={16} />
            </button>
          )}
        </div>
      )}
      {isHotspotClick && (
        <button
          type="button"
          aria-label={banner.actionText || banner.title || "انتقال للعرض"}
          onClick={e => { e.stopPropagation(); goTarget(); }}
          style={{
            position: "absolute",
            left: cfg.hx + "%",
            top: cfg.hy + "%",
            width: cfg.hw + "%",
            height: cfg.hh + "%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            zIndex: 5,
            padding: 0,
          }}
        />
      )}
      {banners.length > 1 && (
        <div className="banner-dots" style={{ zIndex: 6 }}>
          {banners.map((item, dot) => (
            <button key={item.id} type="button" className={dot === index ? "active" : ""} aria-label={"الإعلان " + (dot + 1)} onClick={e => { e.stopPropagation(); setIndex(dot); }} />
          ))}
        </div>
      )}
    </section>
  );
}

function PromoPopupModal({ banners }: { banners: HomeData["banners"] }) {
  const [, navigate] = useLocation();
  const [openBanner, setOpenBanner] = useState<HomeData["banners"][number] | null>(null);

  useEffect(() => {
    if (!banners.length) return;
    const candidate = banners[0];
    if (!candidate?.imageUrl) return;
    const { cfg } = parseBannerMeta(candidate.actionUrl);
    const storageKey = "shahezo-popup-seen-" + candidate.id;
    if (cfg.popupOnce) {
      try {
        if (sessionStorage.getItem(storageKey) === "1") return;
      } catch {}
    }
    setOpenBanner(candidate);
  }, [banners]);

  if (!openBanner || !openBanner.imageUrl) return null;
  const { targetUrl, cfg } = parseBannerMeta(openBanner.actionUrl);

  const closePopup = () => {
    try { sessionStorage.setItem("shahezo-popup-seen-" + openBanner.id, "1"); } catch {}
    setOpenBanner(null);
  };

  const goTarget = () => {
    closePopup();
    if (!targetUrl) return;
    if (targetUrl.startsWith("/")) navigate(targetUrl);
    else window.location.href = targetUrl;
  };

  const isFullClick = Boolean(targetUrl && cfg.clickMode === "full");
  const isHotspotClick = Boolean(targetUrl && cfg.clickMode === "hotspot");

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={closePopup}
      style={{ zIndex: 120, background: "rgba(8, 22, 15, 0.72)", padding: "18px" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(460px, 94vw)",
          borderRadius: "22px",
          overflow: "hidden",
          background: "transparent",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <button
          type="button"
          onClick={closePopup}
          aria-label="إغلاق الإعلان"
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: "none",
            background: "rgba(15, 38, 26, 0.82)",
            color: "#ffffff",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <X size={18} />
        </button>
        <div
          onClick={isFullClick ? goTarget : undefined}
          style={{ position: "relative", cursor: isFullClick ? "pointer" : "default", lineHeight: 0 }}
        >
          <img
            src={openBanner.imageUrl}
            alt={openBanner.title || "عرض خاص"}
            style={{ width: "100%", height: "auto", maxHeight: "82vh", objectFit: "contain", display: "block", borderRadius: "22px" }}
          />
          {isHotspotClick && (
            <button
              type="button"
              aria-label="انتقال للعرض"
              onClick={e => { e.stopPropagation(); goTarget(); }}
              style={{
                position: "absolute",
                left: cfg.hx + "%",
                top: cfg.hy + "%",
                width: cfg.hw + "%",
                height: cfg.hh + "%",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                zIndex: 5,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}


function parseAssistantMessageAndSuggestions(rawText?: string) {
  const text = rawText || "";
  const match = text.match(/\[\[SUGGESTIONS:([^\]]+)\]\]/);
  const cleanText = text.replace(/\s*\[\[SUGGESTIONS:[^\]]+\]\]/g, "").trim();
  const suggestions = match
    ? match[1].split("|").map(s => s.trim()).filter(Boolean)
    : [];
  return { cleanText, suggestions };
}

function AiThinkingStatus() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", color: "#64748b", fontSize: "11.5px", fontWeight: 500 }} aria-live="polite">
      <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#870210", animation: "pulse 1.2s infinite" }} />
      <span>جاري التفكير...</span>
    </div>
  );
}

function splitCleanReplyAndChips(rawText: string, fallbackChips?: string[]) {
  const raw = String(rawText || "");
  const rawList: string[] = [];
  const match = raw.match(/\[\[SUGGESTIONS:([\s\S]*?)\]\]/i);
  if (match) {
    rawList.push(...match[1].split("|"));
  } else if (Array.isArray(fallbackChips) && fallbackChips.length > 0) {
    rawList.push(...fallbackChips);
  }
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const item of rawList) {
    const c = String(item || "").replace(/^[\s"'•✨*-]+|[\s"']+$/g, "").trim();
    if (c && c.length >= 2 && !seen.has(c)) {
      seen.add(c);
      chips.push(c);
    }
    if (chips.length >= 3) break;
  }
  const cleanText = raw.replace(/\[\[SUGGESTIONS:[\s\S]*?\]\]/gi, "").trim();
  return { cleanText, chips };
}

const tinyChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "auto",
  minHeight: "22px",
  padding: "2px 8px",
  borderRadius: "6px",
  background: "#f1f5f2",
  border: "1px solid #d5e2d8",
  color: "#870210",
  fontSize: "10.5px",
  fontWeight: 600,
  lineHeight: 1.3,
  cursor: "pointer"
};

function AiRecipeModal({ product, onClose }: { product: PublicProduct; onClose: () => void }) {
  const { add, cart, setQuantity } = useStore();
  const [, navigate] = useLocation();
  const [customInput, setCustomInput] = useState("");
  const [modalHistory, setModalHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const recipeMutation = trpc.commerce.assistant.recipe.useMutation();

  const sendProductQuery = (userQuestion = "") => {
    const trimmed = userQuestion.trim();
    const requestPayload = trimmed
      ? "[سياق_منتج:" + product.name + "] " + trimmed
      : "[تحليل_منتج] «" + product.name + "»";
    const nextHist = trimmed ? [...modalHistory, { role: "user" as const, text: trimmed }] : modalHistory;
    if (trimmed) setModalHistory(nextHist);

    recipeMutation.mutate(
      {
        request: requestPayload,
        history: nextHist.slice(-8),
        cart: cart.map(line => ({ productId: line.id, quantity: line.quantity })),
      },
      {
        onSuccess: res => {
          const parsed = splitCleanReplyAndChips(res.message, (res as any).suggestedQuestions);
          setModalHistory(prev => [...prev, { role: "assistant", text: parsed.cleanText }]);
          if (res.cartAction && Array.isArray(res.cartAction.items) && res.cartAction.items.length > 0) {
            for (const item of res.cartAction.items) {
              if (res.cartAction.type === "add") {
                add({ id: item.productId, name: item.name, price: item.price, unit: item.unit, stock: item.stock, minQuantity: item.minQuantity, quantityStep: item.quantityStep }, item.quantity);
              } else {
                const cur = cart.find(c => c.id === item.productId);
                if (cur) setQuantity(item.productId, Math.max(0, cur.quantity - item.quantity));
              }
            }
            toast.success(res.cartAction.type === "add" ? "تمت الإضافة للسلة 🛒" : "تم تحديث السلة");
          }
        }
      }
    );
  };

  useEffect(() => {
    setModalHistory([]);
    sendProductQuery("");
  }, [product.id]);

  const data = recipeMutation.data;
  const isPending = recipeMutation.isPending;
  const parsed = data ? splitCleanReplyAndChips(data.message, (data as any).suggestedQuestions) : { cleanText: "", chips: [] };

  const continueInAssistantChat = () => {
    try {
      const existingRaw = localStorage.getItem("shahezo-assistant-history-v1");
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const historyArr = Array.isArray(existing) ? existing : [];
      const nextHistory = [...historyArr, ...modalHistory].slice(-24);
      localStorage.setItem("shahezo-assistant-history-v1", JSON.stringify(nextHistory));
    } catch {}
    onClose();
    navigate("/assistant");
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="checkout-modal" role="dialog" aria-modal="true" style={{ maxWidth: "440px", borderRadius: "18px", padding: "14px" }}>
        <div className="modal-heading" style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "30px", height: "30px", borderRadius: "9px", background: "#870210", color: "#fff", display: "grid", placeItems: "center" }}>
              <Sparkles size={15} />
            </span>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>{product.name}</h2>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={17} /></button>
        </div>

        <div style={{ maxHeight: "64vh", overflowY: "auto", padding: "2px" }}>
          {isPending ? (
            <div style={{ padding: "12px 6px" }}><AiThinkingStatus /></div>
          ) : recipeMutation.error ? (
            <div style={{ padding: "12px", textAlign: "center", color: "#9c3b37", fontSize: "12px" }}>
              <p style={{ marginBottom: "6px" }}>الشبكة مشغولة لحظياً</p>
              <button className="button button-outline" style={{ minHeight: "30px", fontSize: "11px" }} onClick={() => sendProductQuery(customInput)}>إعادة المحاولة</button>
            </div>
          ) : parsed.cleanText ? (
            <div style={{ background: "#f9fbf9", border: "1px solid #e4ece6", borderRadius: "12px", padding: "10px 12px", marginBottom: "10px" }}>
              <div style={{ whiteSpace: "pre-line", color: "#1e293b", fontSize: "12.5px", lineHeight: "1.65" }}>
                {parsed.cleanText}
              </div>
              {data?.recipe && (
                <div className="recipe-card" style={{ marginTop: "8px", padding: "9px 11px", borderRadius: "10px", background: "#fff", border: "1px solid #dce8df" }}>
                  <strong style={{ fontSize: "12.5px", color: "#870210", display: "block" }}>{data.recipe.name} <small style={{ fontWeight: 500, color: "#64748b" }}>(تكفي {data.recipe.servings})</small></strong>
                  {data.recipe.steps?.length > 0 && (
                    <ol style={{ margin: "6px 0", paddingInlineStart: "18px", fontSize: "11.5px", lineHeight: "1.6" }}>
                      {data.recipe.steps.map((st: string, sIdx: number) => <li key={sIdx}>{st}</li>)}
                    </ol>
                  )}
                  {data.ingredients?.length > 0 && (
                    <button type="button" onClick={() => { data.ingredients.forEach((ing: any) => add({ id: ing.productId, name: ing.name, price: ing.price, unit: ing.unit, stock: ing.stock, minQuantity: ing.minQuantity, quantityStep: ing.quantityStep }, ing.quantity)); toast.success("أُضيفت أصناف الوجبة للسلة 🛒"); }} style={{ ...tinyChipStyle, background: "#870210", color: "#fff", marginTop: "4px", padding: "4px 10px" }}>
                      إضافة أصناف الوجبة للسلة
                    </button>
                  )}
                </div>
              )}
              {parsed.chips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                  {parsed.chips.map((chip, idx) => (
                    <button key={idx} type="button" disabled={isPending} onClick={() => sendProductQuery(chip)} style={tinyChipStyle}>
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <form
            onSubmit={e => {
              e.preventDefault();
              if (!customInput.trim() || isPending) return;
              const q = customInput.trim();
              setCustomInput("");
              sendProductQuery(q);
            }}
            style={{ display: "flex", gap: "6px", marginBottom: "8px" }}
          >
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder="اسأل أي سؤال..."
              disabled={isPending}
              style={{ flex: 1, minHeight: "34px", padding: "0 12px", borderRadius: "999px", border: "1px solid #cbd8ce", fontSize: "12px", background: "#fff" }}
            />
            <button type="submit" className="button button-primary" disabled={!customInput.trim() || isPending} style={{ minHeight: "34px", padding: "0 14px", borderRadius: "999px", fontSize: "11.5px" }}>
              إرسال
            </button>
          </form>

          <button type="button" className="button button-outline full-button" onClick={continueInAssistantChat} style={{ borderRadius: "999px", minHeight: "32px", fontSize: "11px" }}>
            متابعة في صفحة المساعد
          </button>
        </div>
      </section>
    </div>
  );
}

function unpackProductVariants(rawDescription?: string | null): { cleanDescription: string; variants: string[]; weightEnabled: boolean; minWeightAmount: number; oldPrice: number; isBundle: boolean; bundleItems: string[] } {
  let raw = String(rawDescription || "");
  let variants: string[] = [];
  let weightEnabled = false;
  let minWeightAmount = 100;
  let oldPrice = 0;
  let isBundle = false;
  let bundleItems: string[] = [];
  const vm = raw.match(/\[\[variants:(\[[\s\S]*?\])\]\]/);
  if (vm) {
    raw = (raw.slice(0, vm.index) + raw.slice((vm.index || 0) + vm[0].length)).trim();
    try {
      const parsed = JSON.parse(vm[1]);
      if (Array.isArray(parsed)) variants = parsed.map(x => String(x || "").trim()).filter(Boolean).slice(0, 25);
    } catch {}
  }
  const wm = raw.match(/\[\[wcfg:(\{[\s\S]*?\})\]\]/);
  if (wm) {
    raw = (raw.slice(0, wm.index) + raw.slice((wm.index || 0) + wm[0].length)).trim();
    try {
      const parsed = JSON.parse(wm[1]);
      weightEnabled = Boolean(parsed.enabled);
      if (Number.isFinite(Number(parsed.minAmount)) && Number(parsed.minAmount) > 0) {
        minWeightAmount = Math.floor(Number(parsed.minAmount));
      }
    } catch {}
  }
  const om = raw.match(/\[\[offer:(\{[\s\S]*?\})\]\]/);
  if (om) {
    raw = (raw.slice(0, om.index) + raw.slice((om.index || 0) + om[0].length)).trim();
    try {
      const parsed = JSON.parse(om[1]);
      if (Number(parsed.oldPrice) > 0) oldPrice = Math.round(Number(parsed.oldPrice));
      if (parsed.isBundle) isBundle = true;
      if (Array.isArray(parsed.bundleItems)) bundleItems = parsed.bundleItems.map((x: any) => String(x || "").trim()).filter(Boolean);
    } catch {}
  }
  return { cleanDescription: raw.trim(), variants, weightEnabled, minWeightAmount, oldPrice, isBundle, bundleItems };
}

function formatWeightLabel(grams: number): string {
  if (grams <= 0) return "0 جرام";
  if (grams === 125) return "125 جرام (ثمن كيلو)";
  if (grams === 250) return "250 جرام (ربع كيلو)";
  if (grams === 500) return "500 جرام (نصف كيلو)";
  if (grams === 1000) return "1 كيلو كامل (1000 جرام)";
  if (grams > 1000) return (grams / 1000).toFixed(2).replace(/\.?0+$/, "") + " كيلو (" + grams.toLocaleString("en-US") + " جرام)";
  return grams.toLocaleString("en-US") + " جرام";
}

function VariantPickerModal({
  product,
  variants,
  weightEnabled = false,
  minWeightAmount = 100,
  initialVariant,
  initialQty,
  onClose,
}: {
  product: PublicProduct;
  variants: string[];
  weightEnabled?: boolean;
  minWeightAmount?: number;
  initialVariant?: string;
  initialQty?: number;
  onClose: () => void;
}) {
  const { add } = useStore();
  const [selected, setSelected] = useState<string>(initialVariant && variants.includes(initialVariant) ? initialVariant : (variants[0] || ""));
  const [qty, setQty] = useState<number>(initialQty || product.minQuantity || 1);
  const [buyMode, setBuyMode] = useState<"price" | "weight">("price");
  const pricePerKg = Math.max(1, product.price);
  const effectiveMin = Math.min(minWeightAmount, Math.max(50, Math.round(pricePerKg * 0.125)));
  const defaultAmount = Math.max(effectiveMin, Math.round(pricePerKg * 0.25) || 200);
  const [amountStr, setAmountStr] = useState<string>(String(defaultAmount));
  const [gramsStr, setGramsStr] = useState<string>("250");
  const step = product.quantityStep || 1;
  const minQ = product.minQuantity || 1;
  const maxQ = product.stock === null ? 9999 : product.stock;

  const finalGrams = buyMode === "price"
    ? Math.max(0, Math.round(((Math.max(0, Number(amountStr) || 0)) / pricePerKg) * 1000))
    : Math.max(0, Math.round(Number(gramsStr) || 0));
  const finalAmount = buyMode === "price"
    ? Math.max(0, Math.floor(Number(amountStr) || 0))
    : Math.max(0, Math.round((finalGrams / 1000) * pricePerKg));
  const weightText = formatWeightLabel(finalGrams);
  const isAmountValid = !weightEnabled || (finalAmount >= effectiveMin && finalGrams > 0);

  const confirmAdd = () => {
    if (variants.length > 0 && !selected) return;
    if (weightEnabled) {
      if (!isAmountValid) {
        toast.error("أقل مبلغ للشراء هو " + formatPrice(effectiveMin));
        return;
      }
      const vLabel = selected ? (selected + " · " + weightText) : weightText;
      const displayTitle = product.name + " (" + vLabel + ")";
      add({
        ...product,
        name: displayTitle,
        price: finalAmount,
        unit: weightText,
        variant: vLabel,
        customAmount: finalAmount,
      }, 1);
      toast.success("أُضيف «" + displayTitle + "» بمبلغ " + formatPrice(finalAmount));
      onClose();
      return;
    }
    if (selected) {
      add({ ...product, name: product.name + " (" + selected + ")", variant: selected }, qty);
      toast.success("تمت إضافة «" + product.name + " (" + selected + ")» إلى السلة");
    } else {
      add(product, qty);
      toast.success("أُضيف المنتج إلى السلة");
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose} style={{ zIndex: 140 }}>
      <section className="checkout-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "370px", padding: "18px", borderRadius: "22px" }}>
        <div className="modal-heading" style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {product.imageUrl && <SmartImage compact src={product.imageUrl} alt="" style={{ width: "44px", height: "44px", borderRadius: "12px", objectFit: "cover" }} />}
            <div>
              <h2 style={{ fontSize: "16px", margin: "0 0 2px" }}>{product.name}</h2>
              <small style={{ color: "#870210", fontWeight: 800 }}>
                {weightEnabled ? ("سعر الكيلو: " + formatPrice(product.price)) : (formatPrice(product.price) + " / " + product.unit)}
              </small>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        {variants.length > 0 && (
          <div style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "6px" }}>
              {variants.map(v => {
                const isSel = selected === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelected(v)}
                    style={{ padding: "9px", borderRadius: "11px", border: isSel ? "2px solid #870210" : "1px solid #d5e2d8", background: isSel ? "#870210" : "#f7faf8", color: isSel ? "#ffffff" : "#2b120f", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {weightEnabled ? (
          <div style={{ display: "grid", gap: "12px", marginBottom: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "#f2f6f3", padding: "5px", borderRadius: "14px" }}>
              <button
                type="button"
                onClick={() => setBuyMode("price")}
                style={{ padding: "10px 8px", borderRadius: "10px", border: "none", background: buyMode === "price" ? "#870210" : "transparent", color: buyMode === "price" ? "#ffffff" : "#870210", fontWeight: 800, fontSize: "12.5px", cursor: "pointer", transition: "0.15s" }}
              >
                💰 الشراء بالسعر
              </button>
              <button
                type="button"
                onClick={() => setBuyMode("weight")}
                style={{ padding: "10px 8px", borderRadius: "10px", border: "none", background: buyMode === "weight" ? "#870210" : "transparent", color: buyMode === "weight" ? "#ffffff" : "#870210", fontWeight: 800, fontSize: "12.5px", cursor: "pointer", transition: "0.15s" }}
              >
                ⚖️ الشراء بالوزن
              </button>
            </div>

            {buyMode === "price" ? (
              <div style={{ display: "grid", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#2b4736", textAlign: "center" }}>اكتب المبلغ الذي تريد الشراء به (ر.ي):</label>
                <input
                  type="number"
                  min={effectiveMin}
                  step="50"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder="مثلاً: 500"
                  style={{ width: "100%", padding: "10px", borderRadius: "12px", border: "1.5px solid #870210", fontSize: "17px", fontWeight: 800, textAlign: "center", background: "#ffffff", color: "#5e010b" }}
                />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {[
                  { label: "ثمن كيلو", g: 125 },
                  { label: "ربع كيلو", g: 250 },
                  { label: "نصف كيلو", g: 500 },
                  { label: "كيلو كامل", g: 1000 },
                ].map(w => {
                  const active = finalGrams === w.g;
                  return (
                    <button
                      key={w.g}
                      type="button"
                      onClick={() => setGramsStr(String(w.g))}
                      style={{ padding: "10px 4px", borderRadius: "11px", border: active ? "2px solid #870210" : "1px solid #d5e3da", background: active ? "#fceee9" : "#ffffff", color: "#870210", fontWeight: 800, fontSize: "11.5px", cursor: "pointer" }}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ padding: "10px 14px", borderRadius: "12px", background: "#fdf6f0", border: "1px solid #cde0d3", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", fontWeight: 800, color: "#870210" }}>
              <span>الوزن: {weightText}</span>
              <span>المبلغ: {formatPrice(finalAmount)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", padding: "10px 12px", borderRadius: "12px", background: "#f4f7f3" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#2b4736" }}>الكمية ({product.unit}):</span>
            <div className="quantity-compact">
              <button type="button" aria-label="تقليل" onClick={() => setQty(q => Math.max(minQ, q - step))}><Minus size={14} /></button>
              <b>{qty}</b>
              <button type="button" aria-label="زيادة" disabled={qty + step > maxQ} onClick={() => setQty(q => Math.min(maxQ, q + step))}><Plus size={14} /></button>
            </div>
          </div>
        )}

        <button type="button" className="button button-primary full-button" disabled={!isAmountValid} onClick={confirmAdd}>
          <ShoppingCart size={17} />
          {weightEnabled
            ? ("تأكيد الإضافة (" + formatPrice(finalAmount) + ")")
            : ("إضافة إلى السلة (" + formatPrice(product.price * qty) + ")")}
        </button>
      </section>
    </div>
  );
}

function ProductCard({ product, onOpen, onAiRecipe, priority = false }: { product: PublicProduct; onOpen: () => void; onAiRecipe?: (p: PublicProduct) => void; priority?: boolean }) {
  const { add, isFavorite, toggleFavorite } = useStore();
  const favorite = isFavorite(product.id);
  const disabled = product.stock !== null && product.stock < (product.minQuantity || 1);
  const { variants, weightEnabled, minWeightAmount, oldPrice, isBundle, bundleItems } = useMemo(() => unpackProductVariants(product.description), [product.description]);
  const hasOffer = oldPrice > product.price;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerVariant, setPickerVariant] = useState<string>("");

  const handleAddClick = (e: React.MouseEvent, preferredVariant?: string) => {
    e.stopPropagation();
    if (disabled) return;
    if (variants.length > 0 || weightEnabled) {
      setPickerVariant(preferredVariant || variants[0] || "");
      setPickerOpen(true);
      return;
    }
    add(product, product.minQuantity || 1);
    toast.success("أُضيف إلى السلة");
  };

  return <>
    <article className="product-card">
      <div className="product-visual" onClick={onOpen} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter") onOpen(); }}>
        {product.imageUrl ? <SmartImage src={product.imageUrl} alt={product.name} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" /> : <div className="product-no-image"><Leaf size={27} strokeWidth={1.4} /><span>صورة المنتج</span></div>}
        <button type="button" className={"favorite-toggle " + (favorite ? "is-favorite" : "")} aria-label={favorite ? "إزالة من المفضلة" : "أضف للمفضلة"} aria-pressed={favorite} onClick={event => { event.stopPropagation(); toggleFavorite(product.id); toast.success(favorite ? "أُزيل من المفضلة" : "أُضيف إلى المفضلة على هذا الجهاز"); }}><Heart size={17} fill={favorite ? "currentColor" : "none"} /></button>
        {onAiRecipe && <button type="button" className="ai-recipe-toggle" aria-label="أفكار وتحضير بالذكاء الاصطناعي" title="أفكار ووصفات تحضير" onClick={event => { event.stopPropagation(); onAiRecipe(product); }}><Sparkles size={16} /></button>}
        {hasOffer && !disabled && <span className="offer-corner-badge">{isBundle ? "🎁 تجميعة توفيرية" : ("🔥 وفّر " + formatPrice(oldPrice - product.price))}</span>}
        {disabled && <span className="product-sold-out">غير متوفر</span>}
      </div>
      <button type="button" className="product-title-button" onClick={onOpen}><strong>{product.name}</strong><span>{product.unit}</span></button>
      {isBundle && bundleItems.length > 0 && <div className="bundle-items-chip" onClick={onOpen}>🎁 يشمل: {bundleItems.join(" + ")}</div>}
      <div className="product-card-bottom">{hasOffer ? (<div className="price-with-offer"><span className="old-price-x" title="السعر قبل الخصم"><s>{formatPrice(oldPrice)}</s><i aria-hidden="true">✕</i></span><div><b className="new-offer-price">{formatPrice(product.price)}</b><small> / {product.unit}</small></div></div>) : (<div><b>{formatPrice(product.price)}</b><small> / {product.unit}</small></div>)}<button type="button" className="add-button" disabled={disabled} onClick={e => handleAddClick(e)} aria-label={"إضافة " + product.name + " للسلة"}><Plus size={18} /></button></div>
    </article>
    {pickerOpen && (
      <VariantPickerModal
        product={product}
        variants={variants}
        weightEnabled={weightEnabled}
        minWeightAmount={minWeightAmount}
        initialVariant={pickerVariant}
        onClose={() => setPickerOpen(false)}
      />
    )}
  </>;
}


function ProductGrid({ items, onOpen, onAiRecipe }: { items: PublicProduct[]; onOpen: (id: number) => void; onAiRecipe?: (p: PublicProduct) => void }) {
  if (!items.length) return <EmptyState icon={ShoppingBag} title="المتجر ينتظر منتجاته الأولى" description="لا توجد منتجات منشورة بعد. ستظهر الأصناف هنا بعد أن تضيفها من لوحة الإدارة." action="تصفح الأقسام" href="/categories" />;
  return <div className="product-grid">{items.map((product, idx) => <ProductCard key={product.id} product={product} priority={idx < 8} onOpen={() => onOpen(product.id)} onAiRecipe={onAiRecipe} />)}</div>;
}

function CategoryStrip({ data, onSelect, offersCount = 0, onSelectOffers }: { data: HomeData["categories"]; onSelect: (id: number) => void; offersCount?: number; onSelectOffers?: () => void }) {
  if (!data.length) return <div className="category-empty"><span className="category-empty-mark"><SlidersHorizontal size={19} /></span><div><strong>الأقسام قيد التجهيز</strong><p>أضف أقسام متجرك لتبدأ ترتيب المنتجات.</p></div><Link href="/categories"><ChevronLeft size={18} /></Link></div>;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: "12px",
        overflowX: "auto",
        overflowY: "hidden",
        padding: "4px 2px 12px",
        scrollSnapType: "x proximity",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
    >
      {onSelectOffers && (
        <button
          type="button"
          onClick={onSelectOffers}
          style={{
            flex: "0 0 106px",
            width: "106px",
            scrollSnapAlign: "start",
            background: "#ffffff",
            border: "1.5px solid #f0c29c",
            borderRadius: "16px",
            padding: "5px 5px 8px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(135, 2, 16, 0.07)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div style={{ width: "100%", height: "90px", borderRadius: "12px", background: "linear-gradient(135deg, #870210 0%, #c81e1e 60%, #e86c12 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#ffffff", gap: "4px" }}>
            <BadgePercent size={30} strokeWidth={2} />
            <strong style={{ fontSize: "10.5px", color: "#ffe6a7" }}>{offersCount > 0 ? `${offersCount} عروض` : "توفير"}</strong>
          </div>
          <span style={{ fontSize: "11.5px", fontWeight: 900, color: "#870210", lineHeight: 1.25, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            🔥 العروضات
          </span>
        </button>
      )}
      {data.map(category => {
        const btnColor = category.color && category.color.trim() ? category.color.trim() : "#870210";
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            style={{
              flex: "0 0 106px",
              width: "106px",
              scrollSnapAlign: "start",
              background: "#ffffff",
              border: "1px solid #ede2d8",
              borderRadius: "16px",
              padding: "5px 5px 8px",
              cursor: "pointer",
              boxShadow: "0 3px 10px rgba(43, 18, 15, 0.04)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div style={{ width: "100%", height: "90px", borderRadius: "12px", overflow: "hidden", background: "#fdf6f0" }}>
              {category.imageUrl ? (
                <SmartImage
                  src={category.imageUrl}
                  alt={category.name}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: btnColor }}>
                  <Leaf size={26} strokeWidth={1.6} />
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: "11.5px",
                fontWeight: 800,
                color: "#2b120f",
                lineHeight: 1.25,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {category.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const MY_ORDER_COUNTS_KEY = "shahezo-my-ordered-counts-v1";
function readMyOrderedCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MY_ORDER_COUNTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function recordMyOrderedItems(itemsList: Array<{ productId: number; quantity: number }>) {
  try {
    const counts = readMyOrderedCounts();
    for (const it of itemsList) {
      const k = String(it.productId);
      counts[k] = (Number(counts[k]) || 0) + Number(it.quantity || 1);
    }
    localStorage.setItem(MY_ORDER_COUNTS_KEY, JSON.stringify(counts));
  } catch {}
}

type HomeSortMode = "featured" | "price-asc" | "price-desc" | "most-ordered" | "my-most-ordered" | "category-first";

function HomePage({ data, onOpen, onAiRecipe }: { data: HomeData; onOpen: (id: number) => void; onAiRecipe?: (p: PublicProduct) => void }) {
  const [, navigate] = useLocation();
  const [sort, setSort] = useState<HomeSortMode>("featured");
  const [startCategoryId, setStartCategoryId] = useState<number | null>(null);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const myCounts = useMemo(() => readMyOrderedCounts(), [sort, sortModalOpen]);

  const featured = useMemo(() => {
    const base = [...(data.products ?? [])];
    if (sort === "price-asc") {
      base.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      base.sort((a, b) => b.price - a.price);
    } else if (sort === "most-ordered") {
      base.sort((a, b) => (Number((b as any).orderCount) || 0) - (Number((a as any).orderCount) || 0));
    } else if (sort === "my-most-ordered") {
      base.sort((a, b) => (Number(myCounts[String(b.id)]) || 0) - (Number(myCounts[String(a.id)]) || 0));
    } else if (sort === "category-first" && startCategoryId !== null) {
      base.sort((a, b) => {
        const aMatch = a.categoryId === startCategoryId ? 1 : 0;
        const bMatch = b.categoryId === startCategoryId ? 1 : 0;
        return bMatch - aMatch;
      });
    }
    return base;
  }, [data.products, sort, startCategoryId, myCounts]);

  const activeStartCategoryName = useMemo(
    () => (startCategoryId !== null ? data.categories.find(c => c.id === startCategoryId)?.name || "" : ""),
    [data.categories, startCategoryId]
  );

  const sortLabel =
    sort === "featured" ? "الافتراضي"
    : sort === "price-asc" ? "الأقل سعراً"
    : sort === "price-desc" ? "الأكثر سعراً"
    : sort === "most-ordered" ? "الأكثر طلباً"
    : sort === "my-most-ordered" ? "أكثر ما أطلبه"
    : activeStartCategoryName ? ("قسم: " + activeStartCategoryName) : "البدء بقسم";

  const changeCategory = (id: number) => { navigate("/products?category=" + id); };

  const topBanners = useMemo(() => (data.banners ?? []).filter(b => parseBannerMeta(b.actionUrl).cfg.placement === "top"), [data.banners]);
  const middleBanners = useMemo(() => (data.banners ?? []).filter(b => parseBannerMeta(b.actionUrl).cfg.placement === "middle"), [data.banners]);
  const bottomBanners = useMemo(() => (data.banners ?? []).filter(b => parseBannerMeta(b.actionUrl).cfg.placement === "bottom"), [data.banners]);
  const popupBanners = useMemo(() => (data.banners ?? []).filter(b => parseBannerMeta(b.actionUrl).cfg.placement === "popup"), [data.banners]);

  return <main className="page-shell">
    <PromoPopupModal banners={popupBanners} />
    <BannerCarousel banners={topBanners} />
    {data.offers.length > 0 && <section className="offers-row"><div className="section-heading compact"><div><span className="eyebrow">عروض المتجر</span><h2>فرص تستحق الانتباه</h2></div><BadgePercent size={22} /></div><div className="offer-strip">{data.offers.map(offer => <div className="offer-chip" key={offer.id}><span className="offer-chip-icon"><BadgePercent size={18} /></span><div><strong>{offer.title}</strong><small>{offer.description || (offer.discountType === "percent" ? "خصم " + offer.discountValue + "%" : "خصم " + formatPrice(offer.discountValue))}</small></div><code>{offer.code}</code></div>)}</div></section>}
    <section className="store-section categories-section"><div className="section-heading"><div><h2>الأقسام</h2></div><Link className="text-link" href="/categories">عرض الكل <ArrowLeft size={15} /></Link></div><CategoryStrip data={data.categories} onSelect={changeCategory} offersCount={(data.products ?? []).filter(p => { const u = unpackProductVariants(p.description); return u.oldPrice > p.price || u.isBundle; }).length} onSelectOffers={() => navigate("/products?offers=1")} /></section>
    {(() => {
      const offerItems = (data.products ?? []).filter(p => { const u = unpackProductVariants(p.description); return u.oldPrice > p.price || u.isBundle; });
      if (!offerItems.length) return null;
      return (
        <section className="store-section offers-showcase-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow" style={{ color: "#d90429", fontWeight: 900 }}>🔥 عروض وتجميعات التوفير</span>
              <h2>قسم العروضات الخاصة ({offerItems.length})</h2>
            </div>
            <Link className="text-link" href="/products?offers=1">عرض كل العروض <ArrowLeft size={15} /></Link>
          </div>
          <ProductGrid items={offerItems.slice(0, 8)} onOpen={onOpen} onAiRecipe={onAiRecipe} />
        </section>
      );
    })()}
    {middleBanners.length > 0 && <BannerCarousel banners={middleBanners} />}
    <section className="store-section products-section">
      <div className="section-heading">
        <div><h2>منتجات المتجر</h2></div>
        <div className="section-tools">
          <button
            type="button"
            onClick={() => setSortModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 11px",
              borderRadius: "11px",
              border: sort !== "featured" ? "1.5px solid #870210" : "1px solid #e4d5c9",
              background: sort !== "featured" ? "#fff4ee" : "#ffffff",
              color: "#870210",
              fontSize: "11.5px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(43, 18, 15, 0.04)",
            }}
          >
            <ArrowUpDown size={14} />
            <span>{sortLabel}</span>
            <ChevronDown size={13} />
          </button>
          <Link className="text-link" href="/products">عرض الكل <ArrowLeft size={15} /></Link>
        </div>
      </div>
      <ProductGrid items={featured} onOpen={onOpen} onAiRecipe={onAiRecipe} />
    </section>

    {sortModalOpen && (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={e => { if (e.target === e.currentTarget) setSortModalOpen(false); }}
        style={{ zIndex: 92 }}
      >
        <div
          role="dialog"
          aria-modal="true"
          style={{
            width: "min(360px, calc(100vw - 28px))",
            background: "#ffffff",
            borderRadius: "22px",
            padding: "16px",
            border: "1.5px solid #ead8cc",
            boxShadow: "0 20px 44px rgba(43, 18, 15, 0.22)",
            display: "grid",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px solid #f2e6dc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#fff2eb", color: "#870210", display: "grid", placeItems: "center" }}>
                <ArrowUpDown size={16} />
              </span>
              <strong style={{ fontSize: "14.5px", color: "#2b120f", fontWeight: 900 }}>ترتيب عرض المنتجات</strong>
            </div>
            <button type="button" className="icon-button" onClick={() => setSortModalOpen(false)} aria-label="إغلاق">
              <X size={17} />
            </button>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            {[
              { id: "featured" as const, title: "الافتراضي", sub: "ترتيب المتجر الأساسي والأبرز", icon: "✨" },
              { id: "price-asc" as const, title: "السعر: الأقل أولاً", sub: "من الأرخص إلى الأغلى", icon: "⬇️" },
              { id: "price-desc" as const, title: "السعر: الأكثر أولاً", sub: "من الأغلى إلى الأرخص", icon: "⬆️" },
              { id: "most-ordered" as const, title: "الأكثر طلباً", sub: "الأصناف الأكثر طلباً في شهيزو", icon: "🔥" },
              { id: "my-most-ordered" as const, title: "أكثر ما أطلبه أنا", sub: "أصنافك المفضلة من طلباتك السابقة", icon: "❤️" },
              { id: "category-first" as const, title: "البدء بقسم محدد", sub: "اعرض منتجات قسمك المفضل في البداية", icon: "📂" },
            ].map(opt => {
              const active = sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSort(opt.id);
                    if (opt.id !== "category-first") {
                      setSortModalOpen(false);
                    } else if (startCategoryId === null && data.categories.length > 0) {
                      setStartCategoryId(data.categories[0].id);
                    }
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "9px 11px",
                    borderRadius: "13px",
                    border: active ? "1.5px solid #870210" : "1px solid #efe4da",
                    background: active ? "#fff5ef" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "right",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ fontSize: "16px", lineHeight: 1 }}>{opt.icon}</span>
                    <div style={{ display: "grid", gap: "1px" }}>
                      <strong style={{ fontSize: "12.5px", color: active ? "#870210" : "#2b120f", fontWeight: active ? 900 : 800 }}>{opt.title}</strong>
                      <small style={{ fontSize: "10.5px", color: "#7a5e54" }}>{opt.sub}</small>
                    </div>
                  </div>
                  <span
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      border: active ? "2px solid #870210" : "1.5px solid #d5c5b8",
                      background: active ? "#870210" : "transparent",
                      color: "#ffffff",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {active && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          {sort === "category-first" && data.categories.length > 0 && (
            <div style={{ paddingTop: "6px", borderTop: "1px dashed #ead8cc", display: "grid", gap: "7px" }}>
              <small style={{ fontSize: "11px", fontWeight: 800, color: "#870210" }}>اختر القسم الذي يبدأ به العرض:</small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {data.categories.map(cat => {
                  const chosen = startCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setStartCategoryId(cat.id);
                        setSortModalOpen(false);
                      }}
                      style={{
                        padding: "6px 11px",
                        borderRadius: "99px",
                        border: chosen ? "1.5px solid #870210" : "1px solid #e5d6c8",
                        background: chosen ? "#870210" : "#fdf9f4",
                        color: chosen ? "#ffffff" : "#2b120f",
                        fontSize: "11.5px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    {bottomBanners.length > 0 && <BannerCarousel banners={bottomBanners} />}
  </main>;
}

function ProductListPage({ data, onOpen, onAiRecipe }: { data: HomeData; onOpen: (id: number) => void; onAiRecipe?: (p: PublicProduct) => void }) {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const selectedCategory = params.get("category");
  const onlyOffers = params.get("offers") === "1";
  const routeSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(routeSearch);
  const debouncedSearch = useDebouncedValue(search.trim());
  useEffect(() => setSearch(routeSearch), [routeSearch]);
  const categoryId = selectedCategory ? Number(selectedCategory) : undefined;
  const activeCategory = useMemo(() => data.categories.find(c => c.id === categoryId) ?? null, [data.categories, categoryId]);
  const cachedProducts = !debouncedSearch
    ? data.products.filter(product => categoryId === undefined || product.categoryId === categoryId)
    : [];
  const input = { search: debouncedSearch || undefined, categoryId, sort: "featured" as const, limit: 500 };
  const query = trpc.commerce.catalog.listProducts.useQuery(input, { retry: 1, staleTime: 0, refetchOnMount: "always", placeholderData: cachedProducts.length ? cachedProducts : undefined });

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "10px 14px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #dce8df",
          boxShadow: "0 8px 22px rgba(135, 2, 16, 0.06)",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
          {activeCategory?.imageUrl ? (
            <img
              src={activeCategory.imageUrl}
              alt={activeCategory.name}
              style={{ width: "48px", height: "48px", borderRadius: "14px", objectFit: "cover", border: "1.5px solid #870210", flexShrink: 0 }}
            />
          ) : (
            <span style={{ width: "46px", height: "46px", borderRadius: "14px", background: "#fceee9", color: "#870210", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <ShoppingBag size={22} />
            </span>
          )}
          <div>
            <h1 style={{ fontSize: "19px", fontWeight: 800, color: "#5e010b", margin: 0, lineHeight: 1.25 }}>
              {onlyOffers ? "🔥 قسم العروضات والتجميعات التوفيرية" : activeCategory ? activeCategory.name : (debouncedSearch ? ("نتائج البحث: " + debouncedSearch) : "كل المنتجات")}
            </h1>
            {activeCategory?.description && (
              <small style={{ fontSize: "11.5px", color: "#5c7063", display: "block", marginTop: "2px" }}>{activeCategory.description}</small>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLocation("/categories")}
          style={{
            padding: "7px 12px",
            borderRadius: "12px",
            border: "1px solid #cfe0d4",
            background: "#fdf6f0",
            color: "#870210",
            fontSize: "12px",
            fontWeight: 800,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            flexShrink: 0,
          }}
        >
          <span>الأقسام</span>
          <ArrowLeft size={14} />
        </button>
      </div>

      {data.categories.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            marginBottom: "10px",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            onClick={() => setLocation("/products?offers=1")}
            style={{
              padding: "6px 13px",
              borderRadius: "99px",
              border: onlyOffers ? "1.5px solid #d90429" : "1px solid #f0cfa0",
              background: onlyOffers ? "#d90429" : "#fff8eb",
              color: onlyOffers ? "#ffffff" : "#870210",
              fontSize: "12px",
              fontWeight: 900,
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            🔥 قسم العروضات
          </button>
          <button
            type="button"
            onClick={() => setLocation("/products")}
            style={{
              padding: "6px 13px",
              borderRadius: "99px",
              border: !categoryId ? "1.5px solid #870210" : "1px solid #d5e3da",
              background: !categoryId ? "#870210" : "#ffffff",
              color: !categoryId ? "#ffffff" : "#870210",
              fontSize: "12px",
              fontWeight: 800,
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            الكل
          </button>
          {data.categories.map(cat => {
            const isActive = categoryId === cat.id;
            const catColor = cat.color && cat.color.trim() ? cat.color.trim() : "#b8332a";
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setLocation("/products?category=" + cat.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 11px 4px 6px",
                  borderRadius: "99px",
                  border: isActive ? ("1.5px solid " + catColor) : "1px solid #d5e3da",
                  background: isActive ? catColor : "#ffffff",
                  color: isActive ? "#ffffff" : "#870210",
                  fontSize: "12px",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {cat.imageUrl && (
                  <SmartImage compact src={cat.imageUrl} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }} />
                )}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {query.isLoading ? <Loading /> : query.error ? <LoadError onRetry={() => void query.refetch()} /> : <ProductGrid items={(query.data ?? []).filter(p => !onlyOffers || (() => { const u = unpackProductVariants(p.description); return u.oldPrice > p.price || u.isBundle; })())} onOpen={onOpen} onAiRecipe={onAiRecipe} />}
    </main>
  );
}

function CategoriesPage({ data }: { data: HomeData }) {
  const [, navigate] = useLocation();
  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <h1 style={{ fontSize: "21px", fontWeight: 800, color: "#5e010b", margin: 0 }}>أقسام المتجر</h1>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#556b5d", background: "#edf5ef", padding: "4px 10px", borderRadius: "99px" }}>{data.categories.length} أقسام</span>
      </div>
      {!data.categories.length ? (
        <EmptyState icon={SlidersHorizontal} title="لا توجد أقسام بعد" description="سيضيف صاحب المتجر الأقسام المناسبة، وستظهر لك هنا تلقائيًا." action="استكشف المتجر" href="/products" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "14px" }}>
          {data.categories.map(category => {
            const btnColor = category.color && category.color.trim() ? category.color.trim() : "#b8332a";
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => navigate("/products?category=" + category.id)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e6ece8",
                  borderRadius: "18px",
                  padding: "8px 8px 11px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(15, 52, 35, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "9px",
                  width: "100%",
                }}
              >
                <div style={{ width: "100%", height: "174px", borderRadius: "14px", overflow: "hidden", background: "#fdf6f0" }}>
                  {category.imageUrl ? (
                    <SmartImage
                      src={category.imageUrl}
                      alt={category.name}
                      loading="eager"
                      decoding="async"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: btnColor }}>
                      <Leaf size={40} strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <span
                  style={{
                    display: "inline-block",
                    maxWidth: "94%",
                    padding: "6px 14px",
                    borderRadius: "10px",
                    backgroundColor: btnColor,
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    lineHeight: 1.35,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

function ProductDetail({ id, allProducts = [], onSelectProduct, onBack, onAiRecipe }: { id: number; allProducts?: PublicProduct[]; onSelectProduct?: (nextId: number) => void; onBack: () => void; onAiRecipe?: (p: PublicProduct) => void }) {
  const cachedProduct = useMemo(() => allProducts.find(p => p.id === id) ?? null, [allProducts, id]);
  const { data: fetchedProduct, isLoading, error } = trpc.commerce.catalog.product.useQuery({ id }, {
    retry: 1,
    staleTime: 30000,
    placeholderData: cachedProduct ? { ...cachedProduct, recommendations: [] } : undefined,
  });
  const product = fetchedProduct ?? (cachedProduct ? { ...cachedProduct, recommendations: [] } : null);
  const { add } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [detailPickerOpen, setDetailPickerOpen] = useState(false);
  const [selectedDetailVariant, setSelectedDetailVariant] = useState<string>("");
  const unpackedDetail = useMemo(() => unpackProductVariants(product?.description), [product?.description]);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    try { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }); } catch { window.scrollTo(0, 0); }
    setQuantity(product?.minQuantity || 1);
    setSelectedDetailVariant("");
  }, [id, product?.minQuantity]);

  const currentIndex = useMemo(() => allProducts.findIndex(p => p.id === id), [allProducts, id]);
  const hasGallery = allProducts.length > 1 && currentIndex >= 0;
  const nextProduct = hasGallery ? allProducts[(currentIndex + 1) % allProducts.length] : null;
  const prevProduct = hasGallery ? allProducts[(currentIndex - 1 + allProducts.length) % allProducts.length] : null;

  useEffect(() => {
    if (nextProduct?.imageUrl) { const img = new Image(); img.src = nextProduct.imageUrl; }
    if (prevProduct?.imageUrl) { const img = new Image(); img.src = prevProduct.imageUrl; }
  }, [nextProduct?.imageUrl, prevProduct?.imageUrl]);

  const goNext = () => { if (nextProduct && onSelectProduct) onSelectProduct(nextProduct.id); };
  const goPrev = () => { if (prevProduct && onSelectProduct) onSelectProduct(prevProduct.id); };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasGallery) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX >= rect.width * 0.5) goNext();
    else goPrev();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null || !hasGallery) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const diff = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 38) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (!product && isLoading) return <main className="page-shell inner-page"><Loading /></main>;
  if (error || !product) return <main className="page-shell inner-page"><LoadError onRetry={() => window.location.reload()} /></main>;
  const stockLimit = product.stock === null ? 9999 : product.stock;

  const handleDetailAdd = () => {
    if (unpackedDetail.weightEnabled || unpackedDetail.variants.length > 0) {
      if (!unpackedDetail.weightEnabled && selectedDetailVariant) {
        add({ ...product, name: product.name + " (" + selectedDetailVariant + ")", variant: selectedDetailVariant }, quantity);
        toast.success("تمت إضافة «" + product.name + " (" + selectedDetailVariant + ")» إلى السلة");
      } else {
        setDetailPickerOpen(true);
      }
      return;
    }
    add(product, quantity);
    toast.success("أُضيف المنتج إلى السلة");
  };

  return (
    <main className="page-shell inner-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", gap: "10px" }}>
        <button type="button" className="back-link" style={{ marginBottom: 0 }} onClick={onBack}><ArrowLeft size={16} /> العودة للمتجر</button>
        {hasGallery && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#ffffff", border: "1px solid #dfe7e0", borderRadius: "999px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, color: "#870210" }}>
            <button type="button" onClick={goNext} style={{ border: 0, background: "transparent", cursor: "pointer", padding: "2px 6px", fontWeight: 800, color: "#870210" }} title="المنتج التالي">‹ التالي</button>
            <span style={{ color: "#78847b", fontSize: "10px" }}>{currentIndex + 1} / {allProducts.length}</span>
            <button type="button" onClick={goPrev} style={{ border: 0, background: "transparent", cursor: "pointer", padding: "2px 6px", fontWeight: 800, color: "#870210" }} title="المنتج السابق">السابق ›</button>
          </div>
        )}
      </div>
      <div className="detail-layout">
        <div
          className="detail-visual"
          onClick={handleImageClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ position: "relative", cursor: hasGallery ? "pointer" : "default", userSelect: "none" }}
        >
          {product.imageUrl ? (
            <SmartImage key={product.id} src={product.imageUrl} alt={product.name} decoding="async" fetchPriority="high" draggable={false} />
          ) : (
            <div className="product-no-image detail-placeholder"><Leaf size={45} /><span>لا توجد صورة لهذا المنتج</span></div>
          )}
          {hasGallery && (
            <>
              <button type="button" aria-label="المنتج التالي" onClick={e => { e.stopPropagation(); goNext(); }} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "38px", height: "38px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.85)", background: "rgba(135, 2, 16, 0.82)", color: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", fontSize: "18px", fontWeight: 800 }}>‹</button>
              <button type="button" aria-label="المنتج السابق" onClick={e => { e.stopPropagation(); goPrev(); }} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "38px", height: "38px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.85)", background: "rgba(135, 2, 16, 0.82)", color: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", fontSize: "18px", fontWeight: 800 }}>›</button>
            </>
          )}
        </div>
        <div className="detail-copy">
          <span className="eyebrow">من بوفية شهيزو – SHAHEZO</span>
          <h1>{product.name}</h1>
          {unpackedDetail.cleanDescription ? <p className="detail-description">{unpackedDetail.cleanDescription}</p> : null}
          {unpackedDetail.variants.length > 0 && (
            <div style={{ margin: "10px 0 14px", padding: "12px", borderRadius: "14px", background: "#f2f7f3", border: "1px solid #d5e5da", display: "grid", gap: "8px" }}>
              <strong style={{ fontSize: "13px", color: "#870210" }}>اختر النوع المطلوب:</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))", gap: "8px" }}>
                {unpackedDetail.variants.map(v => {
                  const isSel = selectedDetailVariant === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedDetailVariant(v)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "12px",
                        border: isSel ? "2px solid #870210" : "1px solid #c5d9cc",
                        background: isSel ? "#870210" : "#ffffff",
                        color: isSel ? "#ffffff" : "#870210",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        boxShadow: isSel ? "0 5px 14px rgba(135, 2, 16, 0.22)" : "none",
                      }}
                    >
                      {isSel && <Check size={15} />}
                      <span>{v}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {unpackedDetail.isBundle && unpackedDetail.bundleItems.length > 0 && (
            <div style={{ margin: "10px 0", padding: "12px 14px", borderRadius: "14px", background: "#fff8eb", border: "1.5px solid #f0cfa0", display: "grid", gap: "6px" }}>
              <strong style={{ fontSize: "13px", color: "#870210" }}>🎁 مكونات التجميعة المشمولة في العرض:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {unpackedDetail.bundleItems.map((bi, idx) => (
                  <span key={idx} style={{ background: "#ffffff", border: "1px solid #ead4b0", borderRadius: "9px", padding: "4px 10px", fontSize: "12px", fontWeight: 700, color: "#2b120f" }}>✓ {bi}</span>
                ))}
              </div>
            </div>
          )}
          <div className="detail-price" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {unpackedDetail.oldPrice > product.price && (
              <span className="old-price-x" style={{ fontSize: "16px" }} title="السعر السابق قبل الخصم">
                <s>{formatPrice(unpackedDetail.oldPrice)}</s>
                <i aria-hidden="true" style={{ fontSize: "13px" }}>✕</i>
              </span>
            )}
            <span>{formatPrice(product.price)} <small>/ {product.unit}</small></span>
            {unpackedDetail.oldPrice > product.price && (
              <span style={{ background: "#fceee9", color: "#d90429", border: "1px solid #f5c2c7", borderRadius: "99px", padding: "3px 10px", fontSize: "12px", fontWeight: 900 }}>
                🔥 وفّرت {formatPrice(unpackedDetail.oldPrice - product.price)}
              </span>
            )}
          </div>
          <div className="detail-meta"><span><Package size={15} /> الوحدة: {product.unit}</span><span>{product.stock === null ? "التوفر يحدده المتجر" : "المتاح: " + product.stock}</span></div>
          <div className="quantity-control"><button type="button" aria-label="تقليل" onClick={() => setQuantity(value => Math.max(product.minQuantity || 1, value - (product.quantityStep || 1)))}><Minus size={16} /></button><strong>{quantity}</strong><button type="button" aria-label="زيادة" disabled={quantity + (product.quantityStep || 1) > stockLimit} onClick={() => setQuantity(value => Math.min(stockLimit, value + (product.quantityStep || 1)))}><Plus size={16} /></button><small>{product.unit}</small></div>
          {onAiRecipe && <button type="button" className="button button-outline full-button" style={{ marginBottom: "8px", borderColor: "#870210", color: "#870210" }} onClick={() => onAiRecipe(product as PublicProduct)}><Sparkles size={16} /> أفكار وطرق تحضير بالذكاء الاصطناعي</button>}
          <button type="button" className="button button-primary full-button" disabled={stockLimit < (product.minQuantity || 1)} onClick={handleDetailAdd}><ShoppingCart size={17} /> {unpackedDetail.weightEnabled ? "⚖️ حدد المبلغ والوزن وأضف للسلة" : unpackedDetail.variants.length > 0 ? (selectedDetailVariant ? "أضف «" + selectedDetailVariant + "» إلى السلة" : "اختر النوع وأضف إلى السلة") : "أضف إلى السلة"}</button>
          {detailPickerOpen && (unpackedDetail.variants.length > 0 || unpackedDetail.weightEnabled) && <VariantPickerModal product={product as PublicProduct} variants={unpackedDetail.variants} weightEnabled={unpackedDetail.weightEnabled} minWeightAmount={unpackedDetail.minWeightAmount} initialVariant={selectedDetailVariant} initialQty={quantity} onClose={() => setDetailPickerOpen(false)} />}
        </div>
      </div>
      {!!product.recommendations?.length && <section className="store-section"><div className="section-heading"><div><span className="eyebrow">قد يناسبك أيضًا</span><h2>منتجات مقترحة</h2></div></div><ProductGrid items={product.recommendations as PublicProduct[]} onOpen={nextId => onSelectProduct ? onSelectProduct(nextId) : window.location.assign("/product/" + nextId)} onAiRecipe={onAiRecipe} /></section>}
    </main>
  );
}

function CartPage({ minOrder = 0 }: { minOrder?: number }) {
  const { cart, setQuantity, remove, clear } = useStore();
  const [checkout, setCheckout] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const totalItemsCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const belowMin = minOrder > 0 && subtotal < minOrder;

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px", paddingBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #ead8cc",
          boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#f1d897", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <ShoppingCart size={20} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#2b120f" }}>سلة التسوق</h1>
            <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 700 }}>
              {cart.length > 0 ? `${cart.length} أصناف (${totalItemsCount} وحدة) جاهزة للطلب` : "سلتك فارغة حالياً"}
            </small>
          </div>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            style={{
              padding: "6px 11px",
              borderRadius: "10px",
              border: "1px solid #f2cfc6",
              background: "#fff5f4",
              color: "#b42318",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Trash2 size={13} /> إفراغ السلة
          </button>
        )}
      </div>

      {!cart.length ? (
        <div className="shahezo-empty-hero">
          <div className="shahezo-empty-icon-ring">
            <ShoppingCart size={32} strokeWidth={1.8} />
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            <strong style={{ fontSize: "17px", color: "#2b120f", fontWeight: 900 }}>سلتك بانتظار أشهى الوجبات الساخنة! 🥙</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#6e564d", lineHeight: 1.65, maxWidth: "340px" }}>
              لم تضف أي طلبات للسلة بعد. استكشف تشكيلة الشاورما والفلافل المقرمشة والعصائر الطازجة أو تصفح عروض التوفير الآن.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "9px", width: "100%", marginTop: "4px" }}>
            <Link href="/products" className="button button-primary" style={{ flex: "1 1 160px", maxWidth: "220px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              <ShoppingBag size={16} /> تسوق المتجر الآن
            </Link>
            <Link href="/products?offers=1" className="button" style={{ flex: "1 1 150px", maxWidth: "200px", textDecoration: "none", background: "#fdf9f4", color: "#870210", border: "1.5px solid #ead8cc", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <BadgePercent size={16} /> قسم العروضات
            </Link>
          </div>
        </div>
      ) : (
        <div className="cart-layout shahezo-card-enter">
          <div className="cart-list" style={{ borderRadius: "20px", border: "1.5px solid #ead8cc", background: "#ffffff", padding: "8px 14px", boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)" }}>
            {cart.map(line => (
              <CartRow
                key={line.id}
                line={line}
                onQuantity={quantity => setQuantity(line.id, quantity)}
                onRemove={() => remove(line.id)}
              />
            ))}
          </div>
          <aside className="summary-card" style={{ borderRadius: "20px", border: "1.5px solid #ead8cc", background: "linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)", boxShadow: "0 8px 22px rgba(43, 18, 15, 0.05)" }}>
            <span className="eyebrow" style={{ color: "#870210", fontWeight: 800 }}>فاتورة طلبك المبدئية</span>
            <div className="summary-line">
              <span>عدد الأصناف</span>
              <strong>{cart.length} أصناف ({totalItemsCount} وحدة)</strong>
            </div>
            <div className="summary-line">
              <span>المجموع الفرعي</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            {minOrder > 0 && (
              <div className="summary-line">
                <span>الحد الأدنى للطلب</span>
                <strong>{formatPrice(minOrder)}</strong>
              </div>
            )}
            <div className="summary-line">
              <span>رسوم التوصيل</span>
              <span style={{ fontSize: "11px", color: "#870210", fontWeight: 700 }}>تُحسب تلقائياً عند اختيار الحي</span>
            </div>
            <div className="summary-total" style={{ borderTop: "1.5px dashed #e5d2c3", marginTop: "6px", paddingTop: "12px" }}>
              <span style={{ fontWeight: 800, color: "#2b120f" }}>الإجمالي الحالي</span>
              <strong style={{ fontSize: "19px", color: "#870210" }}>{formatPrice(subtotal)}</strong>
            </div>
            {belowMin && (
              <p
                style={{
                  color: "#b42318",
                  background: "#fef3f2",
                  border: "1px solid #fecdca",
                  padding: "9px 11px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  margin: "8px 0",
                }}
              >
                ⚠️ الحد الأدنى للطلب هو {formatPrice(minOrder)} — أضف منتجات بقيمة {formatPrice(minOrder - subtotal)} لإتمام الطلب.
              </p>
            )}
            <button
              type="button"
              className="button button-primary full-button"
              style={{ marginTop: "8px", minHeight: "46px", fontSize: "14px", fontWeight: 900, borderRadius: "14px" }}
              onClick={() => {
                if (belowMin) {
                  toast.error(`الحد الأدنى للطلب من المتجر هو ${formatPrice(minOrder)} (متبقي ${formatPrice(minOrder - subtotal)})`);
                  return;
                }
                setCheckout(true);
              }}
            >
              <Check size={17} /> المتابعة لإتمام الطلب ({formatPrice(subtotal)}) <ArrowLeft size={16} />
            </button>
            {confirmClear && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmClear(false); }}
          style={{ zIndex: 90 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "min(310px, calc(100vw - 36px))",
              background: "#ffffff",
              borderRadius: "20px",
              padding: "18px 18px 16px",
              border: "1px solid #efe2d7",
              boxShadow: "0 18px 40px rgba(43, 18, 15, 0.18)",
              textAlign: "center",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ width: "42px", height: "42px", borderRadius: "14px", background: "#fff1f0", color: "#b42318", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <Trash2 size={20} />
            </div>
            <strong style={{ fontSize: "15px", color: "#2b120f", fontWeight: 900 }}>إفراغ السلة؟</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#7a5e54", lineHeight: 1.5 }}>
              سيتم حذف جميع الأصناف المضافة من سلتك.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => { clear(); setConfirmClear(false); toast.success("تم إفراغ السلة"); }}
                style={{
                  minHeight: "38px",
                  borderRadius: "11px",
                  border: 0,
                  background: "#870210",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                نعم، إفراغ
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                style={{
                  minHeight: "38px",
                  borderRadius: "11px",
                  border: "1px solid #e6d7cb",
                  background: "#fdf9f4",
                  color: "#2b120f",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {checkout && <Checkout onClose={() => setCheckout(false)} onSuccess={clear} cart={cart} />}
          </aside>
        </div>
      )}
    </main>
  );
}

function CartRow({ line, onQuantity, onRemove }: { line: CartLine; onQuantity: (n: number) => void; onRemove: () => void }) {
  return (
    <article className="cart-row" style={{ padding: "12px 0", borderBottom: "1px solid #f5ebe3" }}>
      <div className="cart-thumb" style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid #ead8cc" }}>
        {line.imageUrl ? <img src={line.imageUrl} alt="" loading="lazy" decoding="async" /> : <Leaf size={22} />}
      </div>
      <div className="cart-row-info">
        <strong style={{ fontSize: "13.5px", color: "#2b120f" }}>{line.name}</strong>
        <small style={{ color: "#7a5e54", fontWeight: 600 }}>{formatPrice(line.price)} / {line.unit}</small>
        <div className="cart-row-tools" style={{ marginTop: "6px" }}>
          <div className="quantity-compact" style={{ background: "#fdf9f4", border: "1px solid #ead8cc", borderRadius: "10px" }}>
            <button type="button" aria-label="تقليل" onClick={() => onQuantity(line.quantity - (line.quantityStep || 1))}><Minus size={14} /></button>
            <b style={{ color: "#870210", minWidth: "22px", textAlign: "center" }}>{line.quantity}</b>
            <button type="button" aria-label="زيادة" disabled={line.stock !== null && line.stock !== undefined && line.quantity + (line.quantityStep || 1) > line.stock} onClick={() => onQuantity(line.quantity + (line.quantityStep || 1))}><Plus size={14} /></button>
          </div>
          <button type="button" className="remove-line" onClick={onRemove} style={{ color: "#b42318", fontWeight: 700 }}>
            <Trash2 size={14} /> حذف
          </button>
        </div>
      </div>
      <strong className="cart-line-total" style={{ fontSize: "14px", color: "#870210", fontWeight: 900 }}>
        {formatPrice(line.price * line.quantity)}
      </strong>
    </article>
  );
}


function getYemenCarrierName(_phone: string): string {
  return "";
}

type PublicDeliveryStreet = { id: string; name: string; fee: number; promoFee: number | null; promoLabel: string; freeAbove: number | null; etaText: string; enabled: boolean };
type PublicDeliveryArea = { id: string; name: string; defaultFee: number; enabled: boolean; streets: PublicDeliveryStreet[] };
type PublicDeliveryCity = { id: string; name: string; defaultFee: number; freeDeliveryPromo: boolean; promoBanner: string; enabled: boolean; areas: PublicDeliveryArea[] };
type PublicDeliveryTree = {
  strictSelectionOnly: boolean;
  globalFreeAbove: number | null;
  cities: PublicDeliveryCity[];
  vipFreePhones: Array<{ phone: string; name: string; minOrder: number; enabled: boolean }>;
};

const DEFAULT_PUBLIC_DELIVERY_TREE: PublicDeliveryTree = {
  strictSelectionOnly: true,
  globalFreeAbove: null,
  vipFreePhones: [],
  cities: [
    {
      id: "city_sanaa", name: "صنعاء", defaultFee: 500, freeDeliveryPromo: false, promoBanner: "", enabled: true,
      areas: [
        { id: "area_maeen", name: "معين", defaultFee: 500, enabled: true, streets: [
          { id: "st_raqqas", name: "الرقاص", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_daeri", name: "الدائري", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_hael", name: "شارع هائل", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_sunaina", name: "السنينة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_asr", name: "عصر", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_madhbah", name: "مذبح", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
        ]},
        { id: "area_sabeen", name: "السبعين", defaultFee: 600, enabled: true, streets: [
          { id: "st_haddah", name: "حدة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 40 دقيقة", enabled: true },
          { id: "st_asbahi", name: "الأصبحي", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_baitbaws", name: "بيت بوس", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
          { id: "st_maqaleh", name: "شارع المقالح", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_shumaila", name: "شميلة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
        ]},
        { id: "area_wahdah", name: "الوحدة", defaultFee: 500, enabled: true, streets: [
          { id: "st_jazaer", name: "شارع الجزائر", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_baghdad", name: "شارع بغداد", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_siyasi", name: "الحي السياسي", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_tahrir", name: "التحرير", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
        ]},
        { id: "area_shoub", name: "شعوب والثورة", defaultFee: 600, enabled: true, streets: [
          { id: "st_hasaba", name: "الحصبة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_juraf", name: "الجراف", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
          { id: "st_sawan", name: "سعوان", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
          { id: "st_sheraton", name: "شيراتون", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
        ]},
      ],
    },
    {
      id: "city_ibb", name: "إب", defaultFee: 500, freeDeliveryPromo: false, promoBanner: "", enabled: true,
      areas: [
        { id: "area_dhihar", name: "الظهار", defaultFee: 500, enabled: true, streets: [
          { id: "st_ibb_taiz", name: "شارع تعز", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
          { id: "st_ibb_daeri", name: "الدائري", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
          { id: "st_ibb_subul", name: "السبل", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
        ]},
        { id: "area_mashanah", name: "المشنة", defaultFee: 500, enabled: true, streets: [
          { id: "st_ibb_odain", name: "شارع العدين", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
          { id: "st_ibb_maayen", name: "المعاين", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
        ]},
      ],
    },
  ],
};

function readPublicDeliveryTree(raw?: string | null): PublicDeliveryTree {
  if (!raw) return DEFAULT_PUBLIC_DELIVERY_TREE;
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || !Array.isArray(p.cities)) return DEFAULT_PUBLIC_DELIVERY_TREE;
    const activeCities = p.cities
      .filter((c: any) => c && c.enabled !== false)
      .map((c: any) => ({
        ...c,
        areas: (Array.isArray(c.areas) ? c.areas : [])
          .filter((a: any) => a && a.enabled !== false)
          .map((a: any) => ({
            ...a,
            streets: (Array.isArray(a.streets) ? a.streets : []).filter((s: any) => s && s.enabled !== false),
          })),
      }));
    if (!activeCities.length) return DEFAULT_PUBLIC_DELIVERY_TREE;
    return {
      strictSelectionOnly: p.strictSelectionOnly !== false,
      globalFreeAbove: p.globalFreeAbove && Number(p.globalFreeAbove) > 0 ? Math.floor(Number(p.globalFreeAbove)) : null,
      cities: activeCities,
      vipFreePhones: Array.isArray(p.vipFreePhones) ? p.vipFreePhones.filter((v: any) => v && v.enabled !== false) : [],
    };
  } catch {
    return DEFAULT_PUBLIC_DELIVERY_TREE;
  }
}

function splitDistrictToAreaAndStreet(district: string): { areaName: string; streetName: string } {
  const parts = String(district || "").split(/\s*[—\-|/]+\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { areaName: parts[0], streetName: parts.slice(1).join(" ") };
  return { areaName: "", streetName: parts[0] || "" };
}

function computeLocalDeliveryFee(
  tree: PublicDeliveryTree,
  cityObj: PublicDeliveryCity | null,
  areaObj: PublicDeliveryArea | null,
  streetObj: PublicDeliveryStreet | null,
  phone: string,
  subtotal: number,
): number {
  const cleanP = cleanYemeniPhone(phone);
  const vipMatch = cleanP ? tree.vipFreePhones.find(v => cleanYemeniPhone(v.phone) === cleanP && subtotal >= Number(v.minOrder || 0)) : null;
  if (vipMatch) return 0;
  if (tree.globalFreeAbove && subtotal >= tree.globalFreeAbove) return 0;
  if (cityObj?.freeDeliveryPromo) return 0;
  if (streetObj?.freeAbove && subtotal >= streetObj.freeAbove) return 0;
  if (streetObj && streetObj.promoFee !== null && streetObj.promoFee !== undefined) return streetObj.promoFee;
  if (streetObj) return streetObj.fee;
  if (areaObj) return areaObj.defaultFee;
  return cityObj?.defaultFee ?? 500;
}

function ThreeStepLocationPicker({
  tree,
  city,
  district,
  phone,
  subtotal,
  onChangeLocation,
}: {
  tree: PublicDeliveryTree;
  city: string;
  district: string;
  phone: string;
  subtotal: number;
  onChangeLocation: (nextCity: string, nextDistrict: string) => void;
}) {
  const parsed = splitDistrictToAreaAndStreet(district);
  const committedCity = tree.cities.find(c => c.name === city) ?? null;
  const committedArea = committedCity?.areas.find(a => a.name === parsed.areaName) ?? null;
  const committedStreet = committedArea?.streets.find(s => s.name === parsed.streetName) ?? null;
  const isSelectionComplete = Boolean(committedCity && committedArea && (committedArea.streets.length === 0 || committedStreet));

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [step, setStep] = useState<"city" | "area" | "street">("city");
  const [draftCity, setDraftCity] = useState<PublicDeliveryCity | null>(committedCity);
  const [draftArea, setDraftArea] = useState<PublicDeliveryArea | null>(committedArea);

  useEffect(() => {
    setDraftCity(committedCity);
    setDraftArea(committedArea);
  }, [city, district, tree]);

  const handleToggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setDraftCity(committedCity);
    setDraftArea(committedArea);
    setStep("city");
    setIsOpen(true);
  };

  const handleSelectCity = (c: PublicDeliveryCity) => {
    setDraftCity(c);
    setDraftArea(null);
    if (city !== c.name) {
      onChangeLocation("", "");
    }
    if (c.areas.length > 0) {
      setStep("area");
    } else {
      onChangeLocation(c.name, c.name);
      setIsOpen(false);
    }
  };

  const handleSelectArea = (a: PublicDeliveryArea) => {
    if (!draftCity) return;
    setDraftArea(a);
    if (a.streets.length > 0) {
      setStep("street");
    } else {
      onChangeLocation(draftCity.name, a.name);
      setIsOpen(false);
    }
  };

  const handleSelectStreet = (st: PublicDeliveryStreet) => {
    if (!draftCity || !draftArea) return;
    onChangeLocation(draftCity.name, draftArea.name + " — " + st.name);
    setIsOpen(false);
  };

  const effectiveFee = isSelectionComplete
    ? computeLocalDeliveryFee(tree, committedCity, committedArea, committedStreet, phone, subtotal)
    : null;

  const fullAddressLabel = isSelectionComplete
    ? [committedCity?.name, committedArea?.name, committedStreet?.name].filter(Boolean).join(" – ")
    : "";

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#2b120f" }}>عنوان التوصيل</span>

      <button
        type="button"
        onClick={handleToggleOpen}
        style={{
          width: "100%",
          minHeight: isSelectionComplete ? "64px" : "50px",
          padding: "12px 14px",
          borderRadius: "12px",
          border: isOpen ? "1.5px solid #870210" : "1px solid #d8e1db",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          cursor: "pointer",
          textAlign: "right",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          boxShadow: isOpen ? "0 4px 14px rgba(135, 2, 16, 0.08)" : "0 1px 3px rgba(15, 42, 28, 0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0, flex: 1 }}>
          <span style={{ width: "32px", height: "32px", borderRadius: "9px", background: "#fdf6f0", color: "#870210", display: "grid", placeItems: "center", flexShrink: 0, marginTop: isSelectionComplete ? "2px" : "0" }}>
            <MapPin size={17} />
          </span>
          {!isSelectionComplete ? (
            <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#2d4537", alignSelf: "center" }}>
              اختر منطقة التوصيل
            </span>
          ) : (
            <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
              <strong style={{ fontSize: "13.5px", color: "#2b120f", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {fullAddressLabel}
              </strong>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: effectiveFee === 0 ? "#870210" : "#516659", fontWeight: 700 }}>
                  رسوم التوصيل: {effectiveFee === 0 ? "مجاني" : formatPrice(effectiveFee ?? 0)}
                </span>
                {effectiveFee === 0 && (
                  <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 8px", borderRadius: "99px", background: "#fceee9", color: "#870210" }}>
                    توصيل مجاني
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!isSelectionComplete ? (
          <ChevronDown
            size={18}
            style={{
              color: "#5b7063",
              flexShrink: 0,
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        ) : (
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#870210", display: "inline-flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {isOpen ? "إغلاق" : "تعديل العنوان ←"}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            padding: "14px",
            borderRadius: "12px",
            background: "#fafcfa",
            border: "1px solid #dce5df",
            display: "grid",
            gap: "12px",
            animation: "fadeIn 0.18s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", paddingBottom: "8px", borderBottom: "1px solid #e9efeb", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setStep("city")}
                style={{
                  border: "none",
                  background: step === "city" ? "#870210" : "#eef3f0",
                  color: step === "city" ? "#ffffff" : "#2c4537",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {draftCity ? draftCity.name : "المدينة"}
              </button>
              {draftCity && (
                <>
                  <span style={{ color: "#95a59b", fontSize: "11px" }}>/</span>
                  <button
                    type="button"
                    onClick={() => setStep("area")}
                    style={{
                      border: "none",
                      background: step === "area" ? "#870210" : "#eef3f0",
                      color: step === "area" ? "#ffffff" : "#2c4537",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {draftArea ? draftArea.name : "المنطقة"}
                  </button>
                </>
              )}
              {draftCity && draftArea && (
                <>
                  <span style={{ color: "#95a59b", fontSize: "11px" }}>/</span>
                  <span
                    style={{
                      background: step === "street" ? "#870210" : "#eef3f0",
                      color: step === "street" ? "#ffffff" : "#2c4537",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                    }}
                  >
                    الشارع
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ border: "none", background: "transparent", color: "#687b6f", fontSize: "11.5px", cursor: "pointer", padding: "2px 4px" }}
            >
              إغلاق
            </button>
          </div>

          {step === "city" && (
            <div style={{ display: "grid", gap: "8px" }}>
              <small style={{ fontSize: "11.5px", color: "#586d60", fontWeight: 600 }}>اختر المدينة أو المحافظة:</small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {tree.cities.map(c => {
                  const isSelected = draftCity?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCity(c)}
                      style={{
                        padding: "9px 18px",
                        borderRadius: "10px",
                        border: isSelected ? "1.5px solid #870210" : "1px solid #d5e0d9",
                        background: isSelected ? "#870210" : "#ffffff",
                        color: isSelected ? "#ffffff" : "#2b120f",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "area" && draftCity && (
            <div style={{ display: "grid", gap: "8px" }}>
              <small style={{ fontSize: "11.5px", color: "#586d60", fontWeight: 600 }}>اختر المنطقة أو المديرية في {draftCity.name}:</small>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                {draftCity.areas.map(a => {
                  const isSelected = draftArea?.id === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectArea(a)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "10px",
                        border: isSelected ? "1.5px solid #870210" : "1px solid #d5e0d9",
                        background: isSelected ? "#870210" : "#ffffff",
                        color: isSelected ? "#ffffff" : "#2b120f",
                        fontSize: "12.5px",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "street" && draftCity && draftArea && (
            <div style={{ display: "grid", gap: "8px" }}>
              <small style={{ fontSize: "11.5px", color: "#586d60", fontWeight: 600 }}>اختر الشارع أو الحي في {draftArea.name}:</small>
              <div style={{ display: "grid", gap: "6px", maxHeight: "210px", overflowY: "auto", paddingLeft: "2px" }}>
                {draftArea.streets.map(st => {
                  const isSelected = committedCity?.id === draftCity.id && committedArea?.id === draftArea.id && committedStreet?.id === st.id;
                  const stFee = computeLocalDeliveryFee(tree, draftCity, draftArea, st, phone, subtotal);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleSelectStreet(st)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: isSelected ? "1.5px solid #870210" : "1px solid #dde6e0",
                        background: isSelected ? "#f0f7f3" : "#ffffff",
                        color: "#2b120f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        cursor: "pointer",
                        textAlign: "right",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: isSelected ? 800 : 600 }}>{st.name}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: stFee === 0 ? "#870210" : "#5a6f62" }}>
                        {stFee === 0 ? "مجاني" : formatPrice(stFee)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Checkout({ onClose, onSuccess, cart }: { onClose: () => void; onSuccess: () => void; cart: CartLine[] }) {
  const { remove } = useStore();
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const customer = useCustomer();
  const homeCatalog = trpc.commerce.catalog.home.useQuery(undefined, { staleTime: 60_000 });
  const deliveryTree = useMemo(() => readPublicDeliveryTree((homeCatalog.data?.settings as any)?.deliveryTreeConfig), [homeCatalog.data?.settings]);
  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart]);

  const defaultAddress = customer.addresses.find(address => address.isDefault) ?? customer.addresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState(defaultAddress?.id ?? "new");
  const [showExtras, setShowExtras] = useState(false);
  const [form, setForm] = useState(() => ({
    recipientName: defaultAddress?.recipientName ?? customer.name,
    phone: cleanYemeniPhone(defaultAddress?.phone ?? customer.phone),
    city: defaultAddress?.city ?? "",
    district: defaultAddress?.district ?? "",
    addressDetails: defaultAddress?.details ?? "",
    customerNote: "",
    offerCode: "",
  }));
  const items = useMemo(() => cart.map(item => ({ productId: item.id, quantity: item.quantity, name: item.name, ...(item.variant ? { variant: item.variant } : {}), ...(item.customAmount ? { customAmount: item.customAmount } : {}) })), [cart]);
  const isOnline = useOnlineStatus();
  const [orderType, setOrderType] = useState<"delivery" | "takeaway" | "dine_in">("delivery");
  const signature = JSON.stringify({ form, items, orderType });
  const keyRef = useRef<{ signature: string; key: string }>({ signature: "", key: "" });
  if (keyRef.current.signature !== signature) keyRef.current = { signature, key: getPendingOrderIdempotencyKey(signature) };
  const [quoteSignature, setQuoteSignature] = useState("");

  const handleUnavailableOrderError = (rawMsg: string) => {
    let msg = rawMsg || "تعذر إتمام الطلب.";
    if (msg.includes("Failed query:") || msg.includes("data:image/") || msg.length > 260) {
      msg = "تعذر حفظ الطلب مؤقتاً، يرجى الضغط على تأكيد الطلب مرة أخرى.";
    }
    if (msg.includes("لم يعد متوفراً") || msg.includes("لم يعد متاحًا")) {
      const removedIds = new Set<number>();
      const removedNames: string[] = [];
      msg = msg.replace(/منتج\s*#(\d+)/g, (_full, idStr) => {
        const pid = Number(idStr);
        removedIds.add(pid);
        const inCart = cart.find(c => c.id === pid);
        if (inCart && inCart.name) {
          if (!removedNames.includes(inCart.name)) removedNames.push(inCart.name);
          return inCart.name;
        }
        return "منتج #" + pid;
      });
      const m = msg.match(/«([^»]+)»/);
      if (m && m[1]) {
        const parts = m[1].split("،").map(s => s.trim()).filter(Boolean);
        for (const line of cart) {
          if (removedIds.has(line.id) || parts.some(p => line.name === p || line.name.includes(p) || p.includes(line.name))) {
            removedIds.add(line.id);
            if (!removedNames.includes(line.name)) removedNames.push(line.name);
          }
        }
      }
      for (const line of cart) {
        if (removedIds.has(line.id)) {
          remove(line.id, line.variant);
        }
      }
      if (removedNames.length > 0) {
        msg = "المنتج «" + removedNames.join("، ") + "» لم يعد متوفراً حالياً في المتجر. تم حذفه من السلة تلقائياً.";
      }
      toast.error(msg);
      void utils.commerce.catalog.home.invalidate();
      void utils.commerce.catalog.listProducts.invalidate();
      onClose();
      return;
    }
    toast.error(msg);
  };

  const quoteMutation = trpc.commerce.orders.quote.useMutation({ onError: error => handleUnavailableOrderError(error.message || "تعذر حساب ملخص الطلب.") });
  const quote = quoteSignature === signature ? quoteMutation.data : undefined;

  useEffect(() => {
    if (!items.length || (orderType === "delivery" && (!form.city || !form.district))) return;
    const timer = setTimeout(() => {
      setQuoteSignature(signature);
      quoteMutation.mutate({ items, city: orderType === "delivery" ? form.city : "استلام من البوفية", district: orderType === "takeaway" ? "استلام سفري مغلف" : orderType === "dine_in" ? "أكل محلي في البوفية" : form.district, phone: cleanYemeniPhone(form.phone), offerCode: form.offerCode || undefined, orderType } as any);
    }, 150);
    return () => clearTimeout(timer);
  }, [form.city, form.district, form.phone, form.offerCode, orderType, signature]);

  const mutation = trpc.commerce.orders.place.useMutation({
    onSuccess: result => {
      const idempotencyKey = keyRef.current.key;
      customer.rememberOrder({ orderNumber: result.orderNumber, idempotencyKey, createdAt: new Date().toISOString() });
      recordMyOrderedItems(items);
      clearPendingOrderIdempotencyKey(idempotencyKey);
      if (result.duplicate) {
        toast.info("الطلب مسجل مسبقاً برقم " + result.orderNumber + ". راجع «طلباتي».");
        onClose();
        return;
      }
      const cleanPhone = cleanYemeniPhone(form.phone);
      customer.saveProfile(form.recipientName, cleanPhone);
      const matchingAddress = customer.addresses.find(address =>
        address.city === form.city.trim() && address.district === form.district.trim() && address.details === form.addressDetails.trim(),
      );
      if (!matchingAddress) {
        customer.saveAddress({
          label: form.district.split("—").pop()?.trim() || "عنواني",
          recipientName: form.recipientName,
          phone: cleanPhone,
          city: form.city,
          district: form.district,
          details: form.addressDetails,
          isDefault: customer.addresses.length === 0,
        });
      }
      onSuccess();
      void utils.commerce.orders.trackMany.invalidate();
      toast.success("تم استلام طلبك رقم " + result.orderNumber + " بنجاح");
      onClose();
      navigate("/orders?order=" + encodeURIComponent(result.orderNumber) + "&justOrdered=1");
    },
    onError: error => { setQuoteSignature(""); quoteMutation.reset(); handleUnavailableOrderError(error.message || "تعذر إرسال الطلب. راجع البيانات وحاول مجدداً."); },
  });

  const selectAddress = (id: string) => {
    setSelectedAddressId(id);
    if (id === "new") return;
    const address = customer.addresses.find(item => item.id === id);
    if (address) {
      setForm(current => ({
        ...current,
        recipientName: address.recipientName,
        phone: cleanYemeniPhone(address.phone),
        city: address.city,
        district: address.district,
        addressDetails: address.details,
      }));
    }
  };

  const updateField = (field: keyof typeof form, value: string) => {
    const nextVal = field === "phone" ? cleanYemeniPhone(value) : value;
    setForm(current => ({ ...current, [field]: nextVal }));
    if (["recipientName", "phone", "city", "district", "addressDetails"].includes(field)) {
      setSelectedAddressId("new");
    }
  };

  const phoneValid = isValidYemeniPhone(form.phone);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isOnline) { toast.error("لا يوجد اتصال بالإنترنت حالياً — يرجى الاتصال بالإنترنت لتأكيد الطلب"); return; }
    if (mutation.isPending || quoteMutation.isPending) return;
    if (form.recipientName.trim().length < 2) {
      toast.error("يرجى إدخال اسم المستلم.");
      return;
    }
    if (!phoneValid) {
      toast.error("يرجى إدخال رقم جوال يمني صحيح مكون من 9 أرقام ويبدأ بـ 77 أو 73 أو 78 أو 71 أو 70.");
      return;
    }
    if (orderType === "delivery") {
      if (!form.city.trim() || !form.district.trim()) {
        toast.error("يرجى الضغط على حقل عنوان التوصيل واختيار المدينة والمنطقة والشارع.");
        return;
      }
      if (!form.addressDetails.trim()) {
        toast.error("يرجى كتابة أقرب معلم للعنوان.");
        return;
      }
    }
    const effCity = orderType === "delivery" ? form.city : "استلام من البوفية";
    const effDistrict = orderType === "takeaway" ? "استلام سفري مغلف" : orderType === "dine_in" ? "أكل محلي في البوفية" : form.district;
    const effDetails = orderType === "delivery" ? form.addressDetails : (orderType === "dine_in" ? ("🍽️ أكل محلي في البوفية" + (form.addressDetails ? " · " + form.addressDetails : "")) : ("🛍️ استلام سفري من البوفية" + (form.addressDetails ? " · " + form.addressDetails : "")));
    try {
      const activeQuote = quote ?? await quoteMutation.mutateAsync({ items, city: effCity, district: effDistrict, phone: cleanYemeniPhone(form.phone), offerCode: form.offerCode || undefined, orderType } as any);
      const savedPrefs = (() => { try { return (localStorage.getItem("shahezo-customer-food-prefs-v1") || "").trim(); } catch { return ""; } })();
      const combinedNote = [
        savedPrefs ? ("⭐ تفضيل العميل الدائم (" + form.recipientName.trim() + "): " + savedPrefs) : "",
        form.customerNote.trim(),
      ].filter(Boolean).join(" | ");
      mutation.mutate({
        ...form,
        city: effCity,
        district: effDistrict,
        addressDetails: effDetails,
        orderType,
        customerNote: combinedNote || undefined,
        phone: cleanYemeniPhone(form.phone),
        idempotencyKey: keyRef.current.key,
        expectedTotal: activeQuote.total,
        expectedQuoteHash: activeQuote.quoteHash,
        offerCode: form.offerCode || undefined,
        items,
      } as any);
    } catch {}
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="checkout-modal" role="dialog" aria-modal="true" style={{ maxWidth: "470px", padding: "20px", borderRadius: "18px", background: "#ffffff" }}>
        <div className="modal-heading" style={{ paddingBottom: "12px", borderBottom: "1px solid #ebefec", marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "17.5px", margin: 0, color: "#2b120f", fontWeight: 800 }}>إتمام الطلب</h2>
            <small style={{ color: "#687b6f", fontSize: "12px" }}>أدخل بيانات الاستلام واختر عنوان التوصيل</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={e => void submit(e)} className="form-stack" style={{ gap: "14px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <strong style={{ fontSize: "12px", color: "#2b120f" }}>طريقة الاستلام:</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "6px" }}>
              {[
                { id: "delivery", title: "🛵 توصيل", sub: "لباب منزلك" },
                { id: "takeaway", title: "🛍️ سفري", sub: "استلام مغلف" },
                { id: "dine_in", title: "🍽️ محلي", sub: "أكل بالبوفية" },
              ].map(opt => {
                const active = orderType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOrderType(opt.id as any)}
                    style={{
                      padding: "8px 6px",
                      borderRadius: "12px",
                      border: active ? "2px solid #870210" : "1px solid #dfd3c9",
                      background: active ? "#fceee9" : "#fcfaf8",
                      color: active ? "#870210" : "#4a352f",
                      cursor: "pointer",
                      display: "grid",
                      gap: "2px",
                      textAlign: "center",
                    }}
                  >
                    <strong style={{ fontSize: "12px", fontWeight: 900 }}>{opt.title}</strong>
                    <small style={{ fontSize: "10px", opacity: 0.85 }}>{opt.sub}</small>
                  </button>
                );
              })}
            </div>
            {orderType !== "delivery" && (
              <div style={{ padding: "8px 10px", borderRadius: "10px", background: "#fffaf5", border: "1px solid #ead8cc", fontSize: "11px", color: "#870210", fontWeight: 700 }}>
                ✓ بدون رسوم توصيل — يبدأ المطبخ بالتجهيز فور تأكيد الطلب معك هاتفياً أو عبر الواتساب.
              </div>
            )}
          </div>
          {customer.addresses.length > 0 && (
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
              {customer.addresses.map(addr => {
                const isSel = selectedAddressId === addr.id;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => selectAddress(addr.id)}
                    style={{
                      flex: "0 0 auto",
                      padding: "6px 12px",
                      borderRadius: "10px",
                      border: isSel ? "1.5px solid #870210" : "1px solid #dce4de",
                      background: isSel ? "#f0f7f3" : "#ffffff",
                      color: "#2b120f",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {addr.label} ({addr.district.replace("—", "–")})
                  </button>
                );
              })}
            </div>
          )}

          <div className="form-grid" style={{ gap: "10px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2b120f" }}>
              <span>الاسم الكامل</span>
              <input required minLength={2} maxLength={160} autoComplete="name" value={form.recipientName} onChange={event => updateField("recipientName", event.target.value)} placeholder="اسم المستلم" />
            </label>
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2b120f" }}>
              <span style={{ display: "flex", justifyContent: "space-between" }}>
                <span>رقم الهاتف</span>
                {form.phone && <small style={{ color: phoneValid ? "#870210" : "#b43c2f", fontSize: "10.5px" }}>{phoneValid ? getYemenCarrierName(form.phone) : (form.phone.length + "/9")}</small>}
              </span>
              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength={9}
                dir="ltr"
                value={form.phone}
                onChange={event => updateField("phone", event.target.value)}
                placeholder="77XXXXXXX"
                style={{ textAlign: "left", fontWeight: 700, borderColor: form.phone && !phoneValid ? "#d9534f" : undefined }}
              />
            </label>
          </div>

          {orderType === "delivery" ? (
            <>
              <ThreeStepLocationPicker
                tree={deliveryTree}
                city={form.city}
                district={form.district}
                phone={form.phone}
                subtotal={subtotal}
                onChangeLocation={(nextCity, nextDist) => {
                  setForm(curr => ({ ...curr, city: nextCity, district: nextDist }));
                  setSelectedAddressId("new");
                }}
              />

              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2b120f" }}>
                <span>أقرب معلم للعنوان</span>
                <input
                  required
                  maxLength={400}
                  autoComplete="street-address"
                  value={form.addressDetails}
                  onChange={event => updateField("addressDetails", event.target.value)}
                  placeholder="مثال: بجوار بنك الكريمي، أمام جامع..."
                />
              </label>
            </>
          ) : (
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#2b120f" }}>
              <span>{orderType === "dine_in" ? "رقم الطاولة أو وقت الحضور (اختياري)" : "وقت الحضور للاستلام (اختياري)"}</span>
              <input
                maxLength={200}
                value={form.addressDetails}
                onChange={event => updateField("addressDetails", event.target.value)}
                placeholder={orderType === "dine_in" ? "مثلاً: طاولة 3 أو سأصل بعد 10 دقائق..." : "مثلاً: سأصل للاستلام بعد 15 دقيقة..."}
              />
            </label>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowExtras(v => !v)}
              style={{ background: "none", border: "none", padding: 0, color: "#4e6658", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              {showExtras ? "إخفاء الملاحظة ورمز الخصم" : "إضافة ملاحظة أو رمز خصم (اختياري)"}
            </button>
            {showExtras && (
              <div className="form-grid" style={{ marginTop: "8px", gap: "8px" }}>
                <label style={{ fontSize: "12px" }}>ملاحظات الطلب (الشاورما / الفلافل / العصائر)<input maxLength={500} value={form.customerNote} onChange={event => updateField("customerNote", event.target.value)} placeholder="مثلاً: بدون شطة، زيادة ثوم، عصير بدون سكر..." />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "6px" }}>
                    {["🌶️ مع شطة حارة", "🚫 بدون شطة", "🧄 زيادة ثوم", "🥣 زيادة طحينة", "🥒 بدون مخلل", "🫓 خبز صاج محمص", "🧃 عصير بدون سكر", "🧊 عصير ثلج خفيف"].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => updateField("customerNote", form.customerNote ? (form.customerNote.includes(chip) ? form.customerNote : form.customerNote + " · " + chip) : chip)}
                        style={{ padding: "4px 9px", borderRadius: "99px", border: "1px solid #ead6c8", background: "#fdf6f0", color: "#870210", fontSize: "10.5px", fontWeight: 700, cursor: "pointer" }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </label>
                <label style={{ fontSize: "12px" }}>رمز الخصم<input maxLength={40} value={form.offerCode} onChange={event => updateField("offerCode", event.target.value.toUpperCase())} placeholder="الكود" dir="ltr" /></label>
              </div>
            )}
          </div>

          <section style={{ padding: "14px", borderRadius: "12px", background: "#f8faf8", border: "1px solid #e1e9e3", display: "grid", gap: "7px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#4a5e52" }}>
              <span>المجموع الفرعي ({cart.length} أصناف)</span>
              <strong>{formatPrice(quote ? quote.subtotal : subtotal)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#4a5e52" }}>
              <span>رسوم التوصيل</span>
              <strong style={{ color: quote && quote.deliveryFee === 0 ? "#870210" : "#2b120f" }}>
                {!form.city || !form.district ? "يحدد بعد اختيار العنوان" : quote ? (quote.deliveryFee === 0 ? "مجاني" : formatPrice(quote.deliveryFee)) : "..."}
              </strong>
            </div>
            {quote && quote.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#870210", fontWeight: 700 }}>
                <span>الخصم</span>
                <strong>−{formatPrice(quote.discount)}</strong>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", marginTop: "2px", borderTop: "1px solid #e2eae4" }}>
              <strong style={{ fontSize: "14px", color: "#2b120f" }}>الإجمالي</strong>
              <strong style={{ fontSize: "17px", color: "#870210", fontWeight: 800 }}>{formatPrice(quote ? quote.total : subtotal)}</strong>
            </div>
          </section>

          <div className="modal-footer" style={{ marginTop: "2px" }}>
            <button type="button" className="button button-quiet" onClick={onClose}>رجوع</button>
            {!isOnline && (
              <div style={{ width: "100%", background: "#fff4e5", border: "1px solid #f59e0b", color: "#92400e", borderRadius: "12px", padding: "10px 12px", fontSize: "12.5px", fontWeight: 700, marginBottom: "8px", textAlign: "center" }}>
                ⚠️ لا يوجد اتصال بالإنترنت حالياً — يمكنك الاحتفاظ بسلتك، وسيتم تفعيل «تأكيد الطلب» فور عودة النت.
              </div>
            )}
            <button type="submit" className="button button-primary" disabled={mutation.isPending || !isOnline} style={{ flex: 1, fontSize: "14px", fontWeight: 800, opacity: !isOnline ? 0.55 : 1 }}>
              {mutation.isPending ? <LoaderCircle className="spin" size={17} /> : null}
              {!isOnline ? "غير متصل — بانتظار الإنترنت" : mutation.isPending ? "جارٍ إرسال الطلب..." : "تأكيد الطلب"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function FavoritesPage({ allProducts = [] }: { allProducts?: PublicProduct[] }) {
  const { favoriteIds, add } = useStore();
  const [, navigate] = useLocation();
  const localMatched = useMemo(
    () => (allProducts.length > 0 ? allProducts.filter(p => favoriteIds.includes(p.id)) : []),
    [allProducts, favoriteIds]
  );
  const needRemote = favoriteIds.length > 0 && allProducts.length === 0;
  const query = trpc.commerce.catalog.productsForReorder.useQuery(
    { ids: favoriteIds },
    { enabled: needRemote, retry: 1, staleTime: 60_000 }
  );
  const products = (allProducts.length > 0 ? localMatched : (query.data ?? [])) as PublicProduct[];

  const addAllFavoritesToCart = () => {
    let count = 0;
    for (const p of products) {
      if (p.stock !== null && p.stock < (p.minQuantity || 1)) continue;
      add(p, p.minQuantity || 1);
      count += 1;
    }
    if (count > 0) toast.success(`🛒 تمت إضافة ${count} أصناف من مفضلتك إلى السلة!`);
    else toast.error("لا توجد أصناف متاحة للإضافة حالياً");
  };

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px", paddingBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #ead8cc",
          boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#f1d897", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Heart size={20} fill="currentColor" />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#2b120f" }}>قائمتي المفضلة</h1>
            <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 700 }}>
              {favoriteIds.length > 0 ? `${favoriteIds.length} وجبات وأصناف محفوظة لطلبها سريعاً` : "احتفظ بوجباتك المفضلة هنا"}
            </small>
          </div>
        </div>
        {products.length > 0 && (
          <button
            type="button"
            onClick={addAllFavoritesToCart}
            className="small-button selected"
            style={{ background: "#870210", color: "#ffffff", border: "none", padding: "8px 13px", borderRadius: "11px", fontWeight: 800, fontSize: "11.5px" }}
          >
            <ShoppingCart size={14} /> أضف الكل للسلة
          </button>
        )}
      </div>

      {needRemote && query.isLoading ? (
        <Loading />
      ) : needRemote && query.error ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : !favoriteIds.length ? (
        <div className="shahezo-empty-hero">
          <div className="shahezo-empty-icon-ring">
            <Heart size={32} strokeWidth={1.8} />
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            <strong style={{ fontSize: "17px", color: "#2b120f", fontWeight: 900 }}>قائمة المفضلة فارغة حالياً ❤️</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#6e564d", lineHeight: 1.65, maxWidth: "340px" }}>
              اضغط على رمز القلب بأعلى أي وجبة أو عصير في المتجر لحفظه هنا والوصول إليه بنقرة واحدة متى ما اشتهيته!
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "9px", width: "100%", marginTop: "4px" }}>
            <Link href="/products" className="button button-primary" style={{ flex: "1 1 160px", maxWidth: "220px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              <ShoppingBag size={16} /> استكشف قائمة الطعام
            </Link>
          </div>
        </div>
      ) : !products.length ? (
        <EmptyState icon={Heart} title="لا توجد منتجات متاحة من مفضلتك الآن" description="قد تكون المنتجات التي حفظتها أُخفيت أو نفدت." action="تصفح المنتجات" href="/products" />
      ) : (
        <div className="shahezo-card-enter">
          <ProductGrid items={products} onOpen={id => navigate("/product/" + id)} />
        </div>
      )}
    </main>
  );
}

const RATING_FACES = [
  { val: 5, emoji: "🤩", label: "رهيب" },
  { val: 4, emoji: "😊", label: "ممتاز" },
  { val: 3, emoji: "😐", label: "عادي" },
  { val: 2, emoji: "😕", label: "مقبول" },
  { val: 1, emoji: "😠", label: "سيء" },
];

function OrderRatingCard({ orderNumber, isPickup, existingRating, onRated }: { orderNumber: string; isPickup: boolean; existingRating?: any; onRated: () => void }) {
  const [driverRating, setDriverRating] = useState<number>(existingRating?.driverRating || 5);
  const [qualityRating, setQualityRating] = useState<number>(existingRating?.qualityRating || 5);
  const [tasteRating, setTasteRating] = useState<number>(existingRating?.tasteRating || 5);
  const [note, setNote] = useState<string>(existingRating?.note || "");
  const [submitted, setSubmitted] = useState<boolean>(Boolean(existingRating));

  const mut = trpc.commerce.orders.submitRating.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("شكراً لتقييمك! رأيك يهمنا لتطوير شهيزو ❤️");
      onRated();
    },
    onError: err => toast.error(err.message || "تعذر حفظ التقييم"),
  });

  if (submitted || existingRating) {
    const r = existingRating || { driverRating, qualityRating, tasteRating, note };
    const faceFor = (v: number) => RATING_FACES.find(f => f.val === v) || RATING_FACES[0];
    return (
      <div style={{ margin: "0 14px 12px", padding: "10px 12px", borderRadius: "14px", background: "#f0fdf4", border: "1px solid #bbf7d0", display: "grid", gap: "5px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
          <strong style={{ fontSize: "12px", color: "#166534" }}>⭐ شكراً لتقييمك هذا الطلب</strong>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px", fontWeight: 700, color: "#15803d" }}>
            <span>{isPickup ? "الخدمة" : "الموصل"}: {faceFor(r.driverRating).emoji} {faceFor(r.driverRating).label}</span>
            <span>· الجودة: {faceFor(r.qualityRating).emoji} {faceFor(r.qualityRating).label}</span>
            <span>· المذاق: {faceFor(r.tasteRating).emoji} {faceFor(r.tasteRating).label}</span>
          </div>
        </div>
        {r.note && <small style={{ fontSize: "11px", color: "#166534" }}>💬 «{r.note}»</small>}
      </div>
    );
  }

  const renderFaceRow = (title: string, value: number, onChange: (v: number) => void) => (
    <div style={{ display: "grid", gap: "5px" }}>
      <span style={{ fontSize: "11.5px", fontWeight: 800, color: "#2b120f" }}>{title}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "5px" }}>
        {RATING_FACES.map(f => {
          const active = value === f.val;
          return (
            <button
              key={f.val}
              type="button"
              onClick={() => onChange(f.val)}
              style={{
                padding: "6px 2px",
                borderRadius: "11px",
                border: active ? "2px solid #870210" : "1px solid #e6d7cb",
                background: active ? "#fff3eb" : "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                cursor: "pointer",
                transition: "transform 0.12s",
              }}
            >
              <span style={{ fontSize: "18px", lineHeight: 1.1 }}>{f.emoji}</span>
              <span style={{ fontSize: "9.5px", fontWeight: active ? 900 : 700, color: active ? "#870210" : "#6e564d" }}>{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ margin: "0 14px 12px", padding: "12px", borderRadius: "15px", background: "linear-gradient(135deg, #fffdf9 0%, #fff6ec 100%)", border: "1.5px solid #ead4bd", display: "grid", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ fontSize: "13px", color: "#870210", fontWeight: 900 }}>⭐ قيّم تجربتك بعد استلام الطلب</strong>
        <small style={{ fontSize: "10.5px", color: "#7a5e54" }}>بضغطة واحدة</small>
      </div>
      {renderFaceRow(isPickup ? "🤝 تقييم الخدمة والاستلام" : "🛵 تقييم الموصل", driverRating, setDriverRating)}
      {renderFaceRow("✨ تقييم الجودة والتغليف", qualityRating, setQualityRating)}
      {renderFaceRow("😋 تقييم المذاق والطعم", tasteRating, setTasteRating)}
      <input
        type="text"
        maxLength={500}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="أضف ملاحظة إن أردت (اختياري)..."
        style={{ width: "100%", padding: "8px 11px", borderRadius: "10px", border: "1px solid #e2d2c3", background: "#ffffff", fontSize: "12px" }}
      />
      <button
        type="button"
        disabled={mut.isPending}
        onClick={() => mut.mutate({ orderNumber, driverRating, qualityRating, tasteRating, note: note.trim() || undefined })}
        className="button button-primary"
        style={{ minHeight: "38px", fontSize: "12.5px", fontWeight: 900, borderRadius: "11px" }}
      >
        {mut.isPending ? "جارٍ إرسال التقييم..." : "إرسال التقييم ✓"}
      </button>
    </div>
  );
}

function OrdersPage() {
  const customer = useCustomer();
  const { add } = useStore();
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const focusedOrderNumber = searchParams.get("order");
  const refs = useMemo(() => customer.orders.slice(0, 50).map(({ orderNumber, idempotencyKey }) => ({ orderNumber, idempotencyKey })), [customer.orders]);
  const query = trpc.commerce.orders.trackMany.useQuery({ refs }, { enabled: refs.length > 0, retry: 1, staleTime: 25_000, refetchInterval: refs.length ? 45_000 : false, refetchIntervalInBackground: false });
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  const subscribe = trpc.commerce.orders.subscribeToStatus.useMutation();
  const [reorder, setReorder] = useState<Array<{ productId: number; quantity: number }> | null>(null);
  const reorderQuery = trpc.commerce.catalog.productsForReorder.useQuery({ ids: reorder?.map(item => item.productId) ?? [1] }, { enabled: Boolean(reorder), retry: 1 });
  const [expandedOrderNo, setExpandedOrderNo] = useState<string | null>(focusedOrderNumber);

  useEffect(() => {
    if (!refs.length) return;
    if (getPushPermissionState() === "default") {
      try {
        if (!localStorage.getItem("shahezo-orders-push-asked-v1")) {
          localStorage.setItem("shahezo-orders-push-asked-v1", "1");
          void requestPushPermission();
        }
      } catch {}
    }
  }, [refs.length]);

  useEffect(() => {
    if (!refs.length || getPushPermissionState() !== "granted") return;
    let active = true;
    void (async () => {
      try {
        let subscription = await getExistingBrowserPushSubscription();
        if (!subscription) {
          const key = publicKey.data ?? (await publicKey.refetch()).data;
          if (key) subscription = await ensureBrowserPushSubscription(key);
        }
        if (!subscription || !active) return;
        await subscribe.mutateAsync({ refs, subscription });
      } catch {}
    })();
    return () => { active = false; };
  }, [refs.length]);

  useEffect(() => {
    if (!reorder || !reorderQuery.data) return;
    let added = 0;
    for (const line of reorder) {
      const product = reorderQuery.data.find(candidate => candidate.id === line.productId);
      if (!product) continue;
      const minimum = product.minQuantity || 1;
      const step = product.quantityStep || 1;
      let quantity = minimum + Math.max(0, Math.floor((Math.max(minimum, line.quantity) - minimum) / step)) * step;
      if (product.stock !== null) {
        const bounded = Math.min(quantity, product.stock);
        quantity = minimum + Math.max(0, Math.floor((bounded - minimum) / step)) * step;
        if (quantity > product.stock) continue;
      }
      add(product, quantity);
      added += 1;
    }
    if (added) toast.success("🛒 أُضيفت أصناف الطلب (" + added + ") إلى السلة بنجاح!");
    else toast.error("لا توجد منتجات متاحة من هذا الطلب الآن.");
    setReorder(null);
  }, [reorder, reorderQuery.data, add]);

  const orders = useMemo(() => {
    const raw = [...(query.data ?? [])];
    raw.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return raw;
  }, [query.data]);

  useEffect(() => {
    if (orders.length > 0 && expandedOrderNo === null) {
      setExpandedOrderNo(focusedOrderNumber || orders[0].orderNumber);
    }
  }, [orders.length, focusedOrderNumber]);

  const stepOrder = ["new", "preparing", "ready", "out_for_delivery", "delivered"];
  const stepMeta: Record<string, { label: string; emoji: string }> = {
    new: { label: "تم الاستلام", emoji: "📥" },
    preparing: { label: "قيد التجهيز", emoji: "👨‍🍳" },
    ready: { label: "جاهز", emoji: "📦" },
    out_for_delivery: { label: "خرج للتوصيل", emoji: "🛵" },
    delivered: { label: "تم التسليم", emoji: "✅" },
  };

  const activeOrdersCount = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length;

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px", paddingBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #ead8cc",
          boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#f1d897", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Package size={20} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#2b120f" }}>طلباتي ومتابعة الطلب</h1>
            <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 700 }}>
              {orders.length > 0 ? `إجمالي الطلبات: ${orders.length}` + (activeOrdersCount > 0 ? ` · (${activeOrdersCount} قيد التنفيذ الآن 🔥)` : "") : "تتبع حالة طلباتك خطوة بخطوة"}
            </small>
          </div>
        </div>
        {orders.length > 0 && (
          <button
            type="button"
            onClick={() => { void query.refetch(); toast.success("تم تحديث حالة الطلبات"); }}
            className="small-button"
            style={{ background: "#fdf9f4", border: "1px solid #ead8cc", color: "#870210", fontWeight: 800 }}
          >
            🔄 تحديث الحالة
          </button>
        )}
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : !orders.length ? (
        <div className="shahezo-empty-hero">
          <div className="shahezo-empty-icon-ring">
            <Package size={32} strokeWidth={1.8} />
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            <strong style={{ fontSize: "17px", color: "#2b120f", fontWeight: 900 }}>لا توجد طلبات مسجلة بعد 📦</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#6e564d", lineHeight: 1.65, maxWidth: "340px" }}>
              بمجرد إرسال أول طلب لك من بوفية شهيزو، ستظهر فاتورته ورقمه التسلسلي ومراحل تجهيزه وتوصيله هنا لحظة بلحظة!
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "9px", width: "100%", marginTop: "4px" }}>
            <Link href="/products" className="button button-primary" style={{ flex: "1 1 160px", maxWidth: "220px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              <ShoppingBag size={16} /> اطلب وجبتك الآن
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }} className="shahezo-card-enter">
          {orders.map((order, idx) => {
            const isLatest = idx === 0;
            const isExpanded = expandedOrderNo === order.orderNumber;
            const isPickupOrder = order.city === "استلام من البوفية";
            const isDineInOrder = isPickupOrder && String(order.district || "").includes("محلي");
            const orderSteps = isPickupOrder
              ? ["new", "preparing", "ready", "delivered"]
              : stepOrder;
            const currentStepIdx = isPickupOrder && order.status === "out_for_delivery"
              ? 2
              : orderSteps.indexOf(order.status);
            const pickupAwareStatusLabel =
              isPickupOrder && (order.status === "ready" || order.status === "out_for_delivery")
                ? (isDineInOrder ? "جاهز للتقديم" : "جاهز للاستلام")
                : isDineInOrder && order.status === "delivered"
                ? "تم التقديم"
                : (stateLabels[order.status] || order.status);
            const cancelledNotes = (order.events || []).filter(ev => String(ev.note || "").startsWith("❌")).map(ev => String(ev.note || "").replace(/\s*\|\s*الإجمالي الجديد:.*$/, ""));
            const regularNotes = (order.events || []).filter(ev => ev.note && ev.note.trim() && ev.note !== "تم استلام الطلب" && !String(ev.note).startsWith("❌"));
            const latestStoreNote = regularNotes.at(-1);
            const ordAny = order as any;
            const displayOrderNo = /^\d+$/.test(String(order.orderNumber)) ? order.orderNumber : String(orders.length - idx);

            return (
              <article
                key={order.orderNumber}
                style={{
                  borderRadius: "20px",
                  background: "#ffffff",
                  border: isExpanded ? "2px solid #870210" : "1.5px solid #ead8cc",
                  boxShadow: isExpanded ? "0 10px 24px rgba(135, 2, 16, 0.07)" : "0 4px 12px rgba(43, 18, 15, 0.04)",
                  overflow: "hidden",
                  transition: "border-color 0.18s, box-shadow 0.18s",
                }}
              >
                <div
                  onClick={() => setExpandedOrderNo(isExpanded ? "" : order.orderNumber)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter") setExpandedOrderNo(isExpanded ? "" : order.orderNumber); }}
                  style={{
                    padding: "14px 16px",
                    background: isExpanded ? "linear-gradient(135deg, #fffdf9 0%, #fff5eb 100%)" : "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "grid", gap: "3px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "15px", color: "#2b120f" }}>طلب #{displayOrderNo}</strong>
                      {isLatest && (
                        <span style={{ fontSize: "10px", fontWeight: 900, padding: "2px 8px", borderRadius: "99px", background: "#870210", color: "#f1d897" }}>
                          ✨ الأحدث
                        </span>
                      )}
                      <span className={"status-pill status-" + order.status}>{pickupAwareStatusLabel}</span>
                    </div>
                    <small style={{ color: "#7a5e54", fontSize: "11px", fontWeight: 600 }}>
                      🕒 {new Date(order.createdAt).toLocaleString("ar-YE")} · {order.items.length} أصناف
                    </small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ textAlign: "left" }}>
                      <strong style={{ display: "block", fontSize: "15.5px", color: "#870210", fontWeight: 900 }}>{formatPrice(order.total)}</strong>
                      <small style={{ fontSize: "10px", color: "#870210", fontWeight: 800 }}>
                        {isExpanded ? "إخفاء التفاصيل ▴" : "عرض التفاصيل ▾"}
                      </small>
                    </div>
                  </div>
                </div>

                {(isExpanded || (isLatest && order.status !== "delivered" && order.status !== "cancelled")) && order.status !== "cancelled" && (
                  <div style={{ padding: "14px 12px", background: "#fdf9f4", borderTop: "1px solid #f2e4d8", borderBottom: isExpanded ? "1px solid #f2e4d8" : "none" }}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${orderSteps.length}, 1fr)`, gap: "6px" }}>
                      {orderSteps.map((st, sIdx) => {
                        const done = currentStepIdx >= sIdx;
                        const active = currentStepIdx === sIdx;
                        const stepLabel =
                          st === "new" ? "تم الاستلام"
                          : st === "preparing" ? (isDineInOrder ? "قيد التحضير" : "قيد التجهيز")
                          : st === "ready" ? (isPickupOrder ? (isDineInOrder ? "جاهز للتقديم" : "جاهز للاستلام") : "جاهز للتوصيل")
                          : st === "out_for_delivery" ? "خرج للتوصيل"
                          : (isDineInOrder ? "تم التقديم" : "تم التسليم");
                        const StepIcon =
                          st === "new" ? <Check size={16} strokeWidth={2.6} />
                          : st === "preparing" ? <Flame size={16} strokeWidth={2.2} />
                          : st === "ready" ? (isDineInOrder ? <UtensilsCrossed size={15} strokeWidth={2.2} /> : isPickupOrder ? <ShoppingBag size={15} strokeWidth={2.2} /> : <Package size={15} strokeWidth={2.2} />)
                          : st === "out_for_delivery" ? <Truck size={15} strokeWidth={2.2} />
                          : <CheckCircle2 size={16} strokeWidth={2.3} />;
                        return (
                          <div key={st} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                            <span
                              className={active ? "shahezo-step-dot-active" : ""}
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "50%",
                                background: active
                                  ? "linear-gradient(135deg, #870210 0%, #b91c1c 100%)"
                                  : done
                                  ? "#fceee9"
                                  : "#f2ebe4",
                                color: active ? "#f1d897" : done ? "#870210" : "#9c877f",
                                border: active ? "2px solid #f1d897" : done ? "1.5px solid #870210" : "1px solid #dfd3c8",
                                boxShadow: active ? "0 4px 12px rgba(135, 2, 16, 0.25)" : "none",
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              {StepIcon}
                            </span>
                            <div style={{ width: "100%", height: "4px", borderRadius: "99px", background: done ? "linear-gradient(90deg, #870210, #d97706)" : "#e5d9ce" }} />
                            <span style={{ fontSize: "10px", fontWeight: active ? 900 : 700, color: active ? "#870210" : done ? "#2b120f" : "#96827a", lineHeight: 1.25 }}>
                              {stepLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {order.status === "delivered" && (
                  <OrderRatingCard
                    orderNumber={order.orderNumber}
                    isPickup={isPickupOrder}
                    existingRating={ordAny.rating}
                    onRated={() => void query.refetch()}
                  />
                )}

                {isExpanded && (
                  <div style={{ padding: "14px 16px", display: "grid", gap: "11px" }}>
                    {ordAny.city && (
                      <div style={{ fontSize: "11.5px", color: "#5c433b", background: "#fffaf5", padding: "8px 11px", borderRadius: "10px", border: "1px solid #f0e0d2" }}>
                        {isPickupOrder ? (isDineInOrder ? "🍽️ " : "🛍️ ") : "📍 "}
                        <strong>{isPickupOrder ? "طريقة الاستلام:" : "عنوان التوصيل:"}</strong>{" "}
                        {isPickupOrder
                          ? (isDineInOrder ? "أكل محلي داخل البوفية" : "استلام سفري مغلف من البوفية")
                          : `${ordAny.city}${ordAny.district ? (" — " + ordAny.district) : ""}`}
                        {ordAny.addressDetails ? (" · " + ordAny.addressDetails) : ""}
                      </div>
                    )}

                    {cancelledNotes.length > 0 && (
                      <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fff6f4", border: "1px solid #f0c6be", display: "grid", gap: "4px" }}>
                        <strong style={{ fontSize: "12px", color: "#8f3225" }}>🔔 تحديث على فاتورة الطلب:</strong>
                        {cancelledNotes.map((cn, cIdx) => (
                          <div key={cIdx} style={{ fontSize: "11.5px", color: "#5e251d", lineHeight: 1.55 }}>{cn}</div>
                        ))}
                      </div>
                    )}

                    {latestStoreNote?.note && (
                      <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fff9e8", border: "1px solid #edd691", color: "#574208", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <BellRing size={15} />
                        <span>رسالة المتجر: {latestStoreNote.note}</span>
                      </div>
                    )}

                    <div style={{ padding: "10px 12px", borderRadius: "14px", background: "#fdf9f4", border: "1px solid #ead8cc", display: "grid", gap: "7px" }}>
                      <small style={{ fontSize: "11px", fontWeight: 800, color: "#6e564d" }}>🛒 تفاصيل الأصناف ({order.items.length}):</small>
                      <div style={{ display: "grid", gap: "5px" }}>
                        {order.items.map(item => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #efe2d7", fontSize: "12px" }}>
                            <span style={{ fontWeight: 700, color: "#2b120f" }}>
                              {item.productName} <strong style={{ color: "#870210" }}>× {item.quantity}</strong>
                            </span>
                            {item.lineTotal > 0 && <strong style={{ color: "#870210", fontSize: "12px" }}>{formatPrice(item.lineTotal)}</strong>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "4px" }}>
                      <div>
                        <small style={{ display: "block", fontSize: "10.5px", color: "#7a5e54" }}>
                          الفرعي: {formatPrice(order.subtotal)} · {isPickupOrder ? "بدون رسوم توصيل" : `التوصيل: ${formatPrice(order.deliveryFee)}`}
                        </small>
                        <strong style={{ fontSize: "16px", color: "#870210" }}>الإجمالي: {formatPrice(order.total)}</strong>
                      </div>
                      <button
                        type="button"
                        className="small-button selected"
                        disabled={reorderQuery.isFetching}
                        onClick={() => {
                          const validItems = order.items.filter(item => item.productId !== null).map(item => ({ productId: item.productId!, quantity: item.quantity }));
                          if (!validItems.length) { toast.error("لم تعد منتجات هذا الطلب متاحة في المتجر."); return; }
                          setReorder(validItems);
                        }}
                        style={{ padding: "8px 14px", borderRadius: "11px", fontWeight: 800, background: "#870210", color: "#ffffff", border: "none" }}
                      >
                        🔄 إعادة الطلب للسلة
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function useGuestPushSubscriptionSync() {
  const customer = useCustomer();
  const refs = useMemo(() => customer.orders.slice(0, 50).map(({ orderNumber, idempotencyKey }) => ({ orderNumber, idempotencyKey })), [customer.orders]);
  const subscribe = trpc.commerce.orders.subscribeToStatus.useMutation();
  const registerSub = trpc.commerce.notifications.registerSubscriber.useMutation();
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  useEffect(() => {
    if (getPushPermissionState() !== "granted") return;
    let active = true;
    void (async () => {
      try {
        let subscription = await getExistingBrowserPushSubscription();
        if (!subscription) {
          const key = publicKey.data ?? (await publicKey.refetch()).data;
          if (key) subscription = await ensureBrowserPushSubscription(key);
        }
        if (!subscription || !active) return;
        if (refs.length > 0) {
          await subscribe.mutateAsync({ refs, subscription });
        }
        await registerSub.mutateAsync({
          subscription,
          phone: cleanYemeniPhone(customer.phone),
          name: customer.name || "",
          orderCount: customer.orders.length,
          lastOrderAt: customer.orders[0]?.createdAt || "",
        });
      } catch {}
    })();
    return () => { active = false; };
  }, [refs.length, customer.phone, customer.name]);
}

function AccountPage({ settings = {} }: { settings?: Record<string, string | undefined> }) {
  const customer = useCustomer();
  const [, navigate] = useLocation();
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  const registerSub = trpc.commerce.notifications.registerSubscriber.useMutation();

  const deliveryTree = useMemo(() => readPublicDeliveryTree(settings?.deliveryTreeConfig), [settings?.deliveryTreeConfig]);
  const cleanedCustomerPhone = cleanYemeniPhone(customer.phone);
  const hasSavedProfile = Boolean(customer.name.trim().length >= 2 && isValidYemeniPhone(cleanedCustomerPhone));

  const [accountView, setAccountView] = useState<"main" | "addresses" | "settings">("main");
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(cleanedCustomerPhone);
  const [foodPrefs, setFoodPrefs] = useState(() => {
    try { return localStorage.getItem("shahezo-customer-food-prefs-v1") || ""; } catch { return ""; }
  });

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenBroadcastIds, setSeenBroadcastIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("shahezo-seen-broadcasts-v1");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const notificationsBoxRef = useRef<HTMLDivElement | null>(null);

  const [address, setAddress] = useState({
    label: "المنزل",
    recipientName: customer.name,
    phone: cleanedCustomerPhone,
    city: "صنعاء",
    district: "",
    details: "",
    isDefault: customer.addresses.length === 0,
  });

  useEffect(() => {
    const cp = cleanYemeniPhone(customer.phone);
    setName(customer.name);
    setPhone(cp);
  }, [customer.name, customer.phone]);

  const profilePhoneValid = isValidYemeniPhone(phone);
  const addressPhoneValid = isValidYemeniPhone(address.phone);

  const myBroadcasts = useMemo(() => {
    try {
      const raw = settings?.store_broadcasts_v1;
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      const ordCount = customer.orders.length;
      const lastAt = customer.orders[0]?.createdAt ? new Date(customer.orders[0].createdAt).getTime() : 0;
      const isInactive = ordCount >= 1 && lastAt > 0 && (Date.now() - lastAt) >= 7 * 24 * 60 * 60 * 1000;
      return list.filter((b: any) => {
        if (!b || !b.id) return false;
        if (b.segment === "all") return true;
        if (b.segment === "new_visitors") return ordCount === 0;
        if (b.segment === "returning") return ordCount >= 1;
        if (b.segment === "vip") return ordCount >= 3;
        if (b.segment === "inactive") return isInactive;
        return true;
      });
    } catch {
      return [];
    }
  }, [settings?.store_broadcasts_v1, customer.orders]);

  const unreadBroadcastCount = useMemo(
    () => myBroadcasts.filter((b: any) => !seenBroadcastIds.includes(b.id)).length,
    [myBroadcasts, seenBroadcastIds]
  );

  const toggleNotificationsDrawer = () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      const allIds = myBroadcasts.map((b: any) => b.id);
      setSeenBroadcastIds(allIds);
      try { localStorage.setItem("shahezo-seen-broadcasts-v1", JSON.stringify(allIds)); } catch {}
      setTimeout(() => notificationsBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }
  };

  const saveAccountSettings = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("يرجى كتابة الاسم الكامل.");
      return;
    }
    if (!profilePhoneValid) {
      toast.error("يرجى إدخال رقم هاتف يمني صحيح مكون من 9 أرقام (يبدأ بـ 77 أو 73 أو 78 أو 71 أو 70).");
      return;
    }
    const cleanP = cleanYemeniPhone(phone);
    customer.saveProfile(name.trim(), cleanP);
    try {
      localStorage.setItem("shahezo-customer-food-prefs-v1", foodPrefs.trim());
    } catch {}
    toast.success("تم حفظ بياناتك ومفضلاتك الدائمة بنجاح ✓");
    setAccountView("main");
  };

  const toggleFoodPrefChip = (chip: string) => {
    const parts = foodPrefs.split("،").map(s => s.trim()).filter(Boolean);
    if (parts.includes(chip)) {
      setFoodPrefs(parts.filter(p => p !== chip).join("، "));
    } else {
      setFoodPrefs([...parts, chip].join("، "));
    }
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setShowAddressForm(false);
    setAddress({
      label: "المنزل",
      recipientName: customer.name || name,
      phone: cleanYemeniPhone(customer.phone || phone),
      city: "صنعاء",
      district: "",
      details: "",
      isDefault: customer.addresses.length === 0,
    });
  };

  const openNewAddressForm = () => {
    setEditingAddressId(null);
    setAddress({
      label: "المنزل",
      recipientName: customer.name || name,
      phone: cleanedCustomerPhone || phone,
      city: "صنعاء",
      district: "",
      details: "",
      isDefault: customer.addresses.length === 0,
    });
    setShowAddressForm(true);
  };

  const submitAddress = (event: FormEvent) => {
    event.preventDefault();
    if (!addressPhoneValid) {
      toast.error("يرجى إدخال رقم هاتف يمني صحيح مكون من 9 أرقام (يبدأ بـ 77 أو 73 أو 78 أو 71 أو 70).");
      return;
    }
    if (!address.city.trim() || !address.district.trim()) {
      toast.error("يرجى اختيار منطقة التوصيل (المدينة والمنطقة والشارع).");
      return;
    }
    customer.saveAddress({
      ...address,
      phone: cleanYemeniPhone(address.phone),
      id: editingAddressId ?? undefined,
    });
    if (!hasSavedProfile && address.recipientName.trim().length >= 2) {
      customer.saveProfile(address.recipientName.trim(), cleanYemeniPhone(address.phone));
    }
    toast.success(editingAddressId ? "تم تحديث العنوان المحفوظ بنجاح ✓" : "تم حفظ العنوان الجديد بنجاح ✓");
    resetAddressForm();
  };

  const [aboutOpen, setAboutOpen] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as any).standalone);
  });
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(() => (typeof window !== "undefined" ? (window as any).__deferredPwaPrompt ?? null : null));
  const [pushPerm, setPushPerm] = useState(getPushPermissionState);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as any).standalone);
      setIsStandaloneApp(standalone);
      if (!standalone) {
        try { localStorage.removeItem("shahezo-pwa-installed-v1"); } catch {}
      }
    };
    checkStandalone();
    const onPromptReady = () => setPwaInstallPrompt((window as any).__deferredPwaPrompt ?? null);
    const onInstalled = () => { setIsStandaloneApp(true); setPwaInstallPrompt(null); };
    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const socialCfg = useMemo(() => {
    const defaults = {
      aboutTitle: "بوفية شهيزو – شهي ولذيذ",
      aboutText: "في بوفية شهيزو نحضّر لكم يومياً أشهى الشاورما، الفلافل الساخنة المقرمشة، والعصائر الطبيعية الطازجة بأجود المكونات وبأعلى معايير النظافة والطعم الأصيل مع توصيل سريع لباب منزلك.",
      whatsapp: "https://wa.me/967779542219",
      whatsapp2: "https://wa.me/967772206455",
      facebook: "https://facebook.com/shizo.ye",
      instagram: "https://instagram.com/shizo.ye",
      tiktok: "https://tiktok.com/@shizo.ye",
      phone: "779542219",
      whatsappEnabled: true,
      whatsapp2Enabled: true,
      facebookEnabled: true,
      instagramEnabled: true,
      tiktokEnabled: true,
      phoneEnabled: true,
      customIcons: [] as Array<{ id: string; label: string; url: string; imageUrl: string; enabled: boolean }>,
    };
    try {
      const raw = settings?.socialLinksConfig;
      if (!raw) return defaults;
      const p = JSON.parse(raw);
      return {
        aboutTitle: p.aboutTitle || defaults.aboutTitle,
        aboutText: p.aboutText || defaults.aboutText,
        whatsapp: p.whatsapp ?? defaults.whatsapp,
        whatsapp2: p.whatsapp2 ?? defaults.whatsapp2,
        facebook: p.facebook ?? defaults.facebook,
        instagram: p.instagram ?? defaults.instagram,
        tiktok: p.tiktok ?? defaults.tiktok,
        phone: p.phone ?? defaults.phone,
        whatsappEnabled: p.whatsappEnabled !== false,
        whatsapp2Enabled: p.whatsapp2Enabled !== false,
        facebookEnabled: p.facebookEnabled !== false,
        instagramEnabled: p.instagramEnabled !== false,
        tiktokEnabled: p.tiktokEnabled !== false,
        phoneEnabled: p.phoneEnabled !== false,
        customIcons: Array.isArray(p.customIcons) ? p.customIcons : [],
      };
    } catch {
      return defaults;
    }
  }, [settings?.socialLinksConfig]);

  const normalizeWaHref = (val: string, fallback = "https://wa.me/967779542219") => {
    const clean = (val || "").trim();
    if (!clean) return fallback;
    if (clean.startsWith("http")) return clean;
    const digits = clean.replace(/\D+/g, "");
    if (!digits) return fallback;
    return "https://wa.me/" + (digits.startsWith("967") ? digits : ("967" + digits));
  };

  const presetPrefChips = [
    "بدون سكر",
    "سكر خفيف",
    "بدون توابل",
    "مع البهارات",
    "بدون شطة",
    "شطة زيادة",
    "بدون مايونيز",
    "خبز محمص",
    "عصير بدون ثلج",
  ];

  // SUB-VIEW 1: Saved Addresses Page
  if (accountView === "addresses") {
    return (
      <main className="page-shell inner-page" style={{ paddingTop: "10px", paddingBottom: "28px" }}>
        <div className="shahezo-acc-wrap shahezo-card-enter">
          <div className="shahezo-sub-banner">
            <div style={{ display: "grid", gap: "3px" }}>
              <strong style={{ fontSize: "16.5px", fontWeight: 900, color: "#ffffff" }}>عناويني المحفوظة</strong>
              <small style={{ fontSize: "11.5px", color: "#fde8d7", fontWeight: 600 }}>إدارة عناوين التوصيل أو إضافة عنوان جديد</small>
            </div>
            <button type="button" className="shahezo-sub-back-btn" onClick={() => { resetAddressForm(); setAccountView("main"); }}>
              رجوع <ArrowLeft size={14} />
            </button>
          </div>

          {!showAddressForm ? (
            <>
              <div className="shahezo-sub-banner" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#ffffff", color: "#870210", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <MapPin size={20} />
                  </span>
                  <div style={{ display: "grid", gap: "2px" }}>
                    <strong style={{ fontSize: "14.5px", fontWeight: 900, color: "#ffffff" }}>عناوين التوصيل المحفوظة ({customer.addresses.length})</strong>
                    <small style={{ fontSize: "11px", color: "#fde8d7" }}>اختر أي عنوان محفوظ بنقرة واحدة عند تأكيد الطلب</small>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openNewAddressForm}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#ffffff",
                    color: "#870210",
                    fontSize: "12px",
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    flexShrink: 0,
                  }}
                >
                  <Plus size={15} /> إضافة عنوان
                </button>
              </div>

              {!customer.addresses.length ? (
                <div className="shahezo-acc-card" style={{ padding: "26px 16px", textAlign: "center", display: "grid", gap: "12px", justifyItems: "center" }}>
                  <MapPin size={26} color="#870210" />
                  <strong style={{ fontSize: "14px", color: "#2b120f" }}>لا توجد عناوين محفوظة حتى الآن</strong>
                  <button
                    type="button"
                    onClick={openNewAddressForm}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "14px",
                      border: "1.5px solid #e2cfc0",
                      background: "#ffffff",
                      color: "#870210",
                      fontSize: "13px",
                      fontWeight: 900,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Plus size={16} /> إضافة أول عنوان توصيل
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {customer.addresses.map(item => (
                    <div
                      key={item.id}
                      className="shahezo-acc-card"
                      style={{ padding: "14px 16px", borderColor: item.isDefault ? "#870210" : "#ead8cc", background: item.isDefault ? "#fffdf9" : "#ffffff" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong style={{ fontSize: "15px", color: "#2b120f", fontWeight: 900 }}>📍 {item.label}</strong>
                            {item.isDefault ? (
                              <span className="shahezo-acc-badge-ok">✓ الافتراضي</span>
                            ) : (
                              <button
                                type="button"
                                className="small-button"
                                style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 9px", minHeight: "24px", borderRadius: "99px", color: "#870210", borderColor: "#e6c7bc", background: "#fffaf6" }}
                                onClick={() => { customer.setDefaultAddress(item.id); toast.success("تم تعيينه كعنوان افتراضي ✓"); }}
                              >
                                تعيين كافتراضي
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: "12.5px", color: "#2b120f", fontWeight: 800 }}>
                            {item.recipientName} · <span dir="ltr" style={{ color: "#870210" }}>{cleanYemeniPhone(item.phone)}</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#6e564d", fontWeight: 600 }}>
                            {item.city} — {item.district}{item.details ? (" · " + item.details) : ""}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
                          <button
                            type="button"
                            className="small-button"
                            style={{ fontSize: "11.5px", fontWeight: 800, padding: "6px 13px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d8cbc0" }}
                            onClick={() => {
                              setEditingAddressId(item.id);
                              setAddress({
                                label: item.label,
                                recipientName: item.recipientName,
                                phone: cleanYemeniPhone(item.phone),
                                city: item.city,
                                district: item.district,
                                details: item.details,
                                isDefault: item.isDefault,
                              });
                              setShowAddressForm(true);
                            }}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: "34px", height: "34px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d8cbc0" }}
                            aria-label="حذف العنوان"
                            onClick={() => {
                              customer.removeAddress(item.id);
                              toast.success("حُذف العنوان من هذا الجهاز.");
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form className="shahezo-acc-card" onSubmit={submitAddress} style={{ padding: "16px", display: "grid", gap: "12px" }}>
              <strong style={{ fontSize: "15px", color: "#870210", fontWeight: 900 }}>
                {editingAddressId ? "تعديل عنوان التوصيل" : "إضافة عنوان توصيل جديد"}
              </strong>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["المنزل", "العمل", "منزل العائلة", "استراحة"].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    className={"shahezo-pref-chip" + (address.label === preset ? " is-selected" : "")}
                    onClick={() => setAddress({ ...address, label: preset })}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <label className="shahezo-clean-field">
                <span>تسمية العنوان *</span>
                <input required maxLength={80} className="shahezo-pill-input" value={address.label} onChange={event => setAddress({ ...address, label: event.target.value })} placeholder="المنزل، العمل..." />
              </label>

              <label className="shahezo-clean-field">
                <span>اسم المستلم *</span>
                <input required minLength={2} maxLength={160} autoComplete="name" className="shahezo-pill-input" value={address.recipientName} onChange={event => setAddress({ ...address, recipientName: event.target.value })} placeholder="الاسم الكامل للمستلم" />
              </label>

              <label className="shahezo-clean-field">
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>رقم الجوال اليمني (9 أرقام) *</span>
                  <small style={{ fontSize: "11px", fontWeight: 800, color: addressPhoneValid ? "#1e7e34" : "#b43c2f" }}>
                    {address.phone.length}/9
                  </small>
                </span>
                <input required type="tel" inputMode="numeric" maxLength={9} dir="ltr" className="shahezo-pill-input" value={address.phone} onChange={event => setAddress({ ...address, phone: cleanYemeniPhone(event.target.value) })} placeholder="77XXXXXXX" style={{ textAlign: "left" }} />
              </label>

              {deliveryTree ? (
                <div>
                  <ThreeStepLocationPicker
                    tree={deliveryTree}
                    city={address.city}
                    district={address.district}
                    phone={address.phone}
                    subtotal={0}
                    onChangeLocation={(nextCity, nextDist) => setAddress(curr => ({ ...curr, city: nextCity, district: nextDist }))}
                  />
                </div>
              ) : (
                <>
                  <label className="shahezo-clean-field">
                    <span>المدينة *</span>
                    <input required maxLength={100} className="shahezo-pill-input" value={address.city} onChange={event => setAddress({ ...address, city: event.target.value })} placeholder="صنعاء" />
                  </label>
                  <label className="shahezo-clean-field">
                    <span>المنطقة والشارع *</span>
                    <input required maxLength={120} className="shahezo-pill-input" value={address.district} onChange={event => setAddress({ ...address, district: event.target.value })} placeholder="مثلاً: معين — الرقاص" />
                  </label>
                </>
              )}

              <label className="shahezo-clean-field">
                <span>أقرب معلم للعنوان *</span>
                <input required maxLength={1000} className="shahezo-pill-input" value={address.details} onChange={event => setAddress({ ...address, details: event.target.value })} placeholder="مثال: جوار جامع... أمام بنك الكريمي..." />
              </label>

              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "12px 14px", borderRadius: "14px", background: "#fdf9f4", border: "1.5px solid #e5d2c3", cursor: "pointer" }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#2b120f" }}>تعيين كعنوان افتراضي للطلبات القادمة</span>
                <input type="checkbox" checked={address.isDefault} onChange={event => setAddress({ ...address, isDefault: event.target.checked })} style={{ width: "20px", height: "20px", accentColor: "#870210" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", paddingTop: "4px" }}>
                <button type="submit" className="button button-primary" disabled={!addressPhoneValid} style={{ borderRadius: "14px", minHeight: "46px", fontWeight: 900 }}>
                  <Check size={16} /> حفظ العنوان
                </button>
                <button type="button" className="button button-quiet" onClick={resetAddressForm} style={{ borderRadius: "14px", minHeight: "46px", fontWeight: 800, background: "#fdf9f4", border: "1.5px solid #ead8cc" }}>
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    );
  }

  // SUB-VIEW 2: Account Settings Page
  if (accountView === "settings") {
    return (
      <main className="page-shell inner-page" style={{ paddingTop: "10px", paddingBottom: "28px" }}>
        <div className="shahezo-acc-wrap shahezo-card-enter">
          <div className="shahezo-sub-banner">
            <div style={{ display: "grid", gap: "3px" }}>
              <strong style={{ fontSize: "16px", fontWeight: 900, color: "#ffffff" }}>إعدادات الحساب والبيانات الشخصية</strong>
              <small style={{ fontSize: "11.5px", color: "#fde8d7", fontWeight: 600 }}>تعديل الاسم الكامل ورقم الهاتف ومفضلاتي الدائمة</small>
            </div>
            <button type="button" className="shahezo-sub-back-btn" onClick={() => setAccountView("main")}>
              رجوع <ArrowLeft size={14} />
            </button>
          </div>

          <div className="shahezo-sub-banner" style={{ padding: "15px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <span className="shahezo-acc-user-badge" style={{ width: "48px", height: "48px", borderRadius: "50%" }}>
                <UserRound size={23} />
              </span>
              <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "15.5px", fontWeight: 900, color: "#ffffff" }}>{name.trim() || "عميل شهيزو"}</strong>
                  {hasSavedProfile && (
                    <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 9px", borderRadius: "99px", background: "#ffffff", color: "#870210" }}>
                      بيانات مكتملة ✓
                    </span>
                  )}
                </div>
                <small dir="ltr" style={{ fontSize: "12px", color: "#f1d897", fontWeight: 700, textAlign: "right" }}>
                  {phone ? `رقم الهاتف: ${phone}` : "أدخل رقم الهاتف اليمني"}
                </small>
              </div>
            </div>
          </div>

          <form className="shahezo-acc-card" onSubmit={saveAccountSettings} style={{ padding: "16px", display: "grid", gap: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "14px", color: "#870210", fontWeight: 900 }}>تحديث البيانات الشخصية</strong>
              <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 600 }}>تُحفظ تلقائياً للطلبات القادمة</small>
            </div>

            <label className="shahezo-clean-field">
              <span>الاسم الكامل *</span>
              <input required minLength={2} maxLength={160} autoComplete="name" className="shahezo-pill-input" value={name} onChange={event => setName(event.target.value)} placeholder="أدخل اسمك الكامل..." />
            </label>

            <label className="shahezo-clean-field">
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>رقم الجوال اليمني (9 أرقام) *</span>
                <small style={{ fontSize: "10.5px", fontWeight: 800, color: profilePhoneValid ? "#1e7e34" : "#b43c2f" }}>
                  {profilePhoneValid ? "✓ رقم يمني صحيح" : `${phone.length}/9 أرقام`}
                </small>
              </span>
              <input
                required
                type="tel"
                inputMode="numeric"
                maxLength={9}
                dir="ltr"
                className="shahezo-pill-input"
                value={phone}
                onChange={event => setPhone(cleanYemeniPhone(event.target.value))}
                placeholder="77XXXXXXX"
                style={{ textAlign: "left" }}
              />
            </label>

            <div className="shahezo-clean-field">
              <span>⭐ مفضلاتي الدائمة (تصل للمطعم تلقائياً مع كل طلب)</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "4px" }}>
                {presetPrefChips.map(chip => {
                  const selected = foodPrefs.split("،").map(s => s.trim()).includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      className={"shahezo-pref-chip" + (selected ? " is-selected" : "")}
                      onClick={() => toggleFoodPrefChip(chip)}
                    >
                      {selected ? `✓ ${chip}` : `+ ${chip}`}
                    </button>
                  );
                })}
              </div>
              <input
                maxLength={300}
                className="shahezo-pill-input"
                value={foodPrefs}
                onChange={e => setFoodPrefs(e.target.value)}
                placeholder="مثال: بدون سكر، بدون توابل، مع البهارات..."
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", paddingTop: "4px" }}>
              <button type="submit" className="button button-primary" disabled={name.trim().length < 2 || !profilePhoneValid} style={{ borderRadius: "14px", minHeight: "46px", fontWeight: 900 }}>
                <Check size={16} /> حفظ البيانات
              </button>
              <button type="button" className="button button-quiet" onClick={() => setAccountView("main")} style={{ borderRadius: "14px", minHeight: "46px", fontWeight: 800, background: "#fdf9f4", border: "1.5px solid #ead8cc" }}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // MAIN VIEW: AccountPage Home
  return (
    <main className="page-shell inner-page" style={{ paddingTop: "10px", paddingBottom: "28px" }}>
      <div className="shahezo-acc-wrap shahezo-card-enter">
        <section className="shahezo-acc-card">
          <div className="shahezo-acc-hero">
            <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, width: "100%" }}>
              <span className="shahezo-acc-user-badge" aria-hidden="true">
                <UserRound size={26} strokeWidth={2} />
              </span>
              <div style={{ minWidth: 0, display: "grid", gap: "4px", flex: 1 }}>
                <strong style={{ display: "block", fontSize: "17px", fontWeight: 900, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {hasSavedProfile ? `أهلاً بك ${customer.name}` : "أهلاً بك في بوفية شهيزو"}
                </strong>
                <span dir="ltr" style={{ fontSize: "13.5px", color: "#f1d897", fontWeight: 800, letterSpacing: "0.6px", textAlign: "right" }}>
                  {hasSavedProfile ? cleanedCustomerPhone : "أضف اسمك ورقمك من إعدادات الحساب"}
                </span>
                {foodPrefs.trim() !== "" && (
                  <small style={{ fontSize: "11px", color: "#fde8d7", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    ⭐ مفضلاتي: {foodPrefs}
                  </small>
                )}
              </div>
            </div>
          </div>

          <div className="shahezo-acc-connected-tabs">
            <Link href="/orders" className="shahezo-acc-connected-tab">
              <span className="shahezo-acc-tab-icon-wrap">
                <Package size={21} strokeWidth={1.9} />
              </span>
              <strong>طلباتي ({customer.orders.length})</strong>
            </Link>
            <Link href="/favorites" className="shahezo-acc-connected-tab">
              <span className="shahezo-acc-tab-icon-wrap">
                <Heart size={21} strokeWidth={1.9} />
              </span>
              <strong>المفضلة</strong>
            </Link>
            <button
              type="button"
              onClick={() => { resetAddressForm(); setAccountView("addresses"); }}
              className="shahezo-acc-connected-tab"
            >
              <span className="shahezo-acc-tab-icon-wrap">
                <MapPin size={21} strokeWidth={1.9} />
              </span>
              <strong>عناويني ({customer.addresses.length})</strong>
            </button>
            <button
              type="button"
              onClick={toggleNotificationsDrawer}
              className={"shahezo-acc-connected-tab" + (notificationsOpen ? " is-active" : "")}
            >
              <span className="shahezo-acc-tab-icon-wrap">
                <BellRing size={21} strokeWidth={1.9} />
                {unreadBroadcastCount > 0 ? (
                  <b className="shahezo-acc-tab-dot">{unreadBroadcastCount}</b>
                ) : (
                  <span style={{ position: "absolute", top: "-2px", left: "-3px", width: "7px", height: "7px", borderRadius: "50%", background: "#c95608" }} />
                )}
              </span>
              <strong>الإشعارات</strong>
            </button>
          </div>

          {notificationsOpen && (
            <div ref={notificationsBoxRef} style={{ padding: "14px 16px", background: "#fffaf5", borderTop: "1.5px solid #ead8cc", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "13.5px", color: "#870210", fontWeight: 900 }}>🔔 إشعارات وعروض بوفية شهيزو</strong>
                <button type="button" onClick={() => setNotificationsOpen(false)} style={{ background: "none", border: 0, color: "#7a5e54", fontSize: "11.5px", fontWeight: 800, cursor: "pointer" }}>
                  إغلاق ✕
                </button>
              </div>
              {!myBroadcasts.length ? (
                <div style={{ padding: "14px", borderRadius: "14px", background: "#ffffff", border: "1px dashed #dfcbbd", textAlign: "center", fontSize: "12px", color: "#6e564d", fontWeight: 600 }}>
                  لا توجد إشعارات جديدة حالياً. ستصلك هنا أحدث العروض والتنبيهات الخاصة بك من بوفية شهيزو!
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {myBroadcasts.map((b: any) => (
                    <div
                      key={b.id}
                      onClick={() => { if (b.targetUrl) navigate(b.targetUrl); }}
                      style={{ padding: "11px 13px", borderRadius: "14px", background: "#ffffff", border: "1px solid #ead8cc", cursor: b.targetUrl ? "pointer" : "default", display: "grid", gap: "4px" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "13px", color: "#2b120f", fontWeight: 900 }}>{b.title}</strong>
                        <small style={{ fontSize: "10px", color: "#870210", fontWeight: 700 }}>{new Date(b.createdAt).toLocaleDateString("ar-YE")}</small>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#5c433b", lineHeight: 1.6 }}>{b.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="shahezo-acc-card">
          <button
            type="button"
            className="shahezo-acc-row-btn"
            onClick={() => setAccountView("settings")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="shahezo-acc-sec-icon">
                <SlidersHorizontal size={18} />
              </span>
              <span style={{ display: "grid", gap: "2px" }}>
                <strong style={{ fontSize: "14px", fontWeight: 900, color: "#2b120f" }}>إعدادات الحساب</strong>
                <small style={{ fontSize: "11.5px", color: "#7a5e54", fontWeight: 600 }}>تعديل الاسم، رقم الهاتف، ومفضلاتي الدائمة مع كل طلب</small>
              </span>
            </span>
            <ChevronLeft size={17} color="#8c766e" />
          </button>

          <button
            type="button"
            className="shahezo-acc-row-btn"
            onClick={async () => {
              const perm = getPushPermissionState();
              if (perm === "unsupported") { toast.info("متصفحك لا يدعم إشعارات الويب الفورية"); return; }
              if (perm === "denied") { toast.error("الإشعارات محظورة من إعدادات المتصفح — فعّلها من أيقونة القفل بالأعلى"); return; }
              const granted = perm === "granted" ? "granted" : await requestPushPermission();
              setPushPerm(granted);
              if (granted === "granted") {
                toast.success("🔔 إشعارات الطلبات والعروض الفورية مفعّلة بنجاح!");
                try {
                  let sub = await getExistingBrowserPushSubscription();
                  if (!sub) {
                    const key = publicKey.data ?? (await publicKey.refetch()).data;
                    if (key) sub = await ensureBrowserPushSubscription(key);
                  }
                  if (sub) {
                    await registerSub.mutateAsync({
                      subscription: sub,
                      phone: cleanedCustomerPhone,
                      name: customer.name || name,
                      orderCount: customer.orders.length,
                      lastOrderAt: customer.orders[0]?.createdAt || "",
                    });
                  }
                } catch {}
              }
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="shahezo-acc-sec-icon">
                <BellRing size={18} />
              </span>
              <strong style={{ fontSize: "14px", fontWeight: 900, color: "#2b120f" }}>تفعيل إشعارات الطلبات الفورية</strong>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {pushPerm === "granted" && <span className="shahezo-acc-badge-ok">مفعّلة ✓</span>}
              <ChevronLeft size={17} color="#8c766e" />
            </span>
          </button>

          {!isStandaloneApp && (
            <button
              type="button"
              className="shahezo-acc-row-btn"
              onClick={async () => {
                const activePrompt = pwaInstallPrompt || (window as any).__deferredPwaPrompt;
                if (activePrompt) {
                  try {
                    await activePrompt.prompt();
                    const choice = await activePrompt.userChoice;
                    if (choice.outcome === "accepted") {
                      setIsStandaloneApp(true);
                      setPwaInstallPrompt(null);
                      (window as any).__deferredPwaPrompt = null;
                      toast.success("📲 جاري تثبيت تطبيق شهيزو على هاتفك!");
                    }
                    return;
                  } catch {}
                }
                toast.info("اضغط على قائمة المتصفح (⋮) بالأعلى ثم اختر «إضافة إلى الشاشة الرئيسية» لتثبيت تطبيق شهيزو");
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className="shahezo-acc-sec-icon">
                  <ShoppingBag size={18} />
                </span>
                <strong style={{ fontSize: "14px", fontWeight: 900, color: "#2b120f" }}>تثبيت تطبيق شهيزو على هاتفك</strong>
              </span>
              <ChevronLeft size={17} color="#8c766e" />
            </button>
          )}

          <div>
            <div
              onClick={() => setAboutOpen(v => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter") setAboutOpen(v => !v); }}
              className="shahezo-acc-row-btn"
              style={{ borderBottom: 0, flexWrap: "wrap", gap: "10px" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span className="shahezo-acc-sec-icon">
                  <Sparkles size={18} />
                </span>
                <strong style={{ fontSize: "14px", fontWeight: 900, color: "#2b120f" }}>من نحن وحساباتنا الرسمية</strong>
              </span>

              <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "7px" }} onClick={e => e.stopPropagation()}>
                {socialCfg.whatsappEnabled && socialCfg.whatsapp.trim() !== "" && (
                  <a href={normalizeWaHref(socialCfg.whatsapp, "https://wa.me/967779542219")} target="_blank" rel="noreferrer" aria-label="واتساب 1" title="واتساب 1" className="shahezo-wa-num-circle">
                    <MessageCircle size={16} />
                    <span className="shahezo-wa-num-tag">1</span>
                  </a>
                )}
                {socialCfg.whatsapp2Enabled && (socialCfg.whatsapp2 || "").trim() !== "" && (
                  <a href={normalizeWaHref(socialCfg.whatsapp2, "https://wa.me/967772206455")} target="_blank" rel="noreferrer" aria-label="واتساب 2" title="واتساب 2" className="shahezo-wa-num-circle">
                    <MessageCircle size={16} />
                    <span className="shahezo-wa-num-tag">2</span>
                  </a>
                )}
                {socialCfg.phoneEnabled && socialCfg.phone.trim() !== "" && (
                  <a href={"tel:" + socialCfg.phone.replace(/\s+/g, "")} aria-label="اتصال" className="shahezo-social-circle">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </a>
                )}
                {socialCfg.facebookEnabled && socialCfg.facebook.trim() !== "" && (
                  <a href={socialCfg.facebook} target="_blank" rel="noreferrer" aria-label="فيسبوك" className="shahezo-social-circle">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99C18.34 21.13 22 16.99 22 12z"/></svg>
                  </a>
                )}
                {socialCfg.instagramEnabled && socialCfg.instagram.trim() !== "" && (
                  <a href={socialCfg.instagram} target="_blank" rel="noreferrer" aria-label="إنستغرام" className="shahezo-social-circle">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  </a>
                )}
                {socialCfg.tiktokEnabled && socialCfg.tiktok.trim() !== "" && (
                  <a href={socialCfg.tiktok} target="_blank" rel="noreferrer" aria-label="تيك توك" className="shahezo-social-circle">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z"/></svg>
                  </a>
                )}
                {(socialCfg.customIcons || []).filter((ci: any) => ci && ci.enabled !== false && (ci.imageUrl || ci.label)).map((ci: any, idx: number) => (
                  <a key={ci.id || idx} href={ci.url || "#"} target={ci.url ? "_blank" : undefined} rel="noreferrer" className="shahezo-custom-social-chip">
                    {ci.imageUrl && <img src={ci.imageUrl} alt="" />}
                    {ci.label && <span>{ci.label}</span>}
                  </a>
                ))}
                <ChevronLeft size={17} color="#8c766e" onClick={() => setAboutOpen(v => !v)} />
              </span>
            </div>

            {aboutOpen && (
              <div style={{ padding: "14px 16px", background: "#fffaf5", borderTop: "1px solid #f2e5da", display: "grid", gap: "8px" }}>
                <strong style={{ fontSize: "13.5px", color: "#870210", fontWeight: 900 }}>🥙 {socialCfg.aboutTitle}</strong>
                <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.75, color: "#4e3830", fontWeight: 600 }}>{socialCfg.aboutText}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type AssistantProductLine = { productId: number; name: string; price: number; unit: string; quantity: number; stock: number | null; minQuantity: number; quantityStep: number };
type AssistantCartAction = { id: string; type: "add" | "remove"; items: AssistantProductLine[]; status: "pending" | "confirmed" | "cancelled" };
type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
  contextText?: string;
  recipe?: { name: string; servings: number; steps: string[] } | null;
  ingredients?: AssistantProductLine[];
  missingIngredients?: string[];
  recipeActionId?: string;
  recipeAdded?: boolean;
  cartAction?: AssistantCartAction;
  suggestedQuestions?: string[];
  ownerMsgId?: string;
};

const ASSISTANT_HISTORY_KEY = "shahezo-assistant-history-v1";
const CHAT_SESSION_KEY = "shahezo-chat-session-id-v1";
const SEEN_OWNER_IDS_KEY = "shahezo-seen-owner-ids-v1";

function readSeenOwnerIds(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_OWNER_IDS_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveSeenOwnerIds(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_OWNER_IDS_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {}
}

function getOrCreateChatSessionId(): string {
  try {
    let sid = localStorage.getItem(CHAT_SESSION_KEY);
    if (!sid) {
      sid = "chat-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(CHAT_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "chat-guest";
  }
}

const assistantGreeting: AssistantMessage = {
  role: "assistant",
  text: "يا هلا بك في «شهيزو – SHAHEZO»! 🥙🔥 شاورما، فلافل، وعصائر شهية ولذيذة!\nإيش تحب نجهز لك اليوم؟ فطور فلافل ساخن، ولا وجبة شاورما وعربي، ولا تشكيلة عصائر طبيعية منعشة؟",
  suggestedQuestions: [
    "🥙 فطور فلافل وساندوتشات",
    "🌯 شاورما ووجبات عربي",
    "🧃 عصائر طبيعية وكوكتيل",
    "🔥 بوكس عائلي مشكل",
  ],
};

function readAssistantHistory(): AssistantMessage[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ASSISTANT_HISTORY_KEY) ?? "null");
    if (!Array.isArray(saved)) return [assistantGreeting];
    const history = saved.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.text !== "string") return [];
      const cleanText = row.text.replace(/^(?:👨‍💼\s*)?إدارة المتجر\s*:\s*/i, "").slice(0, 1800);
      return [{
        role: row.role,
        text: cleanText,
        ...(typeof row.contextText === "string" ? { contextText: row.contextText.slice(0, 1800) } : {}),
        ...(typeof row.ownerMsgId === "string" ? { ownerMsgId: row.ownerMsgId } : {}),
        ...(row.cartAction && typeof row.cartAction === "object" ? { cartAction: row.cartAction as AssistantCartAction } : {}),
        ...(Array.isArray(row.suggestedQuestions) ? { suggestedQuestions: row.suggestedQuestions.filter((x): x is string => typeof x === "string") } : {}),
      } as AssistantMessage];
    }).slice(-32);
    return history.length ? history : [assistantGreeting];
  } catch { return [assistantGreeting]; }
}

function assistantHistoryText(message: AssistantMessage) {
  return [message.text, message.contextText].filter(Boolean).join("\n").slice(0, 1800);
}

function buildSmartPresetReply(
  query: string,
  catalog: PublicProduct[],
  categories: HomeData["categories"],
  turnIndex: number,
): { text: string; items: PublicProduct[]; suggestions: string[] } | null {
  if (!catalog.length) return null;
  const norm = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
  const q = norm(query);
  const findByKeywords = (kws: string[]) => catalog.filter(p => {
    const np = norm(p.name);
    return kws.some(k => np.includes(norm(k)));
  });
  const pickOne = (kws: string[], offset = 0): PublicProduct | null => {
    const matches = findByKeywords(kws);
    if (!matches.length) return null;
    return matches[(turnIndex + offset) % matches.length];
  };
  const uniqueProducts = (arr: Array<PublicProduct | null | undefined>) => {
    const seen = new Set<number>();
    const out: PublicProduct[] = [];
    for (const item of arr) {
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  };

  if (/(?:فطور|فلافل|صباح|طعميه|قلابه)/.test(q)) {
    const items = uniqueProducts([
      pickOne(["فلافل", "طعميه", "ساندوتش"], turnIndex),
      pickOne(["صحن فلافل", "فلافل عربي", "فول", "قلابه", "بطاط", "شيبس"], turnIndex + 1),
      pickOne(["عصير", "شاي", "برتقال", "كوكتيل", "مشروب"], turnIndex),
    ]).slice(0, 5);
    if (items.length >= 1) {
      return {
        text: "يا صباح القرمشة واللذة من شهيزو! 🥙🔥 رتبت لك «تشكيلة الفلافل والفطور الساخن» طازجة وتفتح النفس 👇\nاعتمدها للسلة فوراً أو اختر الصنف اللي يعجبك!",
        items,
        suggestions: ["🥙 تشكيلة فلافل أخرى", "🌯 شاورما ووجبات عربي", "🧃 عصائر طبيعية وكوكتيل", "عرض السلة"],
      };
    }
  }

  if (/(?:شاورما|وجبه|عربي|صاروخ|دجاج|لحم|عشاء|غداء)/.test(q)) {
    const items = uniqueProducts([
      pickOne(["شاورما", "عربي", "صاروخ", "وجبه"], turnIndex),
      pickOne(["شاورما", "ساندوتش", "فلافل", "بطاط", "شيبس"], turnIndex + 1),
      pickOne(["عصير", "كوكتيل", "مانجو", "فراوله", "بيبسي", "مشروب"], turnIndex),
      pickOne(["ثوم", "طحينه", "جبن", "صوص"], turnIndex),
    ]).slice(0, 5);
    if (items.length >= 1) {
      return {
        text: "أبشر بألذ شاورما من شهيزو! 🌯🔥 هذي «تشكيلة الشاورما والوجبات المميزة» محضرة على أصولها 👇\nتقدر تعتمدها كاملة أو تضيف أي صنف للسلة!",
        items,
        suggestions: ["🌯 تشكيلة شاورما أخرى", "🧃 عصائر طبيعية وكوكتيل", "🥙 فطور فلافل وساندوتشات", "عرض السلة"],
      };
    }
  }

  if (/(?:عصير|عصائر|كوكتيل|مشروب|بارد|منعش|طبيعي)/.test(q)) {
    const items = uniqueProducts([
      pickOne(["عصير", "كوكتيل", "مانجو", "فراوله", "برتقال", "ليمون", "افوكادو", "عوار قلب", "امبراطور"], turnIndex),
      pickOne(["عصير", "كوكتيل", "مانجو", "فراوله", "برتقال", "ليمون", "موز", "حليب"], turnIndex + 1),
      pickOne(["عصير", "كوكتيل", "رمان", "جوافه", "بطيخ", "شمام"], turnIndex + 2),
    ]).slice(0, 5);
    if (items.length >= 1) {
      return {
        text: "انتعاش طبيعي 100% من شهيزو! 🧃🍓 اخترت لك «تشكيلة العصائر الطبيعية والكوكتيلات الباردة» 👇",
        items,
        suggestions: ["🧃 تشكيلة عصائر أخرى", "🌯 شاورما ووجبات عربي", "🥙 فطور فلافل وساندوتشات", "عرض السلة"],
      };
    }
  }

  if (/(?:بوكس|عائلي|مشكل|لمه|جمعه|سهره|تشكيله)/.test(q)) {
    const items = uniqueProducts([
      pickOne(["بوكس", "عائلي", "عربي", "شاورما"], turnIndex),
      pickOne(["صحن", "فلافل", "شاورما", "وجبه"], turnIndex + 1),
      pickOne(["بطاط", "شيبس", "مقبلات", "حمص", "متبل"], turnIndex),
      pickOne(["عصير", "لتر", "كوكتيل", "مانجو"], turnIndex),
    ]).slice(0, 6);
    if (items.length >= 1) {
      return {
        text: "أحلى لمة مع شهيزو! 🔥🍱 رتبت لك «البوكس العائلي المشكل (شاورما + فلافل + عصائر)» يكفي ويوفي 👇",
        items,
        suggestions: ["🔥 بوكس عائلي آخر", "🌯 شاورما ووجبات عربي", "🧃 عصائر طبيعية وكوكتيل", "عرض السلة"],
      };
    }
  }

  const matchedCategory = categories.find(c => norm(c.name) === q.replace(/^[^\p{L}\p{N}]+/gu, "").trim());
  if (matchedCategory) {
    const catProds = catalog.filter(p => p.categoryId === matchedCategory.id);
    if (catProds.length > 0) {
      const start = (turnIndex * 4) % catProds.length;
      const rotated = [...catProds.slice(start), ...catProds.slice(0, start)].slice(0, 5);
      return {
        text: "يا هلا بك! اخترت لك 5 أصناف مميزة وطازجة من قسم «" + matchedCategory.name + "» 👇\nتقدر تضيف أي صنف بمفرده أو تضغط لعرض دفعة أخرى من القسم:",
        items: rotated,
        suggestions: ["🔄 عرض المزيد من " + matchedCategory.name, "🥙 فطور فلافل وساندوتشات", "🌯 شاورما ووجبات عربي", "عرض السلة"],
      };
    }
  }
  if (q.startsWith(norm("🔄 عرض المزيد من "))) {
    const catName = q.replace(norm("🔄 عرض المزيد من "), "").trim();
    const mc = categories.find(c => norm(c.name).includes(catName) || catName.includes(norm(c.name)));
    if (mc) {
      const catProds = catalog.filter(p => p.categoryId === mc.id);
      const start = ((turnIndex + 1) * 5) % Math.max(1, catProds.length);
      const rotated = [...catProds.slice(start), ...catProds.slice(0, start)].slice(0, 5);
      return {
        text: "تفضل يا غالي! هذي دفعة ثانية من أصناف قسم «" + mc.name + "» 👇",
        items: rotated,
        suggestions: ["🔄 عرض المزيد من " + mc.name, "🌯 شاورما ووجبات عربي", "🧃 عصائر طبيعية وكوكتيل", "عرض السلة"],
      };
    }
  }

  return null;
}

function AssistantPage() {
  const { add, cart, setQuantity, favoriteIds } = useStore();
  const homeCatalog = trpc.commerce.catalog.home.useQuery();
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState<string>(getOrCreateChatSessionId);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>(readAssistantHistory);
  const messagesRef = useRef<HTMLDivElement>(null);
  const appliedActionsRef = useRef(new Set<string>());
  const turnCounterRef = useRef<number>(Math.floor(Math.random() * 10));
  const seenOwnerIdsRef = useRef<Set<string>>(readSeenOwnerIds());
  const retryRef = useRef<{ request: string; history: Array<{ role: "user" | "assistant"; text: string }> } | null>(null);
  const mutation = trpc.commerce.assistant.recipe.useMutation();

  useEffect(() => {
    for (const m of messages) {
      if (m.ownerMsgId) seenOwnerIdsRef.current.add(m.ownerMsgId);
    }
    saveSeenOwnerIds(seenOwnerIdsRef.current);
  }, []);

  const pollQuery = trpc.commerce.assistant.pollMessages.useQuery(
    { sessionId },
    { refetchInterval: 2500, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, retry: false }
  );

  useEffect(() => {
    const ownerMsgs = pollQuery.data?.ownerMessages;
    if (!ownerMsgs || !ownerMsgs.length) return;
    setMessages(current => {
      const existingInState = new Set(current.map(m => m.ownerMsgId).filter(Boolean));
      const unseen = ownerMsgs.filter(m => m.id && !existingInState.has(m.id) && !seenOwnerIdsRef.current.has(m.id));
      if (!unseen.length) return current;
      for (const m of unseen) seenOwnerIdsRef.current.add(m.id);
      saveSeenOwnerIds(seenOwnerIdsRef.current);
      toast.success("💬 وصلتك رسالة جديدة من إدارة المتجر!");
      return [
        ...current,
        ...unseen.map(m => ({
          role: "assistant" as const,
          text: m.text.replace(/^(?:👨‍💼\s*)?إدارة المتجر\s*:\s*/i, "").trim(),
          ownerMsgId: m.id,
        })),
      ].slice(-32);
    });
  }, [pollQuery.data, pollQuery.dataUpdatedAt]);

  const displayedMessages = messages;

  useEffect(() => {
    const saved = displayedMessages.slice(-32).map(message => ({
      role: message.role,
      text: message.text,
      ...(message.contextText ? { contextText: message.contextText } : {}),
      ...(message.ownerMsgId ? { ownerMsgId: message.ownerMsgId } : {}),
      ...(message.cartAction ? { cartAction: message.cartAction } : {}),
      ...(message.suggestedQuestions?.length ? { suggestedQuestions: message.suggestedQuestions } : {}),
    }));
    try { localStorage.setItem(ASSISTANT_HISTORY_KEY, JSON.stringify(saved)); } catch {}
  }, [displayedMessages]);

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [displayedMessages.length, mutation.isPending]);

  const startNewConversation = () => {
    if (mutation.isPending) return;
    retryRef.current = null;
    appliedActionsRef.current.clear();
    setInput("");
    const newSid = "chat-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem(CHAT_SESSION_KEY, newSid);
      localStorage.removeItem(ASSISTANT_HISTORY_KEY);
    } catch {}
    setSessionId(newSid);
    setMessages([assistantGreeting]);
  };

  const updateActionStatus = (actionId: string, status: "confirmed" | "cancelled") => {
    setMessages(current => current.map(message => {
      if (message.cartAction?.id === actionId) {
        return { ...message, cartAction: { ...message.cartAction, status }, contextText: (message.contextText ?? message.text) + "\nحالة طلب السلة: " + (status === "confirmed" ? "أكد العميل التغيير" : "رفض العميل التغيير") + "." };
      }
      return message;
    }));
  };

  const addSingleAssistantItem = (item: AssistantProductLine) => {
    const current = cart.find(line => line.id === item.productId);
    const qty = item.quantity || item.minQuantity || 1;
    const total = (current?.quantity ?? 0) + qty;
    if (item.stock !== null && total > item.stock) {
      toast.error("الكمية المطلوبة غير متوفرة حالياً في المخزون.");
      return;
    }
    add({ id: item.productId, name: item.name, price: item.price, unit: item.unit, stock: item.stock, minQuantity: item.minQuantity, quantityStep: item.quantityStep }, qty);
    toast.success("تمت إضافة «" + item.name + "» إلى السلة بنجاح 🛒");
  };

  const applyConfirmedChange = (actionId: string, type: "add" | "remove", items: AssistantProductLine[]) => {
    if (appliedActionsRef.current.has(actionId)) return;
    appliedActionsRef.current.add(actionId);
    let changed = 0;
    let skipped = 0;
    for (const item of items) {
      const current = cart.find(line => line.id === item.productId);
      if (type === "add") {
        const total = (current?.quantity ?? 0) + item.quantity;
        if (item.stock !== null && total > item.stock) { skipped += 1; continue; }
        add({ id: item.productId, name: item.name, price: item.price, unit: item.unit, stock: item.stock, minQuantity: item.minQuantity, quantityStep: item.quantityStep }, item.quantity);
        changed += 1;
      } else {
        if (!current) { skipped += 1; continue; }
        setQuantity(item.productId, Math.max(0, current.quantity - item.quantity));
        changed += 1;
      }
    }
    updateActionStatus(actionId, "confirmed");
    if (changed) toast.success(type === "add" ? "تم اعتماد وإضافة " + changed + " صنف إلى السلة بنجاح 🛒" : "تم حذف " + changed + " صنف من السلة.");
    if (skipped) toast.error("تغيّرت السلة أو الكمية المتاحة؛ راجع السلة قبل إتمام الطلب.");
  };

  const cancelCartChange = (actionId: string) => {
    if (appliedActionsRef.current.has(actionId)) return;
    appliedActionsRef.current.add(actionId);
    updateActionStatus(actionId, "cancelled");
    toast("تم إلغاء الإضافة للسلة.");
  };

  const sendText = (rawText: string, _prevAssistantText = "") => {
    const trimmed = rawText.trim();
    if (mutation.isPending || !trimmed) return;

    if (/^(?:عرض السلة|السلة|شوف السلة|تأكيد الطلب|إتمام الطلب|اتمام الطلب|سلة المشتريات|إنهاء الطلب|انهاء الطلب)$/i.test(trimmed)) {
      navigate("/cart");
      return;
    }
    if (/^(?:تصفح الأقسام|عرض الأصناف|عرض القائمة|الأقسام)$/i.test(trimmed)) {
      navigate("/categories");
      return;
    }
    if (/^(?:تصفح المنتجات|تصفح المتجر|كل المنتجات)$/i.test(trimmed)) {
      navigate("/products");
      return;
    }

    const catalogProducts: PublicProduct[] = (homeCatalog.data?.products ?? []) as PublicProduct[];
    const catalogCategories = (homeCatalog.data?.categories ?? []) as HomeData["categories"];
    turnCounterRef.current += 1;

    // Dynamic AI conversation handled by invokeLLM
    const preset = null;

    const norm = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
    const cleanTarget = norm(trimmed.replace(/^(?:أضف|اضف|إضافة|اضافة|اريد|أريد|ابغى|أبغى|عطني|أعطني|اعطني)\s+/i, ""));
    const matchedProd = catalogProducts.find(p => {
      const np = norm(p.name);
      return cleanTarget.length >= 3 && (np === cleanTarget || (trimmed.startsWith("أضف") && (np.includes(cleanTarget) || cleanTarget.includes(np))));
    });

    if (matchedProd && trimmed.length <= 40) {
      const qty = matchedProd.minQuantity || 1;
      const actId = "act-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      setInput("");
      setMessages(current => [
        ...current,
        { role: "user" as const, text: trimmed },
        {
          role: "assistant" as const,
          text: "جهزت لك «" + matchedProd.name + "» (" + formatPrice(matchedProd.price) + ") في البطاقة بالأسفل 👇 اضغط «✅ اعتمد الإضافة»:",
          cartAction: {
            id: actId,
            type: "add" as const,
            status: "pending" as const,
            items: [{
              productId: matchedProd.id,
              name: matchedProd.name,
              price: matchedProd.price,
              unit: matchedProd.unit,
              quantity: qty,
              stock: matchedProd.stock,
              minQuantity: matchedProd.minQuantity,
              quantityStep: matchedProd.quantityStep,
            }],
          },
          suggestedQuestions: ["🥙 فطور فلافل وساندوتشات", "🌯 شاورما ووجبات عربي", "عرض السلة"],
        },
      ].slice(-32));
      return;
    }

    const updatedCart = cart.map(line => ({ productId: line.id, quantity: line.quantity }));
    const history = displayedMessages
      .filter(m => !m.ownerMsgId && !m.text.includes("إدارة المتجر"))
      .slice(-4)
      .map(message => ({ role: message.role, text: assistantHistoryText(message) }));
    setMessages(current => [...current, { role: "user" as const, text: trimmed }].slice(-32));
    retryRef.current = { request: trimmed, history };
    setInput("");

    let cName = "";
    let cPhone = "";
    try {
      const d = JSON.parse(localStorage.getItem("shahezo-customer-browser-v1") || "{}");
      cName = d.name || d.addresses?.[0]?.recipientName || "";
      cPhone = d.phone || d.addresses?.[0]?.phone || "";
    } catch {}

    mutation.mutate({
      request: trimmed,
      history,
      cart: updatedCart,
      favoriteProductIds: favoriteIds,
      sessionId,
      customerName: cName,
      customerPhone: cPhone,
    }, {
      onSuccess: (result: any) => {
        retryRef.current = null;
        void pollQuery.refetch();
        let pendingAction: AssistantCartAction | undefined = undefined;
        if (result.cartAction && (result.cartAction.type === "add" || result.cartAction.type === "remove") && Array.isArray(result.cartAction.items) && result.cartAction.items.length > 0) {
          pendingAction = {
            id: "act-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            type: result.cartAction.type,
            items: result.cartAction.items,
            status: "pending",
          };
        } else if (Array.isArray(result.ingredients) && result.ingredients.length > 0) {
          pendingAction = {
            id: "act-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
            type: "add",
            items: result.ingredients,
            status: "pending",
          };
        }
        const cleanReply = String(result.message || "")
          .replace(/^(?:👨‍💼\s*)?إدارة المتجر\s*:\s*/i, "")
          .replace(/\[\s*(?:أضف|اضف|إضافة|اضافة|add|مقادير|سلة)\s*:[^\]]+\]/gi, "")
          .trim();
        setMessages(current => [...current, {
          role: "assistant" as const,
          text: cleanReply,
          recipe: result.recipe,
          ingredients: result.ingredients,
          missingIngredients: result.missingIngredients,
          cartAction: pendingAction,
          suggestedQuestions: Array.isArray(result.suggestedQuestions) ? result.suggestedQuestions : [],
        }].slice(-32));
      },
      onError: () => {
        toast.error("يرجى المحاولة مرة أخرى.");
        setInput(trimmed);
      },
    });
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    sendText(input);
  };

  return (
    <main className="page-shell inner-page assistant-page">
      <section className="chat-panel">
        <div className="chat-head">
          <span className="chat-avatar"><Sparkles size={17} /></span>
          <div><strong>مساعد وشيف شهيزو الذكي 🥙</strong><small>شاورما · فلافل ساخنة · عصائر طبيعية · بوكسات</small></div>
          <span className="online-dot" />
          <button type="button" className="assistant-new-chat" disabled={mutation.isPending} onClick={startNewConversation}>محادثة جديدة</button>
        </div>
        <div className="chat-messages" ref={messagesRef}>
          {displayedMessages.map((message, index) => {
            const totalActionPrice = message.cartAction?.items.reduce((s, it) => s + it.price * it.quantity, 0) ?? 0;
            return (
              <div key={index + "-" + message.role + "-" + (message.ownerMsgId || "")} className={"chat-message " + (message.role === "user" ? "from-user" : "from-assistant")} style={message.ownerMsgId ? { border: "1.5px solid #e0a800", background: "#fffdf5" } : undefined}>
                {message.ownerMsgId && (
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#9a6700", marginBottom: "4px", paddingBottom: "4px", borderBottom: "1px solid #f2e2a8" }}>
                    👨‍💼 رد مباشر من إدارة المتجر
                  </div>
                )}
                <p style={{ whiteSpace: "pre-line", margin: 0, lineHeight: 1.65 }}>{message.text}</p>
                {message.cartAction && message.cartAction.items.length > 0 && (
                  <div style={{ marginTop: "10px", padding: "11px 12px", borderRadius: "14px", background: "#f3faf6", border: "1.5px solid #b8dec8", boxShadow: "0 4px 12px rgba(15, 60, 40, 0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 800, color: "#123b2a", marginBottom: "8px" }}>
                      <span>{message.cartAction.items.length > 1 ? "🛒 الأصناف والمقادير المقترحة للسلة:" : "🛒 تأكيد إضافة الصنف للسلة:"}</span>
                      <span style={{ color: "#870210", background: "#fceee9", padding: "2px 8px", borderRadius: "99px", fontSize: "11px" }}>الإجمالي: {formatPrice(totalActionPrice)}</span>
                    </div>
                    <div style={{ display: "grid", gap: "6px", marginBottom: "10px" }}>
                      {message.cartAction.items.map(item => (
                        <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "6px 9px", borderRadius: "10px", background: "#ffffff", border: "1px solid #dfece4", fontSize: "11.5px", color: "#1e3f2f" }}>
                          <div>
                            <strong>{item.name}</strong>
                            <small style={{ display: "block", color: "#5c7467", fontSize: "10.5px" }}>{item.quantity} × {formatPrice(item.price)} ({item.unit})</small>
                          </div>
                          <button
                            type="button"
                            onClick={() => addSingleAssistantItem(item)}
                            style={{ padding: "5px 10px", borderRadius: "8px", border: "1px solid #870210", background: "#fdf6f0", color: "#870210", fontSize: "11px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            + أضف بمفرده
                          </button>
                        </div>
                      ))}
                    </div>
                    {message.cartAction.status === "pending" ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => applyConfirmedChange(message.cartAction!.id, message.cartAction!.type, message.cartAction!.items)}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", border: "none", background: "#870210", color: "#ffffff", fontSize: "12px", fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 10px rgba(135, 2, 16, 0.2)" }}
                        >
                          {message.cartAction.items.length > 1 ? ("✅ اعتمد وإضافة الكل للسلة (" + formatPrice(totalActionPrice) + ")") : ("✅ نعم، اعتمد الإضافة للسلة (" + formatPrice(totalActionPrice) + ")")}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelCartChange(message.cartAction!.id)}
                          style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", fontWeight: 800, color: message.cartAction.status === "confirmed" ? "#15803d" : "#64748b" }}>
                        <span>{message.cartAction.status === "confirmed" ? "✅ تمت الإضافة إلى السلة بنجاح!" : "تم إلغاء الإضافة"}</span>
                        {message.cartAction.status === "confirmed" && (
                          <button type="button" onClick={() => navigate("/cart")} style={{ padding: "4px 10px", borderRadius: "8px", border: "none", background: "#870210", color: "#fff", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>
                            فتح السلة 🛒
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {message.role === "assistant" && message.text.includes("770731619") && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText("770731619");
                        toast.success("تم نسخ رقم المالك 770731619 بنجاح!");
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", border: "1px solid #0f5c3a", background: "#fdf6f0", color: "#0f5c3a", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      <Copy size={13} /> نسخ الرقم: 770731619
                    </button>
                    <a
                      href="tel:770731619"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "10px", border: "1px solid #d5e6dc", background: "#ffffff", color: "#0f5c3a", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}
                    >
                      📞 اتصال مباشر
                    </a>
                  </div>
                )}
                {message.role === "assistant" && message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "9px" }}>
                    {message.suggestedQuestions.map((q, qIdx) => (
                      <button
                        key={qIdx}
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => sendText(q, message.text)}
                        style={{ padding: "6px 12px", borderRadius: "999px", border: "1px solid #cfe2d6", background: "#f3f9f5", color: "#0f5c3a", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {mutation.isPending && (
            <div className="chat-message from-assistant" style={{ opacity: 0.75 }}>
              <p>يجهز لك الرد والاقتراحات الآن...</p>
            </div>
          )}
        </div>
        <form className="chat-input" onSubmit={send}>
          <input maxLength={1200} value={input} onChange={event => setInput(event.target.value)} placeholder="اطلب شاورما، فلافل، عصير طبيعي، أو بوكس عائلي..." aria-label="رسالة للمساعد" disabled={mutation.isPending} />
          <button disabled={mutation.isPending || !input.trim()} aria-label="إرسال"><ArrowLeft size={18} /></button>
        </form>
      </section>
    </main>
  );
}

function Loading() { return <div className="loading-state"><LoaderCircle size={22} className="spin" /><span>لحظة، نحدّث المعلومات...</span></div>; }
function LoadError({ onRetry }: { onRetry: () => void }) { return <div className="error-state"><span className="error-symbol">!</span><strong>تعذر تحميل البيانات</strong><p>تحقق من اتصالك ثم حاول مجددًا. لم نفترض وجود بيانات غير مؤكدة.</p><button className="button button-outline" onClick={onRetry}>إعادة المحاولة</button></div>; }

function shouldShowFooterDescription(description: string | null | undefined) {
  const text = description?.trim().replace(/\s+/g, " ");
  if (!text) return false;
  return text !== "كل ماتحتاجه باب بيتك بضغطه زر" && text !== "كل ما تحتاجه باب بيتك بضغطه زر";
}

type StoreRewardCfg = {
  rewardMode: "custom_gift" | "free_delivery" | "discount_percent" | "discount_fixed";
  giftName: string;
  fixedDiscount: number;
  endsAt: string;
  audience: "all" | "new_customers" | "returning_customers" | "vip_customers" | "specific_phones";
  allowedPhones: string;
  placement: "everywhere" | "home_and_cart" | "cart_only";
};

function unpackStoreRewardCfg(rawMsg?: string | null, fallbackType?: string): { cleanMessage: string; cfg: StoreRewardCfg } {
  const defaultCfg: StoreRewardCfg = {
    rewardMode: fallbackType === "discount_percent" ? "discount_percent" : "free_delivery",
    giftName: "",
    fixedDiscount: 0,
    endsAt: "",
    audience: "all",
    allowedPhones: "",
    placement: "everywhere",
  };
  const raw = String(rawMsg || "");
  const match = raw.match(/\[\[rcfg:(\{[\s\S]*?\})\]\]/);
  if (!match) return { cleanMessage: raw.trim(), cfg: defaultCfg };
  try {
    const parsed = JSON.parse(match[1]);
    const cleanMessage = (raw.slice(0, match.index) + raw.slice((match.index || 0) + match[0].length)).trim();
    return {
      cleanMessage,
      cfg: {
        rewardMode: ["custom_gift", "free_delivery", "discount_percent", "discount_fixed"].includes(parsed.rewardMode) ? parsed.rewardMode : defaultCfg.rewardMode,
        giftName: typeof parsed.giftName === "string" ? parsed.giftName.trim() : "",
        fixedDiscount: Number.isFinite(Number(parsed.fixedDiscount)) ? Math.max(0, Math.floor(Number(parsed.fixedDiscount))) : 0,
        endsAt: typeof parsed.endsAt === "string" ? parsed.endsAt.trim() : "",
        audience: ["all", "new_customers", "returning_customers", "vip_customers", "specific_phones"].includes(parsed.audience) ? parsed.audience : "all",
        allowedPhones: typeof parsed.allowedPhones === "string" ? parsed.allowedPhones.trim() : "",
        placement: ["everywhere", "home_and_cart", "cart_only"].includes(parsed.placement) ? parsed.placement : "everywhere",
      },
    };
  } catch {
    return { cleanMessage: raw.trim(), cfg: defaultCfg };
  }
}

function formatCountdownLeft(ms: number): string {
  if (ms <= 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return days + " يوم و " + pad(hrs) + ":" + pad(mins) + ":" + pad(secs);
  return pad(hrs) + ":" + pad(mins) + ":" + pad(secs);
}

function GamifiedRewardBar({ settings, location }: { settings: Record<string, string | undefined>; location: string }) {
  const { cart } = useStore();
  const customer = useCustomer();
  const [, navigate] = useLocation();
  const enabled = settings?.rewardEnabled === "true";
  const threshold = Number(settings?.rewardsThreshold || 0);
  const { cleanMessage, cfg } = useMemo(() => unpackStoreRewardCfg(settings?.rewardsMessage, settings?.rewardType), [settings?.rewardsMessage, settings?.rewardType]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !cfg.endsAt) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled, cfg.endsAt]);

  if (!enabled || !Number.isFinite(threshold) || threshold <= 0) return null;

  const endMs = cfg.endsAt ? new Date(cfg.endsAt).getTime() : 0;
  if (endMs && Number.isFinite(endMs) && nowMs > endMs) return null;
  const countdownText = endMs && Number.isFinite(endMs) ? formatCountdownLeft(endMs - nowMs) : "";

  const orderCount = customer.orders?.length || 0;
  if (cfg.audience === "new_customers" && orderCount > 0) return null;
  if (cfg.audience === "returning_customers" && orderCount < 1) return null;
  if (cfg.audience === "vip_customers" && orderCount < 3) return null;
  if (cfg.audience === "specific_phones") {
    const allowed = cfg.allowedPhones.split(/[\s,،;]+/).map(s => s.replace(/\D/g, "")).filter(Boolean);
    const myPhones = [customer.phone, ...(customer.addresses || []).map(a => a.phone)].map(s => String(s || "").replace(/\D/g, "")).filter(Boolean);
    const matched = allowed.some(ap => myPhones.some(mp => mp.endsWith(ap) || ap.endsWith(mp)));
    if (!matched) return null;
  }

  const isHome = location === "/";
  const isCart = location === "/cart";
  const isCatalog = location.startsWith("/products") || location.startsWith("/categories") || location.startsWith("/product/");
  const showMainCard =
    cfg.placement === "everywhere" ? (isHome || isCart || isCatalog) :
    cfg.placement === "home_and_cart" ? (isHome || isCart) :
    isCart;

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const remaining = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, Math.max(0, Math.round((subtotal / threshold) * 100)));
  const unlocked = subtotal >= threshold;

  const giftLabel = cfg.giftName || (
    cfg.rewardMode === "free_delivery" ? "توصيل مجاني بالكامل 🛵" :
    cfg.rewardMode === "discount_percent" ? ("خصم فوري " + (settings?.rewardValue || "10") + "% 🏷️") :
    cfg.rewardMode === "discount_fixed" ? ("خصم نقدي " + formatPrice(cfg.fixedDiscount || Number(settings?.rewardValue || 0)) + " 💸") :
    "هدية مجانية من شهيزو 🎁"
  );

  const headline = unlocked
    ? ("🎉 مبروك! فتحت الهدية: «" + giftLabel + "» — تُضاف تلقائياً مع طلبك!")
    : subtotal === 0
    ? ("🎁 عرض حماسي! تسوّق بقيمة " + formatPrice(threshold) + " واحصل فوراً على «" + giftLabel + "»")
    : pct >= 60
    ? ("⚡ اقتربت جداً! باقي لك " + formatPrice(remaining) + " فقط لتربح «" + giftLabel + "»!")
    : ("🔥 أضف منتجات بقيمة " + formatPrice(remaining) + " لفتح الهدية: «" + giftLabel + "»");

  const showFloatingMini = cfg.placement === "everywhere" && !isCart && subtotal > 0 && !location.startsWith("/assistant") && !location.startsWith("/orders") && !location.startsWith("/account");

  return (
    <>
      {showMainCard && (
        <div className="page-shell" style={{ paddingTop: "10px", paddingBottom: "4px" }}>
          <section
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "20px",
              padding: "14px 16px",
              background: unlocked
                ? "linear-gradient(135deg, #870210 0%, #b8332a 55%, #b5851f 100%)"
                : "linear-gradient(135deg, #5e010b 0%, #870210 60%, #5e010b 100%)",
              color: "#ffffff",
              border: unlocked ? "2px solid #f7dc8b" : "1.5px solid rgba(241, 216, 151, 0.45)",
              boxShadow: unlocked ? "0 14px 32px rgba(135, 2, 16, 0.28)" : "0 10px 24px rgba(94, 1, 11, 0.18)",
              transition: "all 0.35s ease",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 220px" }}>
                <span
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "12px",
                    background: unlocked ? "#f7dc8b" : "rgba(241, 216, 151, 0.18)",
                    color: unlocked ? "#5e010b" : "#f7dc8b",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "19px",
                    flexShrink: 0,
                    boxShadow: unlocked ? "0 4px 14px rgba(247, 220, 139, 0.45)" : "none",
                  }}
                >
                  {unlocked ? "🏆" : "🎁"}
                </span>
                <div style={{ lineHeight: 1.4 }}>
                  <strong style={{ display: "block", fontSize: "13px", color: "#fff9e6" }}>{headline}</strong>
                  {cleanMessage && <small style={{ display: "block", fontSize: "11px", color: "#d7ecdf", opacity: 0.95 }}>{cleanMessage}</small>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                {countdownText && (
                  <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "3px 9px", borderRadius: "99px", background: "rgba(0,0,0,0.28)", color: "#ffe596", border: "1px solid rgba(255,229,150,0.35)" }} dir="ltr">
                    ⏳ {countdownText}
                  </span>
                )}
                <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 10px", borderRadius: "99px", background: unlocked ? "#f7dc8b" : "rgba(255,255,255,0.14)", color: unlocked ? "#5e010b" : "#f7dc8b" }}>
                  {unlocked ? "مكتمل 100% ✨" : (pct + "%")}
                </span>
              </div>
            </div>

            <div style={{ height: "11px", borderRadius: "99px", background: "rgba(255,255,255,0.16)", padding: "2px", overflow: "hidden" }}>
              <div
                style={{
                  width: Math.max(subtotal > 0 ? 6 : 0, pct) + "%",
                  height: "100%",
                  borderRadius: "99px",
                  background: unlocked
                    ? "linear-gradient(90deg, #ffe58f 0%, #4ade80 50%, #f7dc8b 100%)"
                    : "linear-gradient(90deg, #f3c65f 0%, #ffe699 65%, #6ee7b7 100%)",
                  transition: "width 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "7px", fontSize: "11px", color: "#d8eee1" }}>
              <span>سلتك الآن: <b style={{ color: "#ffffff" }}>{formatPrice(subtotal)}</b></span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>الهدف: <b style={{ color: "#f7dc8b" }}>{formatPrice(threshold)}</b></span>
                {!isCart && subtotal > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate("/cart")}
                    style={{ padding: "3px 10px", borderRadius: "99px", border: "none", background: "#f7dc8b", color: "#5e010b", fontSize: "10.5px", fontWeight: 800, cursor: "pointer" }}
                  >
                    {unlocked ? "استلم هديتك في السلة 🎁" : "عرض السلة 🛒"}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {showFloatingMini && (
        <div
          onClick={() => navigate("/cart")}
          style={{
            position: "fixed",
            left: "12px",
            right: "12px",
            bottom: "74px",
            zIndex: 45,
            maxWidth: "560px",
            margin: "0 auto",
            padding: "9px 13px",
            borderRadius: "16px",
            background: unlocked ? "linear-gradient(135deg, #870210, #b8332a)" : "rgba(94, 1, 11, 0.96)",
            color: "#ffffff",
            border: unlocked ? "1.5px solid #f7dc8b" : "1px solid rgba(247, 220, 139, 0.4)",
            boxShadow: "0 10px 26px rgba(0, 0, 0, 0.25)",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", fontSize: "11.5px", fontWeight: 800, marginBottom: "5px" }}>
            <span style={{ color: "#fff8e1" }}>
              {unlocked ? ("🎉 مبروك! ربحت «" + giftLabel + "» — اضغط لإتمام الطلب") : ("🔥 باقي " + formatPrice(remaining) + " لتربح «" + giftLabel + "»")}
            </span>
            <span style={{ color: "#f7dc8b", fontSize: "11px", flexShrink: 0 }}>{pct}%</span>
          </div>
          <div style={{ height: "6px", borderRadius: "99px", background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
            <div style={{ width: Math.max(6, pct) + "%", height: "100%", borderRadius: "99px", background: "linear-gradient(90deg, #f3c65f, #4ade80)", transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}
    </>
  );
}

export default function Home() {
  const storeCtx = useStore();
  const trpcUtils = trpc.useUtils();
  const lastCatalogSigRef = useRef("");
  const [activeAiProduct, setActiveAiProduct] = useState<PublicProduct | null>(null);
  useGuestPushSubscriptionSync();
  const [location, navigate] = useLocation();
  const isOnline = useOnlineStatus();
  const [instantStoreData, setInstantStoreData] = useState<HomeData>(getInstantLocalCatalog);
  useEffect(() => {
    let active = true;
    void loadOfflineCatalogIdb().then(cached => {
      if (active && cached && cached.products.length > 0 && (!instantStoreData.products || instantStoreData.products.length === 0)) {
        setInstantStoreData(cached);
      }
    });
    return () => { active = false; };
  }, []);
  const home = trpc.commerce.catalog.home.useQuery(undefined, {
    retry: 1,
    staleTime: 60000, refetchInterval: 120000, refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (home.data && Array.isArray(home.data.products)) {
      setInstantStoreData(home.data as HomeData);
      saveOfflineCatalogIdb(home.data as HomeData);
      try { localStorage.setItem(INSTANT_CATALOG_KEY, JSON.stringify(home.data)); } catch {}
    }
  }, [home.data]);
  const data = ((home.data && home.data.products ? home.data : instantStoreData) ?? { categories: [], products: [], banners: [], offers: [], settings: {} }) as HomeData;
  useEffect(() => { try { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }); } catch { window.scrollTo(0, 0); } }, [location]);
  const openProduct = (id: number) => { try { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }); } catch { window.scrollTo(0, 0); } navigate(`/product/${id}`); };
  const currentNav = location.startsWith("/categories") ? "/categories" : location.startsWith("/products") ? "/products" : location.startsWith("/assistant") ? "/assistant" : location.startsWith("/account") ? "/account" : "/";
  const productPath = location.startsWith("/product/");
  const productId = productPath ? Number(location.split("/")[2]) : 0;
  const content = useMemo(() => {
    if (productPath && Number.isInteger(productId)) return <ProductDetail key={productId} id={productId} allProducts={data.products} onSelectProduct={openProduct} onBack={() => navigate("/")} onAiRecipe={setActiveAiProduct} />;
    if (location === "/products" || location.startsWith("/products?")) return <ProductListPage data={data} onOpen={openProduct} />;
    if (location === "/categories") return <CategoriesPage data={data} />;
    if (location === "/cart") return <CartPage minOrder={Number(data.settings?.minOrderAmount || 0)} />;
    if (location === "/favorites") return <FavoritesPage allProducts={data.products} />;
    if (location === "/orders") return <OrdersPage />;
    if (location === "/account") return <AccountPage settings={data.settings} />;
    if (location === "/assistant") return <AssistantPage />;
    return <HomePage data={data} onOpen={openProduct} onAiRecipe={setActiveAiProduct} />;
  }, [location, productId, productPath, data]);
  return <div className="store-app" dir="rtl"><Header data={data} onSearch={text => navigate(`/products${text ? `?search=${encodeURIComponent(text)}` : ""}`)} /><GamifiedRewardBar settings={data.settings} location={location} />{(!isOnline || (home.isError && !home.data)) && (
  <div className="connection-strip">
    <span>{data.products.length > 0 ? "📡 بدون إنترنت — تصفّح بحرية (تأكيد الطلب عند عودة النت)" : "الاتصال بالخدمة غير متاح مؤقتًا"}</span>
    <button onClick={() => void home.refetch()}>تحديث</button>
  </div>
)}
{home.isError && !home.data && data.products.length === 0 ? <main className="page-shell inner-page"><LoadError onRetry={() => void home.refetch()} /></main> : content}<footer className="store-footer"><div className="footer-brand"><span className={`brand-mark ${data.settings.storeIconUrl ? "has-brand-image" : ""}`}>{data.settings.storeIconUrl ? <img src={data.settings.storeIconUrl} alt="" /> : <img src="/chef-hat.svg" alt="شهيزو" style={{ padding: 0, objectFit: "cover" }} />}</span><span><b>شهيزو – SHAHEZO</b><small>{data.settings.storeName === "شهيزو – SHAHEZO" || !data.settings.storeName ? "شهي ولذيذ · شاورما • فلافل • عصائر" : data.settings.storeName}</small></span></div>{shouldShowFooterDescription(data.settings.storeDescription) && <span>{data.settings.storeDescription}</span>}<small>© {new Date().getFullYear()} {data.settings.storeName || "شهيزو – SHAHEZO"}</small></footer>{activeAiProduct && <AiRecipeModal product={activeAiProduct} onClose={() => setActiveAiProduct(null)} />}
    <ShahezoWhatsAppBar /><BottomNav active={currentNav} /></div>;
}
