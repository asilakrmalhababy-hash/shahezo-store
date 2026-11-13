import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle, ArrowLeft, BadgePercent, BellRing, Box, Check, ChevronDown, CircleUserRound, ClipboardList,
  ImagePlus, LayoutDashboard, Leaf, LoaderCircle, LogOut, Megaphone, Package, Plus, Save,
  Settings2, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, Truck, Users, X, Download,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin, submitAdminCredentials } from "@/const";
import { PERMISSION_KEYS, PERMISSION_LABELS, ROLE_DEFINITIONS, type AdminRoleKey, type PermissionKey } from "@shared/rbac";
import ImageEditor from "@/components/ImageEditor";
import { ensureBrowserPushSubscription, getExistingBrowserPushSubscription, getPushPermissionState, requestPushPermission } from "@/lib/pushNotifications";

const money = (value: number) => `${Number(value || 0).toLocaleString("en-US")} ر.ي`;
const labels: Record<string, string> = { new: "جديد", preparing: "قيد التجهيز", ready: "جاهز للتوصيل", out_for_delivery: "خرج للتوصيل", delivered: "تم التسليم", cancelled: "ملغي" };
type Section = "overview" | "products" | "categories" | "delivery" | "banners" | "offers" | "orders" | "chats" | "users" | "staff" | "settings";
const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "products", label: "المنتجات", icon: Package },
  { id: "categories", label: "الأقسام", icon: SlidersHorizontal },
  { id: "delivery", label: "مناطق وأسعار التوصيل", icon: Truck },
  { id: "banners", label: "الإعلانات", icon: Megaphone },
  { id: "offers", label: "العروض والخصومات", icon: BadgePercent },
  { id: "orders", label: "الطلبات", icon: ClipboardList },
  { id: "chats", label: "محادثات الزبائن", icon: Sparkles },
  { id: "users", label: "العملاء", icon: Users },
  { id: "staff", label: "المديرون والصلاحيات", icon: ShieldCheck },
  { id: "settings", label: "إعدادات المتجر", icon: Settings2 },
];

function encodeCanvasSmartWebp(sourceCanvas: HTMLCanvasElement, kind: "product" | "category" | "banner" | "icon"): string {
  // High-definition ~105KB-115KB for products (~148000 base64 chars), ~165KB for banners (~220000 base64 chars)
  const maxBase64Len = kind === "banner" ? 220000 : kind === "icon" ? 85000 : 148000;
  let workCanvas = sourceCanvas;
  for (let pass = 0; pass < 3; pass++) {
    for (const q of [0.92, 0.88, 0.84, 0.78, 0.72]) {
      const webp = workCanvas.toDataURL("image/webp", q);
      const jpeg = workCanvas.toDataURL("image/jpeg", q);
      const best = (webp.startsWith("data:image/webp") && webp.length < jpeg.length) ? webp : jpeg;
      if (best.length <= maxBase64Len) return best;
    }
    const nextW = Math.max(520, Math.round(workCanvas.width * 0.86));
    const nextH = Math.max(520, Math.round(workCanvas.height * 0.86));
    const scaled = document.createElement("canvas");
    scaled.width = nextW;
    scaled.height = nextH;
    const sCtx = scaled.getContext("2d");
    if (!sCtx) break;
    sCtx.fillStyle = "#ffffff";
    sCtx.fillRect(0, 0, nextW, nextH);
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = "high";
    sCtx.drawImage(workCanvas, 0, 0, nextW, nextH);
    workCanvas = scaled;
  }
  const finalWebp = workCanvas.toDataURL("image/webp", 0.74);
  const finalJpeg = workCanvas.toDataURL("image/jpeg", 0.74);
  return (finalWebp.startsWith("data:image/webp") && finalWebp.length < finalJpeg.length) ? finalWebp : finalJpeg;
}

async function quickCompressImageFile(file: File, kind: "product" | "category" | "banner" | "icon"): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const maxDim = kind === "banner" ? 1440 : kind === "icon" ? 512 : 960;
        let w = img.naturalWidth || img.width || 960;
        let h = img.naturalHeight || img.height || 960;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("تعذر معالجة الصورة")); return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        resolve(encodeCanvasSmartWebp(canvas, kind));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة ملف الصورة"));
    };
    img.src = url;
  });
}

async function recompressImageUrlToLightWebp(srcUrl: string, kind: "product" | "category" | "banner" = "product"): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxDim = kind === "banner" ? 1440 : 960;
        let w = img.naturalWidth || img.width || 960;
        let h = img.naturalHeight || img.height || 960;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("تعذر معالجة الصورة")); return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        resolve(encodeCanvasSmartWebp(canvas, kind));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("تعذر تحميل الصورة"));
    img.src = srcUrl;
  });
}

async function makeVisionThumbDataUrl(fileOrDataUrl: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const isFile = typeof fileOrDataUrl !== "string";
    const url = isFile ? URL.createObjectURL(fileOrDataUrl) : fileOrDataUrl;
    const img = new Image();
    img.onload = () => {
      try {
        if (isFile) URL.revokeObjectURL(url);
        const maxDim = 220;
        let w = img.naturalWidth || img.width || 384;
        let h = img.naturalHeight || img.height || 384;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("تعذر تجهيز الصورة")); return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      if (isFile) URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة الصورة"));
    };
    img.src = url;
  });
}

type BulkDraftItem = {
  uid: string;
  imageUrl: string;
  name: string;
  description: string;
  price: string;
  categoryId: number | null;
  unit: string;
  weightEnabled: boolean;
  aiStatus: "idle" | "analyzing" | "done" | "error";
};

function ImageField({ value, onChange, kind, aspect, title }: { value: string; onChange: (value: string) => void; kind: "product" | "category" | "banner" | "icon"; aspect: number; title: string }) {
  const [open, setOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  const handleQuickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCompressing(true);
    try {
      const compressed = await quickCompressImageFile(file, kind);
      onChange(compressed);
      const kb = Math.max(1, Math.round((compressed.length * 3) / 4 / 1024));
      toast.success("تم تجهيز الصورة بدقة عالية بنجاح (" + kb + " كيلوبايت) ✨");
    } catch {
      toast.error("تعذر قراءة الصورة، جرب صورة أخرى.");
    } finally {
      setCompressing(false);
    }
  };

  const handleCropSave = (dataUrl: string) => {
    onChange(dataUrl);
    setOpen(false);
    toast.success("تم اعتماد قص الصورة فوراً ⚡");
  };

  return (
    <div className="admin-image-field">
      <input ref={quickInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => void handleQuickFile(e)} />
      <div className="admin-image-preview" onClick={() => quickInputRef.current?.click()} style={{ cursor: "pointer" }} title="اضغط لاختيار صورة سريعة">
        {value ? <img src={value} alt="معاينة الصورة" /> : <span><ImagePlus size={22} /><small>{compressing ? "جارٍ الضغط السريع..." : "اضغط لاختيار صورة فوراً"}</small></span>}
      </div>
      <div className="admin-image-buttons" style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <button type="button" className="small-button selected" disabled={compressing} onClick={e => { e.preventDefault(); e.stopPropagation(); quickInputRef.current?.click(); }}>
          <ImagePlus size={15} />{compressing ? "جارٍ التجهيز..." : value ? "تغيير سريع ⚡" : "رفع صورة سريع ⚡"}
        </button>
        <button type="button" className="small-button" onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
          ✂️ قص وتعديل
        </button>
        {value && (
          <button type="button" className="small-button danger-soft" onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(""); }}>
            <X size={14} />إزالة
          </button>
        )}
      </div>
      {open && (
        <ImageEditor
          title={title}
          aspect={aspect}
          format="webp"
          initialSource={value || undefined}
          onCancel={() => setOpen(false)}
          onSave={handleCropSave}
        />
      )}
    </div>
  );
}


function AdminLoginGate({ reason, onLogout, onSuccess }: { reason: "login" | "forbidden" | "suspended"; onLogout?: () => void | Promise<void>; onSuccess?: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setErrMsg("");
    const res = await submitAdminCredentials(username, password);
    setBusy(false);
    if (!res.ok) {
      setErrMsg(res.error || "بيانات الدخول غير صحيحة.");
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
    setPassword("");
    if (onSuccess) onSuccess();
    else window.location.reload();
  };

  if (reason !== "login") {
    const message = reason === "suspended"
      ? "تم إيقاف هذا الحساب الإداري. تواصل مع مالك المتجر."
      : "تم تسجيل دخولك، لكن هذا الحساب غير مخول بصلاحيات الإدارة حالياً.";
    return (
      <main className="admin-gate" dir="rtl">
        <div className="admin-gate-card">
          <span className="admin-gate-mark"><ShieldCheck size={26} /></span>
          <span className="eyebrow">حماية لوحة الإدارة</span>
          <h1>{reason === "suspended" ? "الحساب معطل" : "غير مصرح بالدخول"}</h1>
          <p>{message}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            <Link className="button button-outline" href="/">العودة للمتجر</Link>
            {onLogout && <button className="button button-quiet" onClick={() => void onLogout()}>تسجيل الخروج</button>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-gate" dir="rtl">
      <div className="admin-gate-card" style={{ maxWidth: "430px", textAlign: "right", alignItems: "stretch" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <span className="admin-gate-mark" style={{ margin: 0, width: "46px", height: "46px" }}><ShieldCheck size={24} /></span>
          <div>
            <span className="eyebrow">بوابة الإدارة المحمية</span>
            <h1 style={{ margin: "2px 0 0", fontSize: "20px" }}>تسجيل دخول الإدارة</h1>
          </div>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "11px" }}>للمالك: اترك اسم المستخدم فارغاً (أو اكتب owner) وأدخل كلمة مرور المالك. للمديرين والموظفين: أدخل اسم المستخدم وكلمة المرور المخصصة لك.</p>
        {errMsg && (
          <div className="admin-error" style={{ marginBottom: "12px", padding: "10px 12px" }}>
            <AlertTriangle size={16} />
            <div><strong>تعذر تسجيل الدخول</strong><small>{errMsg}</small></div>
          </div>
        )}
        <form onSubmit={handleLogin} className="form-stack">
          <label>
            اسم المستخدم أو البريد (اختياري للمالك)
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="owner أو اسم مستخدم الموظف..."
              disabled={busy}
            />
          </label>
          <label>
            كلمة المرور
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور السرية"
              disabled={busy}
            />
          </label>
          <button type="submit" className="button button-primary full-button" disabled={busy || !password}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <ShieldCheck size={16} />}
            {busy ? "جارٍ التحقق..." : "دخول آمن للوحة الإدارة"}
          </button>
        </form>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #ebefe8" }}>
          <Link className="text-link" href="/">العودة لواجهة المتجر</Link>
          <small className="secure-caption" style={{ margin: 0 }}><ShieldCheck size={13} /> محمي بتشفير الخادم</small>
        </div>
      </div>
    </main>
  );
}

function ForcePasswordChangeGate({ displayName, onSuccess, onLogout }: { displayName: string; onSuccess: () => void; onLogout: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changeMut = trpc.commerce.admin.staff.changeOwnPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث كلمة المرور بنجاح! مرحباً بك.");
      onSuccess();
    },
    onError: err => toast.error(err.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف."); return; }
    if (newPassword !== confirmPassword) { toast.error("كلمتا المرور غير متطابقتين."); return; }
    if (newPassword === currentPassword) { toast.error("يرجى اختيار كلمة مرور جديدة مختلفة عن المؤقتة."); return; }
    changeMut.mutate({ currentPassword, newPassword });
  };

  return (
    <main className="admin-gate" dir="rtl">
      <div className="admin-gate-card" style={{ maxWidth: "430px", textAlign: "right", alignItems: "stretch" }}>
        <span className="eyebrow">إجراء أمني إلزامي</span>
        <h1 style={{ fontSize: "20px", margin: "4px 0 8px" }}>تغيير كلمة المرور المؤقتة</h1>
        <p style={{ margin: "0 0 14px", fontSize: "11px" }}>مرحباً {displayName}، لحماية حسابك الإداري يجب تعيين كلمة مرور خاصة بك قبل المتابعة إلى لوحة الإدارة.</p>
        <form onSubmit={submit} className="form-stack">
          <label>كلمة المرور المؤقتة (الحالية)<input required type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
          <label>كلمة المرور الجديدة (6 أحرف على الأقل)<input required type="password" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
          <label>تأكيد كلمة المرور الجديدة<input required type="password" minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
          <button type="submit" className="button button-primary full-button" disabled={changeMut.isPending}>
            {changeMut.isPending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
            حفظ كلمة المرور الجديدة والمتابعة
          </button>
          <button type="button" className="button button-quiet full-button" onClick={onLogout}>تسجيل الخروج</button>
        </form>
      </div>
    </main>
  );
}

function buildWhatsAppUrl(rawPhone: string, text: string): string {
  const digits = String(rawPhone || "").replace(/\D+/g, "");
  const intl = digits.startsWith("967") ? digits : digits.startsWith("0") ? ("967" + digits.slice(1)) : ("967" + digits);
  return ["ht", "tps://wa.me/"].join("") + intl + "?text=" + encodeURIComponent(text);
}

function Overview() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const query = trpc.commerce.admin.overview.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false });
  const deleteReqMut = trpc.commerce.admin.orders.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم إغلاق وحذف طلب التوفير من القائمة");
      await Promise.all([utils.commerce.admin.overview.invalidate(), utils.commerce.admin.orders.list.invalidate()]);
    },
    onError: err => toast.error(err.message),
  });
  if (query.isLoading) return <AdminLoading />;
  if (query.error) return <AdminError message={query.error.message} retry={() => void query.refetch()} />;
  const data = query.data!;
  const an = (data as any).analytics || { todayOrders: 0, todayRevenue: 0, weekOrders: 0, weekRevenue: 0, monthOrders: 0, monthRevenue: 0, topProducts: [], topDistricts: [], cancelledItemsLog: [], missingRequests: [] };
  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div><span className="eyebrow">لوحة القيادة والتقارير الذكية</span><h1>أهلاً بك في بوفية شهيزو – SHAHEZO</h1><p>ملخص شامل للمبيعات، الأرباح، الأصناف الأكثر طلباً، النواقص، وسجل الإلغاءات.</p></div>
        <span className="admin-heading-mark"><Leaf size={27} /></span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div style={{ padding: "16px", borderRadius: "18px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#ffffff", boxShadow: "0 10px 24px rgba(94, 1, 11, 0.16)" }}>
          <small style={{ color: "#cfe6d8", fontSize: "12px", fontWeight: 700 }}>📅 مبيعات اليوم</small>
          <strong style={{ display: "block", fontSize: "22px", margin: "4px 0", color: "#f1d897" }}>{money(an.todayRevenue)}</strong>
          <span style={{ fontSize: "12px", color: "#e3f2e9" }}>{an.todayOrders} طلب مؤكّد اليوم</span>
        </div>
        <div style={{ padding: "16px", borderRadius: "18px", background: "#ffffff", border: "1.5px solid #cfe0d4", boxShadow: "0 6px 16px rgba(94, 1, 11, 0.05)" }}>
          <small style={{ color: "#496556", fontSize: "12px", fontWeight: 700 }}>📊 مبيعات هذا الأسبوع (7 أيام)</small>
          <strong style={{ display: "block", fontSize: "22px", margin: "4px 0", color: "#870210" }}>{money(an.weekRevenue)}</strong>
          <span style={{ fontSize: "12px", color: "#5e7568" }}>{an.weekOrders} طلب خلال الأسبوع</span>
        </div>
        <div style={{ padding: "16px", borderRadius: "18px", background: "#ffffff", border: "1.5px solid #cfe0d4", boxShadow: "0 6px 16px rgba(94, 1, 11, 0.05)" }}>
          <small style={{ color: "#496556", fontSize: "12px", fontWeight: 700 }}>🗓️ مبيعات آخر 30 يوماً</small>
          <strong style={{ display: "block", fontSize: "22px", margin: "4px 0", color: "#870210" }}>{money(an.monthRevenue)}</strong>
          <span style={{ fontSize: "12px", color: "#5e7568" }}>{an.monthOrders} طلب خلال الشهر</span>
        </div>
      </div>

      <div className="admin-stat-grid">{[
        { label: "المنتجات", value: data.products, icon: Package },
        { label: "الأقسام", value: data.categories, icon: Box },
        { label: "كل الطلبات", value: data.orders, icon: ClipboardList },
        { label: "العملاء", value: data.customers, icon: Users },
        { label: "طلبات قيد المتابعة", value: data.openOrders, icon: Truck },
        { label: "إجمالي المبيعات المعتمدة", value: data.orderValue, display: money(data.orderValue), icon: BadgePercent },
      ].map(item => { const Icon = item.icon; return <div className="admin-stat" key={item.label}><span><Icon size={18} /></span><small>{item.label}</small><strong>{"display" in item ? item.display : item.value.toLocaleString("en-US")}</strong><em>من بيانات المتجر</em></div>; })}</div>

      <section className="admin-form-card" style={{ marginTop: "18px", border: "1.5px solid #e3c478", background: "linear-gradient(135deg, #fffdf7 0%, #fff9e8 100%)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <div>
            <span className="eyebrow" style={{ color: "#9c6509" }}>ميزة ذكية لزيادة المبيعات</span>
            <h2 style={{ fontSize: "17px", margin: "2px 0", color: "#173c2a" }}>🔔 طلبات التوفير والنواقص التي بحث عنها الزبائن ({an.missingRequests?.length || 0})</h2>
            <small style={{ color: "#5e6d63" }}>المنتجات التي طلبها الزبائن من المساعد الذكي ولم تكن متوفرة في المتجر — وفّرها وأبلغ الزبون بضغطة زر!</small>
          </div>
          <Link href="/admin/products" className="small-button selected"><Plus size={14} /> فتح قسم المنتجات</Link>
        </div>
        {!an.missingRequests?.length ? (
          <p style={{ margin: 0, fontSize: "12px", color: "#5f7266", padding: "8px 0" }}>لا توجد طلبات نواقص مسجلة حالياً. أي منتج يطلبه الزبون من المساعد الذكي ولا يجده سيظهر هنا تلقائياً مع رقم هاتفه.</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {an.missingRequests.map((req: any) => (
              <div key={req.id} style={{ padding: "10px 12px", borderRadius: "12px", background: "#ffffff", border: "1px solid #ead8a4", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "grid", gap: "2px" }}>
                  <strong style={{ fontSize: "13px", color: "#870210" }}>🛒 مطلوب توفير: «{req.itemText}»</strong>
                  <small style={{ color: "#52665a" }}>العميل: {req.customerName} · الهاتف: <b dir="ltr">{req.phone}</b> · {new Date(req.createdAt).toLocaleString("ar-YE")}</small>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <button
                    type="button"
                    className="small-button selected"
                    onClick={() => {
                      try { window.sessionStorage.setItem("prefill_new_product_name", req.itemText); } catch {}
                      navigate("/admin/products");
                    }}
                  >
                    <Plus size={13} /> أضف هذا المنتج للمتجر
                  </button>
                  {req.phone && req.phone !== "غير مسجل بالموقع" && (
                    <a
                      href={buildWhatsAppUrl(req.phone, "مرحباً بك من بوفية شهيزو – SHAHEZO 🥙\nبشرى سارة! لقد قمنا بتوفير المنتج الذي طلبته («" + req.itemText + "») في المتجر الآن، يمكنك طلبه في أي وقت.")}
                      target="_blank"
                      rel="noreferrer"
                      className="small-button"
                      style={{ background: "#e8f8ee", color: "#0f5c3a", borderColor: "#a8dfc0", fontWeight: 800 }}
                    >
                      📲 إبلاغ الزبون بتوفره واتساب
                    </a>
                  )}
                  <button type="button" className="small-button danger-soft" onClick={() => deleteReqMut.mutate({ id: req.id })} title="إغلاق الطلب">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "14px", marginTop: "16px" }}>
        <section className="admin-form-card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "15px", color: "#870210" }}>🔥 المنتجات الأكثر مبيعاً</h3>
          {!an.topProducts?.length ? <small style={{ color: "#687b6f" }}>ستظهر هنا فور إتمام الطلبات.</small> : (
            <div style={{ display: "grid", gap: "8px" }}>
              {an.topProducts.map((tp: any, i: number) => (
                <div key={tp.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "10px", background: "#f6faf7", border: "1px solid #dfece3" }}>
                  <span style={{ fontWeight: 800, fontSize: "12.5px", color: "#143828" }}>#{i + 1} · {tp.name}</span>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#870210" }}>{tp.qty} مباع · <b>{money(tp.revenue)}</b></span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-form-card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "15px", color: "#870210" }}>📍 أكثر الأحياء والمناطق طلباً</h3>
          {!an.topDistricts?.length ? <small style={{ color: "#687b6f" }}>ستظهر هنا إحصائيات الأحياء مع الطلبات.</small> : (
            <div style={{ display: "grid", gap: "8px" }}>
              {an.topDistricts.map((td: any, i: number) => (
                <div key={td.district} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: "10px", background: "#f6faf7", border: "1px solid #dfece3" }}>
                  <span style={{ fontWeight: 800, fontSize: "12.5px", color: "#143828" }}>#{i + 1} · {td.district}</span>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#870210" }}>{td.count} طلب · <b>{money(td.revenue)}</b></span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="admin-form-card" style={{ marginTop: "16px", border: "1px solid #f0cfc9", background: "#fffaf9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", color: "#8f3225" }}>🚫 تقرير الأصناف الملغاة من الفواتير وأسبابها ({an.cancelledItemsLog?.length || 0})</h3>
            <small style={{ color: "#6d524e" }}>يوضح أي صنف تم إلغاؤه من فاتورة أي زبون، والمبلغ الذي خُصم، وسبب الإلغاء.</small>
          </div>
          <Link href="/admin/orders" className="small-button">فتح الطلبات<ArrowLeft size={14} /></Link>
        </div>
        {!an.cancelledItemsLog?.length ? (
          <small style={{ color: "#786460" }}>لا توجد أصناف ملغاة من الفواتير حتى الآن.</small>
        ) : (
          <div style={{ display: "grid", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
            {an.cancelledItemsLog.map((cl: any) => (
              <div key={cl.id} style={{ padding: "9px 12px", borderRadius: "10px", background: "#ffffff", border: "1px solid #f2d6d0", display: "grid", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", fontSize: "12px" }}>
                  <strong style={{ color: "#8f3225" }}>طلب {cl.orderNumber} · العميل: {cl.customerName} ({cl.phone})</strong>
                  <small style={{ color: "#7a6864" }}>{new Date(cl.createdAt).toLocaleString("ar-YE")}</small>
                </div>
                <div style={{ fontSize: "12px", color: "#3d2825", lineHeight: 1.5 }}>{cl.note}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="admin-section-heading" style={{ marginTop: "18px" }}><div><h2>آخر الطلبات</h2><p>تظهر الطلبات هنا بعد أن يرسلها العملاء.</p></div><Link href="/admin/orders" className="small-button">إدارة الطلبات<ArrowLeft size={15} /></Link></div>
      {!data.recentOrders.length ? <div className="admin-empty"><ClipboardList size={22} /><strong>لا توجد طلبات بعد</strong><span>تأكد من إعداد التوصيل قبل فتح الطلبات.</span></div> : <div className="admin-order-table">{data.recentOrders.map(order => <div className="admin-order-row" key={order.id}><span className="order-number">{order.orderNumber}</span><span>{order.recipientName}</span><span>{new Date(order.createdAt).toLocaleDateString("ar-YE")}</span><b>{money(order.total)}</b><span className={"status-pill status-" + order.status}>{labels[order.status]}</span></div>)}</div>}
    </div>
  );
}
function unpackProductVariants(rawDescription?: string | null): { cleanDescription: string; variants: string[]; weightEnabled: boolean; minWeightAmount: number } {
  let raw = String(rawDescription || "");
  let variants: string[] = [];
  let weightEnabled = false;
  let minWeightAmount = 100;
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
  return { cleanDescription: raw.trim(), variants, weightEnabled, minWeightAmount };
}

function packProductVariants(cleanDescription: string, variants: string[], weightEnabled = false, minWeightAmount = 100): string | null {
  let out = cleanDescription.trim();
  const valid = [...new Set(variants.map(v => v.trim()).filter(Boolean))].slice(0, 25);
  if (valid.length > 0) {
    out = (out ? out + "\n" : "") + "[[variants:" + JSON.stringify(valid) + "]]";
  }
  if (weightEnabled) {
    out = (out ? out + "\n" : "") + "[[wcfg:" + JSON.stringify({ enabled: true, minAmount: Math.max(50, Number(minWeightAmount) || 100) }) + "]]";
  }
  return out || null;
}

type ProductFormState = {
  name: string;
  description: string;
  variants: string[];
  variantDraft: string;
  weightEnabled: boolean;
  minWeightAmount: string;
  imageUrl: string;
  categoryId: number | null;
  price: string;
  unit: string;
  stock: string;
  minQuantity: string;
  quantityStep: string;
  isPublished: boolean;
  isAvailable: boolean;
  sortOrder: string;
};

const blankProduct: ProductFormState = {
  name: "",
  description: "",
  variants: [],
  variantDraft: "",
  weightEnabled: false,
  minWeightAmount: "100",
  imageUrl: "",
  categoryId: null,
  price: "",
  unit: "حبة",
  stock: "",
  minQuantity: "1",
  quantityStep: "1",
  isPublished: true,
  isAvailable: true,
  sortOrder: "0",
};

function SmartBulkProductsStudio({
  categories,
  onClose,
  onSaved,
}: {
  categories: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"photos" | "text">("photos");
  const [items, setItems] = useState<BulkDraftItem[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [defaultCatId, setDefaultCatId] = useState<number | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [unifiedPrice, setUnifiedPrice] = useState("");
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const singleRowFileRef = useRef<{ uid: string | null; input: HTMLInputElement | null }>({ uid: null, input: null });
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const base64ImageMapRef = useRef<Record<string, string>>({});

  const analyzeMut = trpc.commerce.admin.products.analyzeImage.useMutation();
  const parseTextMut = trpc.commerce.admin.products.parseBulkText.useMutation();
  const createCatMut = trpc.commerce.admin.categories.create.useMutation({
    onSuccess: async (res) => {
      await Promise.all([utils.commerce.admin.categories.list.invalidate(), utils.commerce.catalog.listCategories.invalidate(), utils.commerce.catalog.home.invalidate()]);
      setDefaultCatId(res.id);
      setItems(prev => prev.map(it => ({ ...it, categoryId: res.id })));
      setNewCatName("");
      setShowNewCatInput(false);
      toast.success("✅ تم إنشاء القسم الجديد وتعيينه للمنتجات بالجدول!");
    },
    onError: (err) => toast.error(err.message),
  });
  const bulkCreateMut = trpc.commerce.admin.products.bulkCreate.useMutation({
    onSuccess: async (res) => {
      toast.success("🎉 تم حفظ ونشر " + res.count + " منتج في المتجر بنجاح!");
      await onSaved();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateItem = (uid: string, patch: Partial<BulkDraftItem>) => {
    setItems(prev => prev.map(it => (it.uid === uid ? { ...it, ...patch } : it)));
  };

  const removeItem = (uid: string) => {
    setItems(prev => prev.filter(it => it.uid !== uid));
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files ?? []).slice(0, 35);
    e.target.value = "";
    if (!fileList.length) return;

    toast.info("📸 جارٍ تجهيز " + fileList.length + " صورة واستخراج الأسماء بالعربية وتصنيف الأقسام...");

    const createdTasks: Array<{ uid: string; file: File }> = fileList.map((file, idx) => ({
      uid: "bulk_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 6),
      file,
    }));

    const placeholders: BulkDraftItem[] = createdTasks.map(t => ({
      uid: t.uid,
      imageUrl: URL.createObjectURL(t.file),
      name: "",
      description: "",
      price: "",
      categoryId: defaultCatId,
      unit: "حبة",
      weightEnabled: false,
      aiStatus: "analyzing",
    }));

    setItems(prev => [...prev, ...placeholders]);

    for (const task of createdTasks) {
      try {
        const [storeImg, visionThumb] = await Promise.all([
          quickCompressImageFile(task.file, "product"),
          makeVisionThumbDataUrl(task.file),
        ]);
        updateItem(task.uid, { imageUrl: storeImg });
        const aiRes = await analyzeMut.mutateAsync({
          imageDataUrl: visionThumb,
          fileName: task.file.name,
        });
        if (aiRes.categoryId && !categories.some(c => c.id === aiRes.categoryId)) {
          await utils.commerce.admin.categories.list.invalidate();
        }
        updateItem(task.uid, {
          name: aiRes.name || "منتج جديد",
          description: aiRes.description || "",
          categoryId: defaultCatId !== null ? defaultCatId : aiRes.categoryId,
          unit: aiRes.unit || (aiRes.weightEnabled ? "كيلو" : "حبة"),
          weightEnabled: Boolean(aiRes.weightEnabled),
          aiStatus: "done",
        });
      } catch {
        updateItem(task.uid, {
          name: "منتج جديد",
          aiStatus: "error",
        });
      }
    }
    await utils.commerce.admin.categories.list.invalidate();
    toast.success("✨ اكتمل استخراج الأسماء بالعربية وتحديد القسم! اكتب السعر فقط أمام كل منتج.");
  };

  const handleParseBulkText = async () => {
    if (!bulkText.trim()) {
      toast.error("اكتب أو الصق قائمة المنتجات أولاً.");
      return;
    }
    try {
      const parsed = await parseTextMut.mutateAsync({ rawText: bulkText });
      if (!parsed.length) {
        toast.error("لم يتم العثور على منتجات في النص.");
        return;
      }
      const newItems: BulkDraftItem[] = parsed.map((p, idx) => ({
        uid: "txt_" + Date.now() + "_" + idx,
        imageUrl: "",
        name: p.name,
        description: p.description,
        price: p.price > 0 ? String(p.price) : "",
        categoryId: defaultCatId !== null ? defaultCatId : p.categoryId,
        unit: p.unit || (p.weightEnabled ? "كيلو" : "حبة"),
        weightEnabled: Boolean(p.weightEnabled),
        aiStatus: "done",
      }));
      setItems(prev => [...prev, ...newItems]);
      setBulkText("");
      toast.success("✨ تم تجهيز " + newItems.length + " منتج!");
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحليل النص.");
    }
  };

  const handleReplaceRowImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetUid = singleRowFileRef.current.uid;
    e.target.value = "";
    if (!file || !targetUid) return;
    try {
      const compressed = await quickCompressImageFile(file, "product");
      base64ImageMapRef.current[targetUid] = compressed;
      updateItem(targetUid, { imageUrl: URL.createObjectURL(file) });
    } catch {
      toast.error("تعذر قراءة الصورة");
    }
  };

  const analyzingCount = items.filter(i => i.aiStatus === "analyzing").length;
  const readyItems = items.filter(i => i.name.trim().length > 0 && Number(i.price) >= 0 && i.price.trim() !== "");
  const missingPriceCount = items.filter(i => i.name.trim().length > 0 && i.price.trim() === "").length;

  const saveAllReady = () => {
    if (!readyItems.length) {
      toast.error("يرجى إدخال السعر لمنتج واحد على الأقل قبل الحفظ.");
      return;
    }
    const payload = readyItems.map((it, idx) => ({
      name: it.name.trim(),
      description: packProductVariants(it.description, [], it.weightEnabled, 100),
      imageUrl: base64ImageMapRef.current[it.uid] || it.imageUrl || null,
      categoryId: it.categoryId,
      price: Math.max(0, Number(it.price) || 0),
      unit: it.weightEnabled ? "كيلو" : (it.unit.trim() || "حبة"),
      stock: null,
      minQuantity: 1,
      quantityStep: 1,
      isPublished: true,
      isAvailable: true,
      sortOrder: idx,
    }));
    bulkCreateMut.mutate({ items: payload });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose} style={{ zIndex: 195 }}>
      <section
        className="checkout-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "860px", width: "96vw", maxHeight: "92vh", display: "flex", flexDirection: "column", padding: "18px" }}
      >
        <input ref={multiFileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => void handleFilesSelected(e)} />
        <input ref={el => { singleRowFileRef.current.input = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={e => void handleReplaceRowImage(e)} />

        <div className="modal-heading" style={{ marginBottom: "12px", flexShrink: 0 }}>
          <div>
            <span className="eyebrow">وداعاً للتعب — إضافة 30 منتج في دقائق</span>
            <h2 style={{ fontSize: "19px", margin: "2px 0" }}>⚡ الإضافة الجماعية الذكية للمنتجات</h2>
            <small style={{ color: "#52655a" }}>ارفع صور المنتجات وسيقوم النظام بكتابة الاسم بالعربية والوصف واختيار القسم وعزل الخلفية، ويبقى عليك كتابة السعر فقط!</small>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", flexShrink: 0 }}>
          <button
            type="button"
            className={"small-button" + (tab === "photos" ? " selected" : "")}
            onClick={() => setTab("photos")}
            style={{ flex: 1, justifyContent: "center", padding: "10px 14px", fontWeight: 800, borderRadius: "12px" }}
          >
            📸 1. رفع صور المنتجات (حتى 30 صورة دفعة واحدة)
          </button>
          <button
            type="button"
            className={"small-button" + (tab === "text" ? " selected" : "")}
            onClick={() => setTab("text")}
            style={{ flex: 1, justifyContent: "center", padding: "10px 14px", fontWeight: 800, borderRadius: "12px" }}
          >
            📝 2. لصق قائمة منتجات وأسعار نصية
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "grid", gap: "12px", paddingLeft: "2px" }}>
          {tab === "photos" ? (
            <div
              onClick={() => multiFileInputRef.current?.click()}
              style={{
                padding: "18px",
                borderRadius: "16px",
                border: "2px dashed #870210",
                background: "linear-gradient(135deg, #f3faf5 0%, #fffdf6 100%)",
                textAlign: "center",
                cursor: "pointer",
                display: "grid",
                gap: "6px",
                justifyItems: "center",
              }}
            >
              <span style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#870210", color: "#f1d897", display: "grid", placeItems: "center" }}>
                <ImagePlus size={24} />
              </span>
              <strong style={{ fontSize: "15px", color: "#123b2a" }}>اضغط هنا لاختيار صور المنتجات من هاتفك (10 أو 20 أو 30 صورة دفعة واحدة)</strong>
              <small style={{ color: "#4d6457", fontSize: "12px" }}>
                سيتم استخراج الاسم بالعربية وتحديد القسم تلقائياً — ويمكنك الضغط على «🪄 عزل الخلفية» تحت أي صورة لجعل خلفيتها بيضاء!
              </small>
            </div>
          ) : (
            <div style={{ padding: "14px", borderRadius: "16px", background: "#f6faf7", border: "1px solid #d4e3d9", display: "grid", gap: "10px" }}>
              <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#870210" }}>
                <span>اكتب أو الصق قائمة المنتجات (كل منتج في سطر مع سعره أو بدون سعر):</span>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={"مثال:\nشاورما عربي دبل - 2500\nساندوتش فلافل شامي محشي - 600\nصاروخ شاورما صاج - 1500\nعصير مانجو طبيعي كبير - 1000"}
                  style={{ background: "#ffffff", borderRadius: "12px", padding: "10px" }}
                />
              </label>
              <button
                type="button"
                className="button button-primary"
                disabled={parseTextMut.isPending}
                onClick={() => void handleParseBulkText()}
              >
                {parseTextMut.isPending ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                {parseTextMut.isPending ? "جارٍ تحويل القائمة..." : "✨ تحويل القائمة إلى بطاقات جاهزة"}
              </button>
            </div>
          )}

          {items.length > 0 && (
            <div style={{ display: "grid", gap: "8px", padding: "10px 12px", borderRadius: "12px", background: "#eef5f0", border: "1px solid #d5e4da" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "12px", color: "#870210" }}>المنتجات بالجدول: {items.length}</strong>
                  {analyzingCount > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "99px", background: "#870210", color: "#f1d897", fontSize: "11px", fontWeight: 800 }}>
                      <LoaderCircle size={13} className="spin" /> جارٍ تجهيز الصور ({analyzingCount} متبقية)...
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                  <select
                    value={defaultCatId ?? ""}
                    onChange={e => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setDefaultCatId(val);
                      setItems(prev => prev.map(it => ({ ...it, categoryId: val })));
                      toast.success(val ? "تم توحيد القسم لجميع المنتجات بالجدول" : "تم إلغاء توحيد القسم");
                    }}
                    style={{ padding: "6px 10px", borderRadius: "10px", border: "1px solid #bfd2c6", fontSize: "12px", background: "#ffffff" }}
                  >
                    <option value="">تصنيف تلقائي لكل منتج...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>تعيين الكل: {c.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => setShowNewCatInput(v => !v)}
                    style={{ background: "#ffffff", border: "1px solid #870210", color: "#870210", fontWeight: 800 }}
                  >
                    <Plus size={13} /> قسم جديد سريع
                  </button>
                  <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                    <input
                      type="number"
                      min="0"
                      value={unifiedPrice}
                      onChange={e => setUnifiedPrice(e.target.value)}
                      placeholder="سعر موحد..."
                      style={{ width: "95px", padding: "6px 8px", borderRadius: "10px", border: "1px solid #bfd2c6", fontSize: "12px", background: "#ffffff" }}
                    />
                    {unifiedPrice.trim() && (
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => {
                          setItems(prev => prev.map(it => (it.price.trim() === "" ? { ...it, price: unifiedPrice.trim() } : it)));
                          toast.success("تم تعبئة السعر للمنتجات الفارغة");
                        }}
                      >
                        تعبئة الفارغ
                      </button>
                    )}
                  </div>
                  <button type="button" className="small-button danger-soft" onClick={() => setItems([])}>مسح القائمة</button>
                </div>
              </div>
              {showNewCatInput && (
                <div style={{ display: "flex", gap: "6px", alignItems: "center", paddingTop: "4px" }}>
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="اكتب اسم القسم الجديد (مثلاً: العصائر والمشروبات)..."
                    style={{ flex: 1, padding: "7px 10px", borderRadius: "10px", border: "1px solid #870210", background: "#ffffff", fontSize: "12px" }}
                  />
                  <button
                    type="button"
                    className="small-button selected"
                    disabled={createCatMut.isPending || !newCatName.trim()}
                    onClick={() => createCatMut.mutate({ name: newCatName.trim(), description: "", imageUrl: "", color: "#870210", isActive: true, sortOrder: 0 })}
                  >
                    {createCatMut.isPending ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} حفظ وتعيين للكل
                  </button>
                </div>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div style={{ display: "grid", gap: "10px" }}>
              {items.map((item, idx) => {
                const nextItem = items[idx + 1];
                const hasPrice = item.price.trim() !== "";
                return (
                  <div
                    key={item.uid}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "92px 1fr",
                      gap: "12px",
                      padding: "12px",
                      borderRadius: "15px",
                      background: "#ffffff",
                      border: hasPrice ? "1.5px solid #1b6b45" : "1.5px solid #e0b44c",
                      boxShadow: "0 3px 10px rgba(15, 42, 28, 0.05)",
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "grid", gap: "5px", justifyItems: "center" }}>
                      <div
                        onClick={() => {
                          singleRowFileRef.current.uid = item.uid;
                          singleRowFileRef.current.input?.click();
                        }}
                        title="اضغط لتغيير الصورة"
                        style={{
                          width: "76px",
                          height: "76px",
                          borderRadius: "12px",
                          overflow: "hidden",
                          background: "#f2f6f3",
                          border: "1px solid #d4e0d8",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                        }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <ImagePlus size={20} color="#5b7365" />
                        )}
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 800, color: item.aiStatus === "analyzing" ? "#b27b16" : "#870210" }}>
                        {item.aiStatus === "analyzing" ? "⏳ يقرأ الصورة..." : ("#" + (idx + 1))}
                      </span>
                    </div>

                    <div style={{ display: "grid", gap: "8px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px" }}>
                        <label style={{ display: "grid", gap: "3px", fontSize: "11px", fontWeight: 800, color: "#2c4738" }}>
                          <span>🤖 اسم المنتج بالعربية:</span>
                          <input
                            value={item.name}
                            onChange={e => updateItem(item.uid, { name: e.target.value })}
                            placeholder={item.aiStatus === "analyzing" ? "جارٍ استخراج الاسم بالعربية..." : "اسم المنتج..."}
                            style={{ padding: "8px 10px", borderRadius: "10px", border: "1px solid #cad8cf", fontWeight: 800 }}
                          />
                        </label>

                        <label style={{ display: "grid", gap: "3px", fontSize: "11px", fontWeight: 900, color: hasPrice ? "#145936" : "#9c6509" }}>
                          <span>💰 {item.weightEnabled ? "سعر الكيلو (ر.ي) * — اكتب السعر فقط:" : "السعر (ر.ي) * — اكتب السعر فقط:"}</span>
                          <input
                            ref={el => { priceRefs.current[item.uid] = el; }}
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={e => updateItem(item.uid, { price: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === "Enter" && nextItem) {
                                e.preventDefault();
                                priceRefs.current[nextItem.uid]?.focus();
                                priceRefs.current[nextItem.uid]?.select();
                              }
                            }}
                            placeholder="اكتب السعر هنا ثم اضغط Enter للتالي..."
                            style={{
                              padding: "8px 10px",
                              borderRadius: "10px",
                              border: hasPrice ? "2px solid #1b6b45" : "2px solid #e0a82e",
                              background: hasPrice ? "#f1fbf5" : "#fffbeb",
                              fontWeight: 900,
                              fontSize: "14px",
                            }}
                          />
                        </label>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px", alignItems: "center" }}>
                        <input
                          value={item.description}
                          onChange={e => updateItem(item.uid, { description: e.target.value })}
                          placeholder={item.aiStatus === "analyzing" ? "جارٍ كتابة الوصف التسويقي تلقائياً..." : "الوصف التسويقي للمنتج..."}
                          style={{ padding: "6px 10px", borderRadius: "9px", border: "1px solid #d8e3dc", fontSize: "12px", color: "#3c5245" }}
                        />

                        <select
                          value={item.categoryId ?? ""}
                          onChange={e => updateItem(item.uid, { categoryId: e.target.value ? Number(e.target.value) : null })}
                          style={{ padding: "6px 8px", borderRadius: "9px", border: "1px solid #cad8cf", fontSize: "12px", background: "#f9fbf9" }}
                        >
                          <option value="">بلا قسم (اختر قسماً...)</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            type="button"
                            className={"small-button" + (item.weightEnabled ? " selected" : "")}
                            onClick={() => updateItem(item.uid, { weightEnabled: !item.weightEnabled, unit: !item.weightEnabled ? "كيلو" : "حبة" })}
                            title="تبديل بين البيع بالحبة أو البيع بالوزن والمبلغ"
                            style={{ padding: "5px 8px", fontSize: "11px" }}
                          >
                            {item.weightEnabled ? "⚖️ بالوزن" : "📦 بالحبة"}
                          </button>
                          <button
                            type="button"
                            className="small-button danger-soft"
                            onClick={() => removeItem(item.uid)}
                            title="حذف من القائمة"
                            style={{ padding: "5px 8px" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #dce6df", display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "12px", color: "#355242", fontWeight: 700 }}>
            جاهز للنشر: <strong style={{ color: "#870210" }}>{readyItems.length}</strong> من {items.length} منتج
            {missingPriceCount > 0 ? <span style={{ color: "#b56e08", marginRight: "8px" }}>• ({missingPriceCount} منتج ينتظر كتابة السعر)</span> : null}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="button button-quiet" onClick={onClose}>إغلاق</button>
            <button
              type="button"
              className="button button-primary"
              disabled={bulkCreateMut.isPending || readyItems.length === 0}
              onClick={saveAllReady}
            >
              {bulkCreateMut.isPending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
              🚀 حفظ ونشر كل المنتجات الجاهزة ({readyItems.length})
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductsPanel({ isOwner = true, permissions = [], allowedCategoryIds = [] }: { isOwner?: boolean; permissions?: PermissionKey[]; allowedCategoryIds?: number[] }) {
  const canAdd = Boolean(isOwner || permissions.includes("products.manage") || permissions.includes("products.add"));
  const canEdit = Boolean(isOwner || permissions.includes("products.manage") || permissions.includes("products.edit") || permissions.includes("inventory.manage"));
  const canDelete = Boolean(isOwner || permissions.includes("products.manage") || permissions.includes("products.delete"));
  const isCategoryRestricted = !isOwner && Array.isArray(allowedCategoryIds) && allowedCategoryIds.length > 0;
  const utils = trpc.useUtils();
  const [form, setForm] = useState(blankProduct);
  const [editing, setEditing] = useState<number | null>(null);
  const [showBulkStudio, setShowBulkStudio] = useState(false);
  const [aiReadingPhoto, setAiReadingPhoto] = useState(false);
  const singlePriceInputRef = useRef<HTMLInputElement>(null);
  const analyzeSingleMut = trpc.commerce.admin.products.analyzeImage.useMutation();
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [recommended, setRecommended] = useState<number | null>(null);
  const [recommendedIds, setRecommendedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [pubFilter, setPubFilter] = useState<"all" | "published" | "hidden">("all");
  const [visibleLimit, setVisibleLimit] = useState(25);
  const [quickPriceId, setQuickPriceId] = useState<number | null>(null);
  const [quickPriceVal, setQuickPriceVal] = useState("");
  const [showBulkPriceBox, setShowBulkPriceBox] = useState(false);
  const [bulkPriceCatId, setBulkPriceCatId] = useState<string>("all");
  const [bulkPriceMode, setBulkPriceMode] = useState<"percent" | "fixed">("percent");
  const [bulkPriceAmount, setBulkPriceAmount] = useState("");
  const [optimizingImages, setOptimizingImages] = useState(false);

  const refreshCatalog = async () => Promise.all([
    utils.commerce.catalog.home.invalidate(),
    utils.commerce.catalog.listProducts.invalidate(),
    utils.commerce.catalog.listCategories.invalidate(),
    utils.commerce.catalog.product.invalidate(),
  ]);

  const query = trpc.commerce.admin.products.list.useQuery(undefined, { retry: 1 });
  const rawCats = trpc.commerce.admin.categories.list.useQuery(undefined, { retry: 1 });
  const allowedCatsList = (rawCats.data ?? []).filter(c => !isCategoryRestricted || allowedCategoryIds.includes(c.id));
  const cats = { ...rawCats, data: allowedCatsList };
  useEffect(() => {
    try {
      const prefill = window.sessionStorage.getItem("prefill_new_product_name");
      if (prefill) {
        window.sessionStorage.removeItem("prefill_new_product_name");
        setForm(curr => ({ ...curr, name: prefill, categoryId: allowedCatsList[0]?.id ?? curr.categoryId }));
        toast.info("✨ تم تجهيز اسم المنتج المطلوب توفيره — أضف السعر والصورة واحفظه!");
      }
    } catch {}
  }, [rawCats.data?.length]);
  const bulkPriceMut = trpc.commerce.admin.products.bulkAdjustPrices.useMutation({
    onSuccess: async (res) => {
      toast.success("✅ تم تحديث أسعار " + res.updatedCount + " منتج بنجاح!");
      setShowBulkPriceBox(false);
      setBulkPriceAmount("");
      await Promise.all([utils.commerce.admin.products.list.invalidate(), refreshCatalog()]);
    },
    onError: err => toast.error(err.message),
  });

  const create = trpc.commerce.admin.products.create.useMutation({
    onSuccess: async () => {
      toast.success("تمت إضافة المنتج بنجاح ⚡");
      setForm(blankProduct);
      setShowVariantsModal(false);
      setShowWeightModal(false);
      setShowAdvancedFields(false);
      await Promise.all([utils.commerce.admin.products.list.invalidate(), utils.commerce.admin.overview.invalidate(), refreshCatalog()]);
    },
    onError: error => toast.error(error.message),
  });

  const update = trpc.commerce.admin.products.update.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ تعديلات المنتج بنجاح ⚡");
      setEditing(null);
      setForm(blankProduct);
      setShowVariantsModal(false);
      setShowWeightModal(false);
      setShowAdvancedFields(false);
      await Promise.all([utils.commerce.admin.products.list.invalidate(), refreshCatalog()]);
    },
    onError: error => toast.error(error.message),
  });

  const toggleVisibility = trpc.commerce.admin.products.update.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success(vars.values.isPublished ? "تم إظهار ونشر المنتج في المتجر" : "تم إخفاء المنتج عن الواجهة");
      await Promise.all([utils.commerce.admin.products.list.invalidate(), refreshCatalog()]);
    },
    onError: error => toast.error(error.message),
  });

  const deleteProduct = trpc.commerce.admin.products.delete.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success("تم حذف المنتج نهائياً");
      if (editing === vars.id) { setEditing(null); setForm(blankProduct); }
      await Promise.all([utils.commerce.admin.products.list.invalidate(), utils.commerce.admin.overview.invalidate(), refreshCatalog()]);
    },
    onError: error => toast.error(error.message),
  });

  const saveRecommendations = trpc.commerce.admin.products.setRecommendations.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث المنتجات المشابهة المقترحة");
      setRecommended(null);
      await utils.commerce.catalog.product.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const setField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => setForm(current => ({ ...current, [key]: value }));

  const runSinglePhotoAi = async (imgUrl: string, forceOverwrite = false) => {
    if (!imgUrl) { toast.error("اختر صورة المنتج أولاً"); return; }
    setAiReadingPhoto(true);
    try {
      const thumb = await makeVisionThumbDataUrl(imgUrl);
      const res = await analyzeSingleMut.mutateAsync({ imageDataUrl: thumb });
      setForm(curr => ({
        ...curr,
        name: (forceOverwrite || !curr.name.trim()) ? (res.name || curr.name) : curr.name,
        description: (forceOverwrite || !curr.description.trim()) ? (res.description || curr.description) : curr.description,
        categoryId: curr.categoryId ?? res.categoryId,
        weightEnabled: res.weightEnabled ? true : curr.weightEnabled,
        unit: res.weightEnabled ? "كيلو" : (curr.unit || res.unit || "حبة"),
      }));
      toast.success("✨ قرأ الذكاء الاصطناعي الصورة وكتب الاسم والوصف والقسم — اكتب السعر فقط!");
      setTimeout(() => { singlePriceInputRef.current?.focus(); }, 80);
    } catch {
      toast.error("تعذر قراءة الصورة تلقائياً، يمكنك كتابة الاسم يدوياً.");
    } finally {
      setAiReadingPhoto(false);
    }
  };

  const selectEdit = (item: NonNullable<typeof query.data>[number]) => {
    const unpacked = unpackProductVariants(item.description);
    setEditing(item.id);
    setForm({
      name: item.name,
      description: unpacked.cleanDescription,
      variants: unpacked.variants,
      variantDraft: "",
      weightEnabled: unpacked.weightEnabled,
      minWeightAmount: String(unpacked.minWeightAmount || 100),
      imageUrl: item.imageUrl ?? "",
      categoryId: item.categoryId,
      price: String(item.price),
      unit: item.unit,
      stock: item.stock === null ? "" : String(item.stock),
      minQuantity: String(item.minQuantity),
      quantityStep: String(item.quantityStep),
      isPublished: item.isPublished,
      isAvailable: item.isAvailable,
      sortOrder: String(item.sortOrder),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addDraftVariants = () => {
    const parts = form.variantDraft.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm(curr => ({ ...curr, variants: [...new Set([...curr.variants, ...parts])], variantDraft: "" }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const extraParts = form.variantDraft.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    const allVariants = [...new Set([...form.variants, ...extraParts])];
    const packedDesc = packProductVariants(form.description, allVariants, form.weightEnabled, Number(form.minWeightAmount) || 100);
    const effectiveUnit = form.weightEnabled && (form.unit === "حبة" || !form.unit.trim()) ? "كيلو" : (form.unit.trim() || "حبة");
    const values = {
      name: form.name,
      description: packedDesc,
      imageUrl: form.imageUrl || null,
      categoryId: form.categoryId,
      price: Number(form.price),
      unit: effectiveUnit,
      stock: form.stock === "" ? null : Number(form.stock),
      minQuantity: Number(form.minQuantity) || 1,
      quantityStep: Number(form.quantityStep) || 1,
      isPublished: form.isPublished,
      isAvailable: form.isAvailable,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (editing) update.mutate({ id: editing, values });
    else create.mutate(values);
  };

  const filteredProducts = (query.data ?? []).filter(item => {
    if (catFilter === "none" && item.categoryId !== null) return false;
    if (catFilter !== "all" && catFilter !== "none" && String(item.categoryId) !== catFilter) return false;
    if (pubFilter === "published" && !item.isPublished) return false;
    if (pubFilter === "hidden" && item.isPublished) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !(item.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const samplePricePerKg = Number(form.price) || 4000;

  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div><span className="eyebrow">كتالوج متجرك السريع</span><h1>إدارة المنتجات</h1><p>واجهة مبسطة وسريعة جداً لرفع أصناف البوفية بالساندوتش أو الوجبة أو بالوزن والمبلغ (فلافل، مقبلات، صحون).</p></div>
        <span className="admin-heading-mark"><Package size={25} /></span>
      </div>
      <div style={{ marginBottom: "14px", padding: "14px 16px", borderRadius: "18px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#ffffff", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between", boxShadow: "0 10px 24px rgba(94, 1, 11, 0.18)" }}>
        <div style={{ display: "grid", gap: "4px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#f1d897", fontSize: "12px", fontWeight: 900 }}>
            <Sparkles size={15} /> الأسرع على الإطلاق — توفير 90% من وقت الإدخال
          </span>
          <strong style={{ fontSize: "16px" }}>⚡ ارفع حتى 30 صورة منتج دفعة واحدة والذكاء الاصطناعي يكتب الاسم والوصف والقسم!</strong>
          <small style={{ color: "#d5e6dc", fontSize: "12px" }}>اختَر كل صور المنتجات من الاستوديو أو الصق قائمة أسعار، وسيبقى عليك فقط كتابة السعر أمام كل منتج.</small>
        </div>
        <button
          type="button"
          onClick={() => setShowBulkStudio(true)}
          style={{ padding: "11px 18px", borderRadius: "13px", border: "none", background: "#f1d897", color: "#123828", fontWeight: 900, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}
        >
          <ImagePlus size={17} /> فتح استوديو الإضافة السريعة (30 منتج)
        </button>
      </div>
      {showBulkStudio && (
        <SmartBulkProductsStudio
          categories={cats.data ?? []}
          onClose={() => setShowBulkStudio(false)}
          onSaved={async () => {
            await Promise.all([utils.commerce.admin.products.list.invalidate(), utils.commerce.admin.overview.invalidate(), refreshCatalog()]);
          }}
        />
      )}
      <section className="admin-form-card">
        <div className="form-card-heading">
          <span className="form-card-number">{editing ? "✳" : "01"}</span>
          <div><h2>{editing ? "تعديل المنتج: " + form.name : "إضافة منتج جديد"}</h2><p>أدخل الاسم والسعر والقسم والصورة فقط، واستخدم الأزرار السفلية عند الحاجة لإضافة خيارات أو بيع بالوزن.</p></div>
          {editing && <button type="button" className="small-button" onClick={() => { setEditing(null); setForm(blankProduct); }}>إلغاء التعديل<X size={14} /></button>}
        </div>
        <form onSubmit={submit} className="admin-form">
          <div className="product-form-layout">
            <div className="form-fields-grid">
              <label className="field-wide">اسم المنتج *<input required maxLength={180} value={form.name} onChange={e => setField("name", e.target.value)} placeholder="مثلاً: شاورما عربي، ساندوتش فلافل، عصير مانجو، صحن مقبلات..." /></label>
              <label>{form.weightEnabled ? "سعر الكيلو الواحد (1000 جرام) بالريال *" : "السعر بالريال اليمني *"}<input ref={singlePriceInputRef} required type="number" min="0" value={form.price} onChange={e => setField("price", e.target.value)} placeholder={form.weightEnabled ? "مثلاً: 4000 (سعر الكيلو)" : "0"} /></label>
              <label>القسم<select value={form.categoryId ?? ""} onChange={e => setField("categoryId", e.target.value ? Number(e.target.value) : null)}><option value="">اختر القسم...</option>{cats.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="field-wide">الوصف (اختياري)<textarea rows={2} value={form.description} onChange={e => setField("description", e.target.value)} placeholder="وصف مختصر للمنتج..." /></label>

              <div className="field-wide" style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingTop: "4px" }}>
                <button
                  type="button"
                  className={"small-button" + (form.weightEnabled ? " selected" : "")}
                  onClick={() => setShowWeightModal(true)}
                  style={{ padding: "8px 13px", borderRadius: "12px", fontWeight: 800, border: form.weightEnabled ? "1.5px solid #870210" : "1px solid #cbd8cf" }}
                >
                  ⚖️ {form.weightEnabled ? "البيع بالوزن والمبلغ: مفعّل ✅" : "تفعيل البيع بالوزن والمبلغ (فلافل / حمص / مقبلات)"}
                </button>

                <button
                  type="button"
                  className={"small-button" + (form.variants.length > 0 ? " selected" : "")}
                  onClick={() => setShowVariantsModal(true)}
                  style={{ padding: "8px 13px", borderRadius: "12px", fontWeight: 800, border: form.variants.length > 0 ? "1.5px solid #870210" : "1px solid #cbd8cf" }}
                >
                  🔀 {form.variants.length > 0 ? ("الأنواع المضافة (" + form.variants.length + "): " + form.variants.slice(0, 3).join("، ")) : "إضافة أنواع / خيارات للمنتج"}
                </button>

                <button
                  type="button"
                  className={"small-button" + (showAdvancedFields ? " selected" : "")}
                  onClick={() => setShowAdvancedFields(v => !v)}
                  style={{ padding: "8px 13px", borderRadius: "12px" }}
                >
                  ⚙️ {showAdvancedFields ? "إخفاء الخيارات الإضافية" : "خيارات إضافية (الوحدة / المخزون)"}
                </button>
              </div>

              {showAdvancedFields && (
                <div className="field-wide form-fields-grid" style={{ padding: "12px", borderRadius: "14px", background: "#f7faf8", border: "1px solid #dce6df" }}>
                  <label>وحدة البيع<input required value={form.unit} onChange={e => setField("unit", e.target.value)} placeholder="ساندوتش، وجبة، صحن، عربي، كوب، حبة..." />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                      {["ساندوتش", "وجبة", "عربي", "صحن", "بوكس", "كوب", "لتر", "حبة"].map(u => (
                        <button key={u} type="button" className={"small-button" + (form.unit === u ? " selected" : "")} style={{ minHeight: "24px", padding: "0 8px", fontSize: "10px" }} onClick={() => setField("unit", u)}>{u}</button>
                      ))}
                    </div>
                  </label>
                  <label>الكمية المتوفرة بالمخزون<input type="number" min="0" value={form.stock} onChange={e => setField("stock", e.target.value)} placeholder="اتركه فارغًا إذا مفتوح" /></label>
                  <label>الحد الأدنى للكمية<input required type="number" min="1" value={form.minQuantity} onChange={e => setField("minQuantity", e.target.value)} /></label>
                  <label>ترتيب العرض<input type="number" value={form.sortOrder} onChange={e => setField("sortOrder", e.target.value)} /></label>
                  <label className="toggle-field"><input type="checkbox" checked={form.isPublished} onChange={e => setField("isPublished", e.target.checked)} /> نشر المنتج في المتجر</label>
                  <label className="toggle-field"><input type="checkbox" checked={form.isAvailable} onChange={e => setField("isAvailable", e.target.checked)} /> متاح للشراء</label>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <ImageField title="قص وتجهيز صورة المنتج" value={form.imageUrl} onChange={imageUrl => { setField("imageUrl", imageUrl); if (imageUrl && !form.name.trim()) { void runSinglePhotoAi(imageUrl, false); } }} kind="product" aspect={1} />
              {form.imageUrl && (
                <button type="button" className="small-button selected" disabled={aiReadingPhoto} onClick={() => void runSinglePhotoAi(form.imageUrl, true)} style={{ justifyContent: "center", width: "100%" }}>
                  {aiReadingPhoto ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
                  {aiReadingPhoto ? "جارٍ قراءة المنتج من الصورة..." : "🤖 استخراج الاسم والوصف من الصورة بالذكاء الاصطناعي"}
                </button>
              )}
            </div>
          </div>

          {showWeightModal && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowWeightModal(false)} style={{ zIndex: 180 }}>
              <section className="checkout-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "460px", padding: "20px" }}>
                <div className="modal-heading" style={{ marginBottom: "12px" }}>
                  <div>
                    <span className="eyebrow">للفلافل والمقبلات والطلبات بالمبلغ والوزن</span>
                    <h2 style={{ fontSize: "18px", margin: "2px 0" }}>⚖️ إعداد البيع بالوزن والمبلغ</h2>
                  </div>
                  <button type="button" className="icon-button" onClick={() => setShowWeightModal(false)}><X size={18} /></button>
                </div>
                <div style={{ display: "grid", gap: "12px" }}>
                  <label className="toggle-field" style={{ padding: "12px", borderRadius: "12px", background: form.weightEnabled ? "#fceee9" : "#f5f5f2", border: form.weightEnabled ? "1.5px solid #870210" : "1px solid #dcdcd4", fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={form.weightEnabled}
                      onChange={e => {
                        const checked = e.target.checked;
                        setForm(curr => ({ ...curr, weightEnabled: checked, unit: checked && curr.unit === "حبة" ? "كيلو" : curr.unit }));
                      }}
                    />
                    <span>تفعيل شراء هذا المنتج بالمبلغ والوزن (يكتب الزبون المبلغ ويظهر له الوزن تلقائياً)</span>
                  </label>

                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#870210" }}>
                    <span>سعر الكيلو الواحد (1000 جرام) بالريال اليمني:</span>
                    <input type="number" min="100" step="50" value={form.price} onChange={e => setField("price", e.target.value)} placeholder="مثلاً: 4000" />
                  </label>

                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#870210" }}>
                    <span>أقل مبلغ مسموح للزبون أن يشتري به (ر.ي):</span>
                    <input type="number" min="50" step="50" value={form.minWeightAmount} onChange={e => setField("minWeightAmount", e.target.value)} placeholder="مثلاً: 100 أو 200" />
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {[100, 200, 300, 500, 1000].map(mAmt => (
                      <button key={mAmt} type="button" className={"small-button" + (Number(form.minWeightAmount) === mAmt ? " selected" : "")} onClick={() => setField("minWeightAmount", String(mAmt))}>
                        أقل مبلغ: {mAmt} ر.ي
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: "12px", borderRadius: "12px", background: "#fdf6f0", border: "1px solid #cbe0d2", fontSize: "12px", lineHeight: 1.6, color: "#870210" }}>
                    <strong>كيف يظهر للزبون في المتجر؟</strong>
                    <div>• إذا كتب الزبون <b>{Math.round(samplePricePerKg * 0.125).toLocaleString("en-US")} ر.ي</b> ← يظهر له الوزن: <b>125 جرام (ثمن كيلو)</b></div>
                    <div>• إذا كتب الزبون <b>{Math.round(samplePricePerKg * 0.25).toLocaleString("en-US")} ر.ي</b> ← يظهر له الوزن: <b>250 جرام (ربع كيلو)</b></div>
                    <div>• إذا كتب الزبون <b>{Math.round(samplePricePerKg * 0.5).toLocaleString("en-US")} ر.ي</b> ← يظهر له الوزن: <b>500 جرام (نصف كيلو)</b></div>
                  </div>

                  <button type="button" className="button button-primary full-button" onClick={() => setShowWeightModal(false)}>
                    <Check size={16} /> اعتماد إعدادات الوزن والمبلغ
                  </button>
                </div>
              </section>
            </div>
          )}

          {showVariantsModal && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowVariantsModal(false)} style={{ zIndex: 180 }}>
              <section className="checkout-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "460px", padding: "20px" }}>
                <div className="modal-heading" style={{ marginBottom: "12px" }}>
                  <div>
                    <span className="eyebrow">خيارات المنتج المتعددة</span>
                    <h2 style={{ fontSize: "18px", margin: "2px 0" }}>🔀 إضافة أنواع أو نكهات للمنتج</h2>
                    <small style={{ color: "#7a564c" }}>مثل: عادي، صاروخ، عربي، دبل، حار، بالجبن، بدون سكر...</small>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                    {["عادي", "صاروخ", "عربي", "سوبر", "دبل", "بالجبن", "حار 🌶️", "بدون شطة", "خبز صاج", "خبز شامي", "كوب كبير", "كوب وسط", "بدون سكر"].map(vp => (
                      <button
                        key={vp}
                        type="button"
                        className="small-button"
                        style={{ minHeight: "25px", padding: "0 8px", fontSize: "10.5px" }}
                        onClick={() => {
                          if (!form.variants.includes(vp)) setField("variants", [...form.variants, vp]);
                        }}
                      >
                        + {vp}
                      </button>
                    ))}
                  </div>
                  </div>
                  <button type="button" className="icon-button" onClick={() => setShowVariantsModal(false)}><X size={18} /></button>
                </div>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={form.variantDraft}
                      onChange={e => setField("variantDraft", e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDraftVariants(); } }}
                      placeholder="اكتب النوع (أو عدة أنواع بفاصلة) ثم اضغط إضافة"
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="small-button selected" onClick={addDraftVariants}><Plus size={14} /> إضافة</button>
                  </div>
                  {form.variants.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "10px", borderRadius: "12px", background: "#f4f8f5" }}>
                      {form.variants.map(v => (
                        <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 11px", borderRadius: "99px", background: "#870210", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>
                          {v}
                          <button type="button" onClick={() => setField("variants", form.variants.filter(x => x !== v))} style={{ border: 0, background: "transparent", color: "#f1d897", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}><X size={13} /></button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="subtle-note">لم تُضف أنواع بعد لهذا المنتج.</p>
                  )}
                  <button type="button" className="button button-primary full-button" onClick={() => { addDraftVariants(); setShowVariantsModal(false); }}>
                    <Check size={16} /> اعتماد الأنواع وإغلاق النافذة
                  </button>
                </div>
              </section>
            </div>
          )}

          <div className="form-submit-row" style={{ gap: "8px" }}>
            <button type="submit" className="button button-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? <LoaderCircle size={16} className="spin" /> : editing ? <Save size={16} /> : <Plus size={17} />}
              {editing ? "حفظ التعديلات" : "إضافة المنتج الآن"}
            </button>
            {editing && (
              <button type="button" className="button button-quiet" onClick={() => { setEditing(null); setForm(blankProduct); }}>
                إلغاء
              </button>
            )}
          </div>
        </form>
      </section>

      <div className="admin-section-heading">
        <div><h2>كل المنتجات</h2><p>تعديل، إخفاء/نشر، أو حذف نهائي لأي منتج.</p></div>
        <span className="count-chip">{filteredProducts.length} / {query.data?.length ?? 0}</span>
      </div>

      {isCategoryRestricted && (
        <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "12px", background: "#fdf4ef", border: "1.5px solid #870210", color: "#870210", fontSize: "12.5px", fontWeight: 800 }}>
          🔒 نطاق صلاحياتك في المنتجات مخصص للأقسام التالية فقط: {allowedCatsList.map(c => "«" + c.name + "»").join("، ") || "أقسام محددة"}
          {!canDelete ? " · (صلاحية الحذف النهائي غير مفعلة لحسابك لحماية الكتالوج)" : ""}
        </div>
      )}
      {canEdit && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button type="button" className={"small-button" + (showBulkPriceBox ? " selected" : "")} onClick={() => setShowBulkPriceBox(v => !v)} style={{ fontWeight: 800 }}>
            💰 {showBulkPriceBox ? "إخفاء أداة تعديل الأسعار الجماعي" : "تعديل جماعي لأسعار قسم كامل أو كل المنتجات (نسبة % أو مبلغ ثابت)"}
          </button>
          <button
            type="button"
            className="small-button"
            disabled={optimizingImages || !query.data?.length}
            onClick={async () => {
              const list = (query.data ?? []).filter(p => Boolean(p.imageUrl));
              if (!list.length) { toast.info("لا توجد صور منتجات لضغطها"); return; }
              if (!window.confirm("سيقوم النظام الآن بتحسين وضبط صور المنتجات الحالية (" + list.length + " صورة) بدقة فائقة الوضوح (~95 إلى 110 كيلوبايت للصورة). هل تود البدء؟")) return;
              setOptimizingImages(true);
              let count = 0;
              toast.info("⚡ جارٍ ضغط وتخفيف حجم صور المنتجات الحالية...");
              for (const prod of list) {
                try {
                  if (!prod.imageUrl) continue;
                  const lightDataUrl = await recompressImageUrlToLightWebp(prod.imageUrl, "product");
                  await toggleVisibility.mutateAsync({ id: prod.id, values: { imageUrl: lightDataUrl } });
                  count++;
                } catch {}
              }
              setOptimizingImages(false);
              await Promise.all([utils.commerce.admin.products.list.invalidate(), refreshCatalog()]);
              toast.success("🎉 تم ضغط وتخفيف حجم " + count + " صورة منتج بنجاح (أصبحت خفيفة وسريعة جداً)!");
            }}
            style={{ fontWeight: 800, background: "#fdf4ef", color: "#870210", borderColor: "#b8d8c4" }}
          >
            {optimizingImages ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
            {optimizingImages ? "جارٍ ضغط الصور الحالية..." : "✨ تحسين صور المنتجات الحالية لدقة فائقة (HD ~100 كيلوبايت)"}
          </button>
          </div>
          {showBulkPriceBox && (
            <div style={{ marginTop: "8px", padding: "14px", borderRadius: "14px", background: "#f6faf7", border: "1.5px solid #bfd6c7", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
              <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#870210" }}>
                <span>القسم المستهدف:</span>
                <select value={bulkPriceCatId} onChange={e => setBulkPriceCatId(e.target.value)} style={{ padding: "7px 10px", borderRadius: "10px", background: "#fff" }}>
                  <option value="all">{isCategoryRestricted ? "كل الأقسام المسموحة لي" : "كل منتجات المتجر"}</option>
                  {cats.data?.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#870210" }}>
                <span>طريقة التعديل:</span>
                <select value={bulkPriceMode} onChange={e => setBulkPriceMode(e.target.value as any)} style={{ padding: "7px 10px", borderRadius: "10px", background: "#fff" }}>
                  <option value="percent">نسبة مئوية % (مثلاً +10 أو -5)</option>
                  <option value="fixed">مبلغ ثابت بالريال (مثلاً +100 أو -50)</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#870210" }}>
                <span>المقدار (موجب للزيادة أو سالب للتخفيض):</span>
                <input type="number" value={bulkPriceAmount} onChange={e => setBulkPriceAmount(e.target.value)} placeholder={bulkPriceMode === "percent" ? "مثلاً: 10 أو -10" : "مثلاً: 100 أو -100"} style={{ padding: "7px 10px", borderRadius: "10px", background: "#fff", width: "160px" }} />
              </label>
              <button
                type="button"
                className="button button-primary"
                disabled={bulkPriceMut.isPending || !bulkPriceAmount.trim() || Number(bulkPriceAmount) === 0}
                onClick={() => {
                  const amt = Number(bulkPriceAmount);
                  if (!amt) return;
                  if (!window.confirm("هل أنت متأكد من تعديل الأسعار جماعياً بمقدار " + (bulkPriceMode === "percent" ? (amt + "%") : (amt + " ر.ي")) + "؟")) return;
                  bulkPriceMut.mutate({ categoryId: bulkPriceCatId === "all" ? null : Number(bulkPriceCatId), mode: bulkPriceMode, amount: amt, roundTo50: true });
                }}
              >
                {bulkPriceMut.isPending ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} تطبيق تعديل الأسعار الآن
              </button>
            </div>
          )}
        </div>
      )}
      <div className="filter-bar" style={{ marginBottom: "14px" }}>
        <label className="filter-search"><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ابحث باسم المنتج..." /></label>
        <label className="filter-select">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">كل الأقسام</option>
            <option value="none">بلا قسم</option>
            {cats.data?.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <select value={pubFilter} onChange={e => setPubFilter(e.target.value as any)}>
            <option value="all">كل الحالات</option>
            <option value="published">منشور في المتجر</option>
            <option value="hidden">مخفي / مسودة</option>
          </select>
        </label>
      </div>

      {query.isLoading ? <AdminLoading /> : query.error ? <AdminError message={query.error.message} retry={() => void query.refetch()} /> : !filteredProducts.length ? <AdminEmpty title="لا توجد منتجات مطابقة" text="أضف منتجاً جديداً أو غيّر خيارات البحث والفلترة." /> : (
        <div className="entity-list">
          {filteredProducts.slice(0, visibleLimit).map(item => {
            const meta = unpackProductVariants(item.description);
            return (
              <article className="entity-row" key={item.id}>
                <div className="entity-image">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Leaf size={19} />}</div>
                <div className="entity-main">
                  <strong>{item.name}</strong>
                  <small>
                    {cats.data?.find(cat => cat.id === item.categoryId)?.name || "بلا قسم"} · {meta.weightEnabled ? "⚖️ يباع بالوزن والمبلغ (سعر الكيلو)" : item.unit} · {item.stock === null ? "المخزون مفتوح" : "المخزون " + item.stock}
                    {meta.variants.length > 0 ? " · الأنواع: " + meta.variants.join(" / ") : ""}
                  </small>
                </div>
                <div className="entity-price">
                  {quickPriceId === item.id ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        autoFocus
                        value={quickPriceVal}
                        onChange={e => setQuickPriceVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const nextP = Math.max(0, Number(quickPriceVal) || 0);
                            toggleVisibility.mutate({ id: item.id, values: { price: nextP } });
                            setQuickPriceId(null);
                          } else if (e.key === "Escape") {
                            setQuickPriceId(null);
                          }
                        }}
                        style={{ width: "86px", padding: "4px 7px", borderRadius: "8px", border: "1.5px solid #870210", fontWeight: 900, fontSize: "13px" }}
                      />
                      <button type="button" className="small-button selected" style={{ padding: "4px 7px", minHeight: "28px" }} onClick={() => { const nextP = Math.max(0, Number(quickPriceVal) || 0); toggleVisibility.mutate({ id: item.id, values: { price: nextP } }); setQuickPriceId(null); }}><Check size={13} /></button>
                      <button type="button" className="small-button" style={{ padding: "4px 6px", minHeight: "28px" }} onClick={() => setQuickPriceId(null)}><X size={13} /></button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { if (canEdit) { setQuickPriceId(item.id); setQuickPriceVal(String(item.price)); } }}
                      title={canEdit ? "اضغط لتعديل السعر فوراً بضغطة واحدة" : undefined}
                      style={{ cursor: canEdit ? "pointer" : "default", display: "inline-block", padding: "3px 7px", borderRadius: "8px", background: canEdit ? "#f3f8f5" : "transparent", border: canEdit ? "1px dashed #b9d4c3" : "none" }}
                    >
                      {money(item.price)} {canEdit && <small style={{ fontSize: "10px", color: "#870210" }}>✏️</small>}
                      {meta.weightEnabled ? <small style={{ display: "block", fontSize: "10px", color: "#870210" }}>لكل كيلو</small> : null}
                    </span>
                  )}
                </div>
                <span className={"visibility-tag " + (item.isPublished ? "visible" : "hidden")}>{item.isPublished ? "منشور" : "مخفي"}</span>
                <div className="entity-actions">
                  {canEdit && <button type="button" className="small-button" onClick={() => selectEdit(item)}>تعديل</button>}
                  {canAdd && <button type="button" className="small-button" onClick={() => { selectEdit(item); setEditing(null); setField("name", item.name + " (نسخة)"); toast.info("تم نسخ بيانات المنتج — عدّل السعر أو الاسم واضغط إضافة"); }}>نسخ</button>}
                  {canEdit && (
                    <button
                      type="button"
                      className={"small-button " + (item.isPublished ? "" : "selected")}
                      onClick={() => toggleVisibility.mutate({ id: item.id, values: { isPublished: !item.isPublished, isAvailable: !item.isPublished ? true : item.isAvailable } })}
                    >
                      {item.isPublished ? "إخفاء" : "نشر الآن"}
                    </button>
                  )}
                  {canEdit && <button type="button" className="small-button" onClick={() => { setRecommended(recommended === item.id ? null : item.id); setRecommendedIds([]); }}>شبيه</button>}
                  {canDelete && (
                    <button
                      type="button"
                      className="small-button danger-soft"
                      onClick={() => {
                        if (window.confirm("هل أنت متأكد من حذف المنتج «" + item.name + "» نهائياً من المتجر؟")) {
                          deleteProduct.mutate({ id: item.id });
                        }
                      }}
                    >
                      <Trash2 size={14} /> حذف
                    </button>
                  )}
                </div>
                {recommended === item.id && (
                  <div className="recommendation-editor">
                    <strong>اختر منتجات مقترحة تظهر مع «{item.name}»</strong>
                    <div className="recommendation-options">
                      {(query.data ?? []).filter(other => other.id !== item.id).map(other => (
                        <label key={other.id}>
                          <input type="checkbox" checked={recommendedIds.includes(other.id)} onChange={e => setRecommendedIds(current => e.target.checked ? [...current, other.id] : current.filter(id => id !== other.id))} />
                          {other.name}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button type="button" className="small-button selected" onClick={() => saveRecommendations.mutate({ productId: item.id, recommendedIds })}>حفظ التوصيات</button>
                      <button type="button" className="small-button" onClick={() => setRecommended(null)}>إغلاق</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {filteredProducts.length > visibleLimit && (
            <button
              type="button"
              className="button button-outline full-button"
              onClick={() => setVisibleLimit(l => l + 30)}
              style={{ marginTop: "10px", fontWeight: 800 }}
            >
              عرض المزيد من المنتجات ({filteredProducts.length - visibleLimit} متبقية)
            </button>
          )}
        </div>
      )}
    </div>
  );
}


function CategoriesPanel() {
  const utils = trpc.useUtils();
  const query = trpc.commerce.admin.categories.list.useQuery(undefined, { retry: 1 });
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", imageUrl: "", color: "#870210", isActive: true, sortOrder: "0" });

  const reset = () => { setEditing(null); setForm({ name: "", description: "", imageUrl: "", color: "#870210", isActive: true, sortOrder: "0" }); };
  const refreshAll = async () => {
    await Promise.all([
      utils.commerce.admin.categories.list.invalidate(),
      utils.commerce.catalog.home.invalidate(),
      utils.commerce.catalog.listCategories.invalidate(),
      utils.commerce.admin.overview.invalidate(),
    ]);
  };

  const create = trpc.commerce.admin.categories.create.useMutation({
    onSuccess: async () => { toast.success("تم إنشاء القسم بنجاح"); reset(); await refreshAll(); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.commerce.admin.categories.update.useMutation({
    onSuccess: async () => { toast.success("تم تحديث القسم بنجاح"); reset(); await refreshAll(); },
    onError: error => toast.error(error.message),
  });
  const toggleActive = trpc.commerce.admin.categories.update.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success(vars.values.isActive ? "تم تفعيل القسم" : "تم إيقاف القسم مؤقتاً");
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });
  const deleteCategory = trpc.commerce.admin.categories.delete.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success("تم حذف القسم نهائياً");
      if (editing === vars.id) reset();
      await Promise.all([refreshAll(), utils.commerce.admin.products.list.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const values = { ...form, description: form.description || null, imageUrl: form.imageUrl || null, sortOrder: Number(form.sortOrder) };
    if (editing) update.mutate({ id: editing, values });
    else create.mutate(values);
  };

  return (
    <div className="admin-content">
      <AdminHeading eyebrow="تنظيم المتجر" title="إدارة الأقسام" text="أضف وعدّل واحذف أقسام المتجر وصورها وألوانها وترتيبها بمرونة كاملة." icon={SlidersHorizontal} />
      <section className="admin-form-card">
        <div className="form-card-heading">
          <span className="form-card-number">{editing ? "✳" : "01"}</span>
          <div><h2>{editing ? "تعديل القسم: " + form.name : "إضافة قسم جديد"}</h2><p>أضف الأقسام التي يحتاجها متجرك، ويمكنك تعديلها أو حذفها في أي وقت.</p></div>
          {editing && <button type="button" className="small-button" onClick={reset}>إلغاء التعديل<X size={14} /></button>}
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className="product-form-layout">
            <div className="form-fields-grid">
              <label>اسم القسم<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label>لون زر القسم
  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
    <input type="color" value={form.color || "#870210"} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: "42px", height: "36px", padding: "2px", borderRadius: "10px", cursor: "pointer" }} />
    {["#870210", "#e86c12", "#b8332a", "#5e010b", "#d97706", "#15803d", "#374151"].map(preset => (
      <button key={preset} type="button" onClick={() => setForm({ ...form, color: preset })} style={{ width: "24px", height: "24px", borderRadius: "999px", background: preset, border: form.color === preset ? "2.5px solid #111827" : "1px solid #cbd5e1", cursor: "pointer" }} title={preset} />
    ))}
  </div>
</label>
              <label className="field-wide">وصف (اختياري)<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
              <label>ترتيب العرض<input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} /></label>
              <label className="toggle-field"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> القسم مفعّل في الواجهة</label>
            </div>
            <ImageField title="قص وتجهيز صورة القسم" value={form.imageUrl} onChange={imageUrl => setForm(curr => ({ ...curr, imageUrl }))} kind="category" aspect={4 / 5} />
          </div>
          <div className="form-submit-row" style={{ gap: "8px" }}>
            <button type="submit" className="button button-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? <LoaderCircle size={16} className="spin" /> : editing ? <Save size={16} /> : <Plus size={16} />}
              {editing ? "حفظ تعديلات القسم" : "إنشاء القسم"}
            </button>
            {editing && <button type="button" className="button button-quiet" onClick={reset}>إلغاء</button>}
          </div>
        </form>
      </section>
      <div className="admin-section-heading">
        <div><h2>أقسام المتجر الحالية</h2><p>يمكنك التعديل أو الإيقاف المؤقت أو الحذف النهائي لأي قسم.</p></div>
        <span className="count-chip">{query.data?.length ?? 0}</span>
      </div>
      {query.isLoading ? <AdminLoading /> : !query.data?.length ? <AdminEmpty title="ابدأ بأول قسم" text="لم تُنشأ أقسام حتى الآن." /> : (
        <div className="entity-list">
          {query.data.map(item => (
            <article className="entity-row" key={item.id}>
              <div className="entity-image" style={{ backgroundColor: item.color + "16", color: item.color }}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Leaf size={20} />}</div>
              <div className="entity-main">
                <strong>{item.name}</strong>
                <small>{item.description || "لا يوجد وصف"} · الترتيب {item.sortOrder}</small>
              </div>
              <span className={"visibility-tag " + (item.isActive ? "visible" : "hidden")}>{item.isActive ? "نشط" : "متوقف"}</span>
              <div className="entity-actions">
                <button
                  type="button"
                  className="small-button"
                  onClick={() => {
                    setEditing(item.id);
                    setForm({ name: item.name, description: item.description ?? "", imageUrl: item.imageUrl ?? "", color: item.color, isActive: item.isActive, sortOrder: String(item.sortOrder) });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  تعديل
                </button>
                <button
                  type="button"
                  className={"small-button " + (item.isActive ? "" : "selected")}
                  onClick={() => toggleActive.mutate({ id: item.id, values: { isActive: !item.isActive } })}
                >
                  {item.isActive ? "إيقاف" : "تفعيل"}
                </button>
                <button
                  type="button"
                  className="small-button danger-soft"
                  onClick={() => {
                    if (window.confirm("هل أنت متأكد من حذف القسم «" + item.name + "» نهائياً؟ (ستبقى المنتجات في المتجر دون حذف).")) {
                      deleteCategory.mutate({ id: item.id });
                    }
                  }}
                >
                  <Trash2 size={14} /> حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type AdminBannerCfg = {
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
};

const blankBannerCfg: AdminBannerCfg = {
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

function unpackAdminBannerUrl(rawActionUrl?: string | null): { targetUrl: string; cfg: AdminBannerCfg } {
  const raw = String(rawActionUrl || "").trim();
  const marker = "#bcfg=";
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    return { targetUrl: raw, cfg: { ...blankBannerCfg, clickMode: raw ? "full" : "full" } };
  }
  const targetUrl = raw.slice(0, idx).trim();
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(idx + marker.length)));
    return {
      targetUrl,
      cfg: {
        placement: ["top", "middle", "bottom", "popup"].includes(parsed.placement) ? parsed.placement : "top",
        size: ["auto", "small", "medium", "large"].includes(parsed.size) ? parsed.size : "auto",
        clickMode: ["full", "hotspot", "none"].includes(parsed.clickMode) ? parsed.clickMode : "full",
        hx: typeof parsed.hx === "number" ? Math.max(0, Math.min(95, parsed.hx)) : 8,
        hy: typeof parsed.hy === "number" ? Math.max(0, Math.min(95, parsed.hy)) : 44,
        hw: typeof parsed.hw === "number" ? Math.max(5, Math.min(100, parsed.hw)) : 34,
        hh: typeof parsed.hh === "number" ? Math.max(5, Math.min(100, parsed.hh)) : 24,
        shade: Boolean(parsed.shade),
        showTitle: Boolean(parsed.showTitle),
        showBtn: Boolean(parsed.showBtn),
        popupOnce: parsed.popupOnce !== false,
      },
    };
  } catch {
    return { targetUrl, cfg: { ...blankBannerCfg } };
  }
}

function packAdminBannerUrl(targetUrl: string, cfg: AdminBannerCfg): string {
  const cleanTarget = targetUrl.trim();
  return cleanTarget + "#bcfg=" + encodeURIComponent(JSON.stringify(cfg));
}

export type AdminDeliveryStreet = {
  id: string;
  name: string;
  fee: number;
  promoFee: number | null;
  promoLabel: string;
  freeAbove: number | null;
  etaText: string;
  enabled: boolean;
};

export type AdminDeliveryArea = {
  id: string;
  name: string;
  defaultFee: number;
  enabled: boolean;
  streets: AdminDeliveryStreet[];
};

export type AdminDeliveryCity = {
  id: string;
  name: string;
  defaultFee: number;
  freeDeliveryPromo: boolean;
  promoBanner: string;
  enabled: boolean;
  areas: AdminDeliveryArea[];
};

export type AdminVipFreePhone = {
  phone: string;
  name: string;
  minOrder: number;
  enabled: boolean;
};

export type AdminDeliveryTreeConfig = {
  strictSelectionOnly: boolean;
  globalFreeAbove: number | null;
  cities: AdminDeliveryCity[];
  vipFreePhones: AdminVipFreePhone[];
};

function makeDefaultYemenDeliveryTree(): AdminDeliveryTreeConfig {
  return {
    strictSelectionOnly: true,
    globalFreeAbove: null,
    vipFreePhones: [],
    cities: [
      {
        id: "city_sanaa",
        name: "صنعاء",
        defaultFee: 500,
        freeDeliveryPromo: false,
        promoBanner: "",
        enabled: true,
        areas: [
          {
            id: "area_maeen",
            name: "معين",
            defaultFee: 500,
            enabled: true,
            streets: [
              { id: "st_raqqas", name: "الرقاص", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
              { id: "st_daeri", name: "الدائري", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
              { id: "st_hael", name: "شارع هائل", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
              { id: "st_sunaina", name: "السنينة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
              { id: "st_asr", name: "عصر", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
              { id: "st_madhbah", name: "مذبح", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
            ],
          },
          {
            id: "area_sabeen",
            name: "السبعين",
            defaultFee: 600,
            enabled: true,
            streets: [
              { id: "st_haddah", name: "حدة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 40 دقيقة", enabled: true },
              { id: "st_asbahi", name: "الأصبحي", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
              { id: "st_baitbaws", name: "بيت بوس", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
              { id: "st_maqaleh", name: "شارع المقالح", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
              { id: "st_shumaila", name: "شميلة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
            ],
          },
          {
            id: "area_wahdah",
            name: "الوحدة",
            defaultFee: 500,
            enabled: true,
            streets: [
              { id: "st_jazaer", name: "شارع الجزائر", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
              { id: "st_baghdad", name: "شارع بغداد", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
              { id: "st_siyasi", name: "الحي السياسي", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
              { id: "st_tahrir", name: "التحرير", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
            ],
          },
          {
            id: "area_shoub",
            name: "شعوب والثورة",
            defaultFee: 600,
            enabled: true,
            streets: [
              { id: "st_hasaba", name: "الحصبة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
              { id: "st_juraf", name: "الجراف", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
              { id: "st_sawan", name: "سعوان", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
              { id: "st_sheraton", name: "شيراتون", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
            ],
          },
        ],
      },
      {
        id: "city_ibb",
        name: "إب",
        defaultFee: 500,
        freeDeliveryPromo: false,
        promoBanner: "",
        enabled: true,
        areas: [
          {
            id: "area_dhihar",
            name: "الظهار",
            defaultFee: 500,
            enabled: true,
            streets: [
              { id: "st_ibb_taiz", name: "شارع تعز", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
              { id: "st_ibb_daeri", name: "الدائري", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
              { id: "st_ibb_subul", name: "السبل", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
            ],
          },
          {
            id: "area_mashanah",
            name: "المشنة",
            defaultFee: 500,
            enabled: true,
            streets: [
              { id: "st_ibb_odain", name: "شارع العدين", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
              { id: "st_ibb_maayen", name: "المعاين", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
            ],
          },
        ],
      },
    ],
  };
}

function parseAdminDeliveryTree(raw?: string | null): AdminDeliveryTreeConfig {
  if (!raw) return makeDefaultYemenDeliveryTree();
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return { strictSelectionOnly: true, globalFreeAbove: null, cities: [], vipFreePhones: [] };
    return {
      strictSelectionOnly: p.strictSelectionOnly !== false,
      globalFreeAbove: p.globalFreeAbove && Number(p.globalFreeAbove) > 0 ? Math.floor(Number(p.globalFreeAbove)) : null,
      cities: Array.isArray(p.cities) && p.cities.length > 0 ? p.cities : makeDefaultYemenDeliveryTree().cities,
      vipFreePhones: Array.isArray(p.vipFreePhones) ? p.vipFreePhones : [],
    };
  } catch {
    return { strictSelectionOnly: true, globalFreeAbove: null, cities: [], vipFreePhones: [] };
  }
}

function DeliveryZonesPanel() {
  const utils = trpc.useUtils();
  const query = trpc.commerce.admin.settings.get.useQuery(undefined, { retry: 1 });
  const [loaded, setLoaded] = useState(false);
  const [tree, setTree] = useState<AdminDeliveryTreeConfig>({ strictSelectionOnly: true, globalFreeAbove: null, cities: [], vipFreePhones: [] });
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  const [newCityName, setNewCityName] = useState("");
  const [newCityFee, setNewCityFee] = useState("500");
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaFee, setNewAreaFee] = useState("500");
  const [newStreetsText, setNewStreetsText] = useState("");
  const [newStreetFee, setNewStreetFee] = useState("500");
  const [newStreetPromoFee, setNewStreetPromoFee] = useState("");
  const [newStreetFreeAbove, setNewStreetFreeAbove] = useState("");
  const [newStreetEta, setNewStreetEta] = useState("25 - 40 دقيقة");

  const [vipPhone, setVipPhone] = useState("");
  const [vipName, setVipName] = useState("");
  const [vipMinOrder, setVipMinOrder] = useState("0");
  const [bulkAreaFee, setBulkAreaFee] = useState("");

  useEffect(() => {
    if (!query.data || loaded) return;
    const parsed = parseAdminDeliveryTree((query.data as any).deliveryTreeConfig);
    setTree(parsed);
    if (parsed.cities[0]) {
      setSelectedCityId(parsed.cities[0].id);
      if (parsed.cities[0].areas[0]) setSelectedAreaId(parsed.cities[0].areas[0].id);
    }
    setLoaded(true);
  }, [query.data, loaded]);

  const saveMut = trpc.commerce.admin.settings.save.useMutation({
    onSuccess: async () => {
      toast.success("✅ تم حفظ واعتماد منظومة مناطق وأسعار وعروض التوصيل في المتجر فوراً!");
      await Promise.all([utils.commerce.admin.settings.get.invalidate(), utils.commerce.catalog.home.invalidate()]);
    },
    onError: err => toast.error(err.message),
  });

  const saveTreeNow = (nextTree: AdminDeliveryTreeConfig) => {
    setTree(nextTree);
    const flatZones = nextTree.cities.map(c => ({ name: c.name, fee: c.defaultFee, enabled: c.enabled }));
    saveMut.mutate({
      deliveryEnabled: true,
      deliveryFee: nextTree.cities[0]?.defaultFee ?? 500,
      deliveryZones: flatZones.length ? flatZones : undefined,
      deliveryTreeConfig: JSON.stringify(nextTree),
    } as any);
  };

  const activeCity = tree.cities.find(c => c.id === selectedCityId) ?? tree.cities[0] ?? null;
  const activeArea = activeCity?.areas.find(a => a.id === selectedAreaId) ?? activeCity?.areas[0] ?? null;

  const totalAreas = tree.cities.reduce((sum, c) => sum + c.areas.length, 0);
  const totalStreets = tree.cities.reduce((sum, c) => sum + c.areas.reduce((s2, a) => s2 + a.streets.length, 0), 0);

  const addCity = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCityName.trim();
    if (!name) return;
    const id = "city_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5);
    const fee = Math.max(0, Number(newCityFee) || 0);
    const nextCity: AdminDeliveryCity = { id, name, defaultFee: fee, freeDeliveryPromo: false, promoBanner: "", enabled: true, areas: [] };
    const nextTree = { ...tree, cities: [...tree.cities, nextCity] };
    setTree(nextTree);
    setSelectedCityId(id);
    setSelectedAreaId("");
    setNewCityName("");
    toast.success("تمت إضافة المحافظة «" + name + "» — أضف الآن المديريات/المناطق بداخلها");
  };

  const addArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCity) { toast.error("اختر المحافظة أولاً"); return; }
    const parts = newAreaName.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const fee = Math.max(0, Number(newAreaFee) || activeCity.defaultFee || 0);
    const createdAreas: AdminDeliveryArea[] = parts.map((pName, idx) => ({
      id: "area_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 5),
      name: pName,
      defaultFee: fee,
      enabled: true,
      streets: [],
    }));
    const nextTree = {
      ...tree,
      cities: tree.cities.map(c => c.id === activeCity.id ? { ...c, areas: [...c.areas, ...createdAreas] } : c),
    };
    setTree(nextTree);
    setSelectedAreaId(createdAreas[0].id);
    setNewAreaName("");
    toast.success("تمت إضافة " + createdAreas.length + " منطقة داخل «" + activeCity.name + "»");
  };

  const addStreets = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCity || !activeArea) { toast.error("اختر المحافظة والمنطقة أولاً"); return; }
    const parts = newStreetsText.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const fee = Math.max(0, Number(newStreetFee) || activeArea.defaultFee || 0);
    const promoFee = newStreetPromoFee.trim() !== "" ? Math.max(0, Number(newStreetPromoFee)) : null;
    const freeAbove = newStreetFreeAbove.trim() !== "" && Number(newStreetFreeAbove) > 0 ? Math.floor(Number(newStreetFreeAbove)) : null;
    const createdStreets: AdminDeliveryStreet[] = parts.map((sName, idx) => ({
      id: "st_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).slice(2, 5),
      name: sName,
      fee,
      promoFee,
      promoLabel: promoFee !== null ? (promoFee === 0 ? "🎉 توصيل مجاني لفترة محدودة!" : "🔥 عرض توصيل مخفض!") : "",
      freeAbove,
      etaText: newStreetEta.trim() || "25 - 40 دقيقة",
      enabled: true,
    }));
    const nextTree = {
      ...tree,
      cities: tree.cities.map(c => c.id !== activeCity.id ? c : {
        ...c,
        areas: c.areas.map(a => a.id !== activeArea.id ? a : { ...a, streets: [...a.streets, ...createdStreets] }),
      }),
    };
    setTree(nextTree);
    setNewStreetsText("");
    toast.success("تمت إضافة " + createdStreets.length + " شارع/حي داخل «" + activeCity.name + " — " + activeArea.name + "»");
  };

  const updateStreet = (cityId: string, areaId: string, streetId: string, patch: Partial<AdminDeliveryStreet>) => {
    setTree(curr => ({
      ...curr,
      cities: curr.cities.map(c => c.id !== cityId ? c : {
        ...c,
        areas: c.areas.map(a => a.id !== areaId ? a : {
          ...a,
          streets: a.streets.map(s => s.id !== streetId ? s : { ...s, ...patch }),
        }),
      }),
    }));
  };

  const deleteStreet = (cityId: string, areaId: string, streetId: string) => {
    setTree(curr => ({
      ...curr,
      cities: curr.cities.map(c => c.id !== cityId ? c : {
        ...c,
        areas: c.areas.map(a => a.id !== areaId ? a : {
          ...a,
          streets: a.streets.filter(s => s.id !== streetId),
        }),
      }),
    }));
  };

  const addVipPhone = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = vipPhone.replace(/\D/g, "").replace(/^00967|^967|^0/, "").slice(0, 9);
    if (!/^(77|73|78|71|70)\d{7}$/.test(digits)) {
      toast.error("يرجى إدخال رقم جوال يمني صحيح من 9 أرقام يبدأ بـ 77 أو 73 أو 78 أو 71 أو 70.");
      return;
    }
    if (tree.vipFreePhones.some(v => v.phone === digits)) {
      toast.error("هذا الرقم مضاف مسبقاً في قائمة التوصيل المجاني.");
      return;
    }
    const nextVip: AdminVipFreePhone = {
      phone: digits,
      name: vipName.trim() || "عميل مميز VIP",
      minOrder: Math.max(0, Number(vipMinOrder) || 0),
      enabled: true,
    };
    setTree(curr => ({ ...curr, vipFreePhones: [nextVip, ...curr.vipFreePhones] }));
    setVipPhone("");
    setVipName("");
    setVipMinOrder("0");
    toast.success("🎉 تمت إضافة الرقم " + digits + " لقائمة التوصيل المجاني!");
  };

  if (query.isLoading) return <AdminLoading />;

  return (
    <div className="admin-content">
      <AdminHeading
        eyebrow="تحكم كامل بالمحافظات والمديريات والشوارع وعروض التوصيل"
        title="مناطق وأسعار وعروض التوصيل"
        text="حدد المحافظات (مثل صنعاء، إب) وبداخلها المناطق/المديريات (مثل معين، السبعين) وبداخلها الشوارع (مثل الرقاص) مع تسعير كل شارع وعروض التوصيل المجاني."
        icon={Truck}
      />

      <div style={{ marginBottom: "16px", padding: "16px 18px", borderRadius: "18px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#ffffff", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", boxShadow: "0 10px 26px rgba(94, 1, 11, 0.18)" }}>
        <div style={{ display: "grid", gap: "4px" }}>
          <span style={{ color: "#f1d897", fontSize: "12px", fontWeight: 900 }}>🚀 منظومة التوصيل الذكية بالاختيار المتدرج (المحافظة ➔ المنطقة ➔ الشارع)</span>
          <strong style={{ fontSize: "15.5px" }}>
            لديك حالياً: {tree.cities.length} محافظات · {totalAreas} مديرية/منطقة · {totalStreets} شارع مسعّر · {tree.vipFreePhones.length} عميل توصيل مجاني
          </strong>
          <small style={{ color: "#d4e8dc", fontSize: "11.5px" }}>بعد أي تعديل، اضغط زر «حفظ واعتماد التغييرات» ليظهر فوراً للزبائن عند تأكيد الطلب.</small>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            className="small-button"
            style={{ background: "rgba(255,255,255,0.14)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)", fontWeight: 800 }}
            onClick={() => {
              if (tree.cities.length > 0 && !window.confirm("هل تريد تحميل القالب الجاهز لمحافظتي صنعاء وإب (مع المديريات والشوارع الشهيرة)؟ يمكنك تعديله بحرية بعد التحميل.")) return;
              const tpl = makeDefaultYemenDeliveryTree();
              tpl.vipFreePhones = tree.vipFreePhones;
              setTree(tpl);
              setSelectedCityId(tpl.cities[0].id);
              setSelectedAreaId(tpl.cities[0].areas[0].id);
              toast.success("✨ تم تحميل قالب مناطق وشوارع صنعاء وإب الجاهز! اضغط حفظ لاعتماده.");
            }}
          >
            ⚡ تحميل قالب صنعاء وإب الجاهز
          </button>
          <button
            type="button"
            onClick={() => saveTreeNow(tree)}
            disabled={saveMut.isPending}
            style={{ padding: "10px 18px", borderRadius: "12px", border: "none", background: "#f1d897", color: "#113826", fontWeight: 900, fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
          >
            {saveMut.isPending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
            💾 حفظ واعتماد مناطق وأسعار التوصيل الآن
          </button>
        </div>
      </div>

      <section className="admin-form-card" style={{ marginBottom: "16px", padding: "14px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}>
          <label className="toggle-field" style={{ margin: 0, fontWeight: 800, color: "#143b29" }}>
            <input
              type="checkbox"
              checked={tree.strictSelectionOnly}
              onChange={e => setTree(curr => ({ ...curr, strictSelectionOnly: e.target.checked }))}
            />
            <span>إلزام الزبون باختيار (المحافظة ➔ المنطقة ➔ الشارع) من القوائم فقط، وكتابة المعلم القريب فقط</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#870210" }}>🎁 توصيل مجاني عام لجميع المناطق إذا تجاوزت الفاتورة (ر.ي):</span>
            <input
              type="number"
              min="0"
              step="500"
              value={tree.globalFreeAbove ?? ""}
              onChange={e => setTree(curr => ({ ...curr, globalFreeAbove: e.target.value ? Number(e.target.value) : null }))}
              placeholder="اتركه فارغاً لإلغائه"
              style={{ width: "155px", padding: "7px 10px", borderRadius: "10px", border: "1px solid #bfd2c6" }}
            />
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "14px", alignItems: "start" }}>
        <section className="admin-form-card" style={{ margin: 0, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "#870210" }}>1️⃣ المحافظات / المدن ({tree.cities.length})</h3>
            <small style={{ color: "#5f7367" }}>مثل: صنعاء، إب</small>
          </div>
          <form onSubmit={addCity} style={{ display: "grid", gap: "8px", marginBottom: "12px", padding: "10px", borderRadius: "12px", background: "#f5faf7", border: "1px solid #d8e6dd" }}>
            <input required value={newCityName} onChange={e => setNewCityName(e.target.value)} placeholder="اسم المحافظة (مثلاً: صنعاء، إب، تعز)..." style={{ padding: "8px 10px", borderRadius: "9px", background: "#fff" }} />
            <div style={{ display: "flex", gap: "6px" }}>
              <input type="number" min="0" value={newCityFee} onChange={e => setNewCityFee(e.target.value)} placeholder="سعر افتراضي ر.ي" style={{ flex: 1, padding: "7px 10px", borderRadius: "9px", background: "#fff" }} />
              <button type="submit" className="small-button selected" style={{ fontWeight: 800 }}><Plus size={14} /> إضافة محافظة</button>
            </div>
          </form>
          {!tree.cities.length ? (
            <p className="subtle-note">لم تُضف محافظات بعد. أضف أول محافظة أو اضغط «تحميل قالب صنعاء وإب الجاهز» بالأعلى.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {tree.cities.map(city => {
                const isSel = activeCity?.id === city.id;
                return (
                  <div
                    key={city.id}
                    onClick={() => { setSelectedCityId(city.id); setSelectedAreaId(city.areas[0]?.id || ""); }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      background: isSel ? "#e8f6ee" : "#ffffff",
                      border: isSel ? "2px solid #870210" : "1px solid #dce6df",
                      cursor: "pointer",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "14px", color: "#123826" }}>🏙️ {city.name} ({city.areas.length} مناطق)</strong>
                      <div style={{ display: "flex", gap: "4px" }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className={"small-button" + (city.freeDeliveryPromo ? " selected" : "")}
                          style={{ minHeight: "24px", padding: "2px 7px", fontSize: "10px" }}
                          onClick={() => setTree(curr => ({ ...curr, cities: curr.cities.map(c => c.id === city.id ? { ...c, freeDeliveryPromo: !c.freeDeliveryPromo } : c) }))}
                        >
                          {city.freeDeliveryPromo ? "🎁 التوصيل مجاني للكل ✓" : "🎁 عرض مجاني للمحافظة"}
                        </button>
                        <button
                          type="button"
                          className="small-button danger-soft"
                          style={{ minHeight: "24px", padding: "2px 6px" }}
                          onClick={() => {
                            if (window.confirm("حذف محافظة «" + city.name + "» وجميع مناطقها؟")) {
                              setTree(curr => ({ ...curr, cities: curr.cities.filter(c => c.id !== city.id) }));
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <small style={{ color: "#4f6658", fontSize: "11px" }}>السعر الافتراضي: {money(city.defaultFee)} {city.freeDeliveryPromo ? " · 🔥 عرض توصيل مجاني نشط!" : ""}</small>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="admin-form-card" style={{ margin: 0, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "#870210" }}>
              2️⃣ المناطق داخل «{activeCity?.name || "..."}» ({activeCity?.areas.length ?? 0})
            </h3>
            <small style={{ color: "#5f7367" }}>مثل: معين، السبعين</small>
          </div>
          {activeCity ? (
            <>
              <form onSubmit={addArea} style={{ display: "grid", gap: "8px", marginBottom: "12px", padding: "10px", borderRadius: "12px", background: "#f5faf7", border: "1px solid #d8e6dd" }}>
                <input required value={newAreaName} onChange={e => setNewAreaName(e.target.value)} placeholder={"أضف منطقة في " + activeCity.name + " (مثلاً: معين، السبعين)..."} style={{ padding: "8px 10px", borderRadius: "9px", background: "#fff" }} />
                <div style={{ display: "flex", gap: "6px" }}>
                  <input type="number" min="0" value={newAreaFee} onChange={e => setNewAreaFee(e.target.value)} placeholder="سعر افتراضي ر.ي" style={{ flex: 1, padding: "7px 10px", borderRadius: "9px", background: "#fff" }} />
                  <button type="submit" className="small-button selected" style={{ fontWeight: 800 }}><Plus size={14} /> إضافة منطقة</button>
                </div>
              </form>
              {!activeCity.areas.length ? (
                <p className="subtle-note">أضف المناطق أو المديريات التابعة لـ «{activeCity.name}» من الحقل أعلاه.</p>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {activeCity.areas.map(area => {
                    const isSel = activeArea?.id === area.id;
                    return (
                      <div
                        key={area.id}
                        onClick={() => setSelectedAreaId(area.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "12px",
                          background: isSel ? "#e8f6ee" : "#ffffff",
                          border: isSel ? "2px solid #870210" : "1px solid #dce6df",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "13.5px", color: "#123826", display: "block" }}>📍 {area.name}</strong>
                          <small style={{ color: "#52685b", fontSize: "11px" }}>{area.streets.length} شوارع مضافة · افتراضي {money(area.defaultFee)}</small>
                        </div>
                        <button
                          type="button"
                          className="small-button danger-soft"
                          style={{ minHeight: "24px", padding: "2px 6px" }}
                          onClick={e => {
                            e.stopPropagation();
                            if (window.confirm("حذف المنطقة «" + area.name + "» وشوارعها؟")) {
                              setTree(curr => ({
                                ...curr,
                                cities: curr.cities.map(c => c.id !== activeCity.id ? c : { ...c, areas: c.areas.filter(a => a.id !== area.id) }),
                              }));
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="subtle-note">اختر محافظة من اليمين أولاً.</p>
          )}
        </section>
      </div>

      {activeCity && activeArea && (
        <section className="admin-form-card" style={{ marginTop: "16px", border: "1.5px solid #870210" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid #e1ece5" }}>
            <div>
              <span className="eyebrow">3️⃣ تحديد الشوارع وأسعار وعروض التوصيل الدقيقة</span>
              <h2 style={{ margin: "2px 0", fontSize: "17px", color: "#123826" }}>
                🛣️ الشوارع والأحياء داخل: «{activeCity.name} ➔ {activeArea.name}» ({activeArea.streets.length})
              </h2>
              <small style={{ color: "#52685b" }}>يمكنك كتابة شارع واحد أو عدة شوارع مفصولة بفاصلة (مثلاً: الرقاص، الدائري، السنينة) وتحديد سعرها أو عمل عرض توصيل عليها.</small>
            </div>
            {activeArea.streets.length > 0 && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="number" min="0" value={bulkAreaFee} onChange={e => setBulkAreaFee(e.target.value)} placeholder="سعر موحد للمنطقة..." style={{ width: "135px", padding: "6px 9px", borderRadius: "9px", background: "#fff" }} />
                <button
                  type="button"
                  className="small-button selected"
                  onClick={() => {
                    if (!bulkAreaFee.trim()) return;
                    const f = Math.max(0, Number(bulkAreaFee) || 0);
                    setTree(curr => ({
                      ...curr,
                      cities: curr.cities.map(c => c.id !== activeCity.id ? c : {
                        ...c,
                        areas: c.areas.map(a => a.id !== activeArea.id ? a : {
                          ...a,
                          defaultFee: f,
                          streets: a.streets.map(s => ({ ...s, fee: f })),
                        }),
                      }),
                    }));
                    setBulkAreaFee("");
                    toast.success("تم توحيد سعر التوصيل لجميع شوارع «" + activeArea.name + "» بـ " + money(f));
                  }}
                >
                  تطبيق على كل شوارع {activeArea.name}
                </button>
              </div>
            )}
          </div>

          <form onSubmit={addStreets} style={{ padding: "12px", borderRadius: "14px", background: "#f4f9f6", border: "1px solid #cfe2d5", display: "grid", gap: "10px", marginBottom: "14px" }}>
            <div className="form-fields-grid">
              <label className="field-wide">اسم الشارع / الحي (أو عدة شوارع مفصولة بفاصلة) *
                <input required value={newStreetsText} onChange={e => setNewStreetsText(e.target.value)} placeholder={"مثلاً: الرقاص، شارع هائل، الدائري، السنينة..."} style={{ background: "#fff" }} />
              </label>
              <label>سعر التوصيل الأساسي (ر.ي) *
                <input required type="number" min="0" value={newStreetFee} onChange={e => setNewStreetFee(e.target.value)} placeholder="مثلاً: 500" style={{ background: "#fff" }} />
              </label>
              <label>🔥 سعر العرض الخاص (اختياري — اكتب 0 للتوصيل المجاني)
                <input type="number" min="0" value={newStreetPromoFee} onChange={e => setNewStreetPromoFee(e.target.value)} placeholder="اتركه فارغاً إذا لا يوجد عرض" style={{ background: "#fff" }} />
              </label>
              <label>🎁 مجاني إذا زاد الطلب عن (اختياري ر.ي)
                <input type="number" min="0" value={newStreetFreeAbove} onChange={e => setNewStreetFreeAbove(e.target.value)} placeholder="مثلاً: 5000" style={{ background: "#fff" }} />
              </label>
              <label>⏱️ وقت التوصيل المتوقع
                <input value={newStreetEta} onChange={e => setNewStreetEta(e.target.value)} placeholder="25 - 40 دقيقة" style={{ background: "#fff" }} />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="button button-primary"><Plus size={16} /> إضافة الشارع / الشوارع إلى «{activeArea.name}»</button>
            </div>
          </form>

          {!activeArea.streets.length ? (
            <AdminEmpty title={"لا توجد شوارع مضافة في " + activeArea.name} text="أضف الشوارع من النموذج أعلاه ليختارها الزبون بضغطة زر." />
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {activeArea.streets.map(st => {
                const hasPromo = st.promoFee !== null && st.promoFee !== undefined;
                return (
                  <div
                    key={st.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "12px",
                      background: st.enabled ? "#ffffff" : "#f7f7f5",
                      border: hasPromo ? "1.5px solid #e0a82e" : "1px solid #d8e4dc",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "grid", gap: "2px", minWidth: "160px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "14px", color: "#123826" }}>🛣️ {st.name}</strong>
                        {hasPromo && (
                          <span style={{ fontSize: "10px", fontWeight: 900, padding: "2px 8px", borderRadius: "99px", background: "#fff3cd", color: "#856404" }}>
                            🔥 عرض: {st.promoFee === 0 ? "توصيل مجاني!" : money(st.promoFee!)}
                          </span>
                        )}
                        {st.freeAbove && (
                          <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: "#fceee9", color: "#870210" }}>
                            🎁 مجاني فوق {money(st.freeAbove)}
                          </span>
                        )}
                      </div>
                      <small style={{ color: "#5a7062", fontSize: "11px" }}>{activeCity.name} ➔ {activeArea.name} ➔ {st.name} · ⏱️ {st.etaText}</small>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 800, color: "#870210" }}>
                        <span>السعر:</span>
                        <input
                          type="number"
                          min="0"
                          value={st.fee}
                          onChange={e => updateStreet(activeCity.id, activeArea.id, st.id, { fee: Math.max(0, Number(e.target.value) || 0) })}
                          style={{ width: "78px", padding: "4px 7px", borderRadius: "8px", border: "1px solid #bfd2c6", fontWeight: 900 }}
                        />
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 800, color: "#9c6509" }}>
                        <span>🔥 سعر عرض:</span>
                        <input
                          type="number"
                          min="0"
                          value={st.promoFee ?? ""}
                          placeholder="بلا"
                          onChange={e => {
                            const val = e.target.value.trim() === "" ? null : Math.max(0, Number(e.target.value));
                            updateStreet(activeCity.id, activeArea.id, st.id, { promoFee: val, promoLabel: val !== null ? (val === 0 ? "🎉 توصيل مجاني!" : "🔥 عرض توصيل خاص!") : "" });
                          }}
                          style={{ width: "74px", padding: "4px 7px", borderRadius: "8px", border: "1px solid #e0c478", background: hasPromo ? "#fffbeb" : "#fff", fontWeight: 800 }}
                        />
                      </label>
                      <button
                        type="button"
                        className={"small-button" + (st.promoFee === 0 ? " selected" : "")}
                        style={{ minHeight: "28px", padding: "2px 8px", fontSize: "11px" }}
                        onClick={() => {
                          const nextPromo = st.promoFee === 0 ? null : 0;
                          updateStreet(activeCity.id, activeArea.id, st.id, { promoFee: nextPromo, promoLabel: nextPromo === 0 ? "🎉 توصيل مجاني!" : "" });
                        }}
                      >
                        {st.promoFee === 0 ? "🎁 مجاني ✓" : "جعله مجاني"}
                      </button>
                      <button
                        type="button"
                        className="small-button danger-soft"
                        style={{ minHeight: "28px", padding: "2px 8px" }}
                        onClick={() => deleteStreet(activeCity.id, activeArea.id, st.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="admin-form-card" style={{ marginTop: "18px", border: "1.5px solid #e3c478", background: "linear-gradient(135deg, #fffdf7 0%, #fff9e8 100%)" }}>
        <div style={{ marginBottom: "12px" }}>
          <span className="eyebrow" style={{ color: "#9c6509" }}>ميزة استثنائية للعملاء المميزين والأهل والأصدقاء</span>
          <h2 style={{ margin: "2px 0", fontSize: "17px", color: "#173c2a" }}>🌟 أشخاص لهم توصيل مجاني خاص برقم الهاتف ({tree.vipFreePhones.length})</h2>
          <small style={{ color: "#5e6d63" }}>أضف رقم جوال أي شخص هنا (9 أرقام)، وبمجرد أن يطلب من المتجر سيحصل تلقائياً على توصيل مجاني (0 ر.ي) مهما كانت منطقته!</small>
        </div>

        <form onSubmit={addVipPhone} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end", marginBottom: "12px", padding: "12px", borderRadius: "12px", background: "#ffffff", border: "1px solid #ead8a4" }}>
          <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#870210", flex: "1 1 170px" }}>
            <span>رقم الجوال اليمني (9 أرقام تبدأ بـ 77/73/78/71/70) *</span>
            <input required maxLength={9} dir="ltr" value={vipPhone} onChange={e => setVipPhone(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="مثال: 770731619" style={{ fontWeight: 800, textAlign: "left" }} />
          </label>
          <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#870210", flex: "1 1 170px" }}>
            <span>اسم الزبون / الملاحظة</span>
            <input value={vipName} onChange={e => setVipName(e.target.value)} placeholder="مثلاً: عميل مميز / صديق المتجر..." />
          </label>
          <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#870210", width: "160px" }}>
            <span>الحد الأدنى للطلب (0 = دائماً)</span>
            <input type="number" min="0" value={vipMinOrder} onChange={e => setVipMinOrder(e.target.value)} placeholder="0" />
          </label>
          <button type="submit" className="button button-primary"><Plus size={15} /> إضافة للتوصيل المجاني</button>
        </form>

        {!tree.vipFreePhones.length ? (
          <small style={{ color: "#68756c" }}>لم تُضف أرقام بعد. أي رقم تضيفه هنا سيحصل صاحبه على توصيل مجاني تلقائياً.</small>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" }}>
            {tree.vipFreePhones.map(v => (
              <div key={v.phone} style={{ padding: "10px 12px", borderRadius: "12px", background: "#ffffff", border: "1px solid #e2cfa0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div>
                  <strong style={{ fontSize: "13px", color: "#123826", display: "block" }}>🌟 {v.name}</strong>
                  <small style={{ color: "#870210", fontWeight: 800 }} dir="ltr">📞 {v.phone}</small>
                  <small style={{ color: "#68756c", display: "block", fontSize: "10.5px" }}>{v.minOrder > 0 ? ("مجاني للطلبات فوق " + money(v.minOrder)) : "🎁 توصيل مجاني دائماً"}</small>
                </div>
                <button
                  type="button"
                  className="small-button danger-soft"
                  onClick={() => setTree(curr => ({ ...curr, vipFreePhones: curr.vipFreePhones.filter(x => x.phone !== v.phone) }))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="button button-primary" disabled={saveMut.isPending} onClick={() => saveTreeNow(tree)} style={{ padding: "12px 24px", fontSize: "14px" }}>
          {saveMut.isPending ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
          💾 حفظ واعتماد جميع إعدادات ومناطق وعروض التوصيل
        </button>
      </div>
    </div>
  );
}

function BannersPanel() {
  const utils = trpc.useUtils();
  const query = trpc.commerce.admin.banners.list.useQuery(undefined, { retry: 1 });
  const cats = trpc.commerce.admin.categories.list.useQuery(undefined, { retry: 1 });
  const prods = trpc.commerce.admin.products.list.useQuery(undefined, { retry: 1 });

  const blank = { title: "", body: "", imageUrl: "", actionText: "", targetUrl: "/products", isActive: true, sortOrder: "0" };
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const [cfg, setCfg] = useState<AdminBannerCfg>(blankBannerCfg);
  const [destType, setDestType] = useState<"category" | "product" | "all_products" | "assistant" | "custom">("all_products");

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragHotRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startCfg: AdminBannerCfg; rectW: number; rectH: number } | null>(null);

  const reset = () => {
    setEditing(null);
    setForm(blank);
    setCfg(blankBannerCfg);
    setDestType("all_products");
  };

  const refresh = async () => {
    await Promise.all([utils.commerce.admin.banners.list.invalidate(), utils.commerce.catalog.home.invalidate()]);
  };

  const create = trpc.commerce.admin.banners.create.useMutation({
    onSuccess: async () => { toast.success("تم حفظ الإعلان بنجاح"); reset(); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.commerce.admin.banners.update.useMutation({
    onSuccess: async () => { toast.success("تم تحديث إعدادات الإعلان بنجاح"); reset(); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.commerce.admin.banners.delete.useMutation({
    onSuccess: () => {
      toast.success("حُذف الإعلان نهائياً");
      void utils.commerce.admin.banners.list.invalidate();
      void utils.commerce.catalog.home.invalidate();
    },
  });

  const startHotspotDrag = (mode: "move" | "resize", e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragHotRef.current = { mode, startX: e.clientX, startY: e.clientY, startCfg: { ...cfg }, rectW: r.width, rectH: r.height };
  };

  const moveHotspotDrag = (e: React.PointerEvent) => {
    const d = dragHotRef.current;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = ((e.clientX - d.startX) / d.rectW) * 100;
    const dy = ((e.clientY - d.startY) / d.rectH) * 100;
    if (d.mode === "move") {
      const nx = Math.round(Math.max(0, Math.min(100 - d.startCfg.hw, d.startCfg.hx + dx)));
      const ny = Math.round(Math.max(0, Math.min(100 - d.startCfg.hh, d.startCfg.hy + dy)));
      setCfg(c => ({ ...c, hx: nx, hy: ny }));
    } else {
      const nw = Math.round(Math.max(8, Math.min(100 - d.startCfg.hx, d.startCfg.hw + dx)));
      const nh = Math.round(Math.max(8, Math.min(100 - d.startCfg.hy, d.startCfg.hh + dy)));
      setCfg(c => ({ ...c, hw: nw, hh: nh }));
    }
  };

  const endHotspotDrag = () => { dragHotRef.current = null; };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const finalTitle = form.title.trim() || "إعلان المتجر";
    const packedActionUrl = packAdminBannerUrl(cfg.clickMode === "none" ? "" : form.targetUrl, cfg);
    const values = {
      title: finalTitle,
      body: form.body || null,
      imageUrl: form.imageUrl || null,
      actionText: form.actionText || null,
      actionUrl: packedActionUrl,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    };
    if (editing) update.mutate({ id: editing, values });
    else create.mutate({ title: finalTitle, imageUrl: form.imageUrl || undefined, body: form.body || undefined, actionText: form.actionText || undefined, actionUrl: packedActionUrl, isActive: form.isActive, sortOrder: Number(form.sortOrder) });
  };

  const edit = (item: NonNullable<typeof query.data>[number]) => {
    setEditing(item.id);
    const unpacked = unpackAdminBannerUrl(item.actionUrl);
    setForm({
      title: item.title,
      body: item.body ?? "",
      imageUrl: item.imageUrl ?? "",
      actionText: item.actionText ?? "",
      targetUrl: unpacked.targetUrl || "/products",
      isActive: item.isActive,
      sortOrder: String(item.sortOrder),
    });
    setCfg(unpacked.cfg);
    if (unpacked.targetUrl.startsWith("/products?category=")) setDestType("category");
    else if (unpacked.targetUrl.startsWith("/product/")) setDestType("product");
    else if (unpacked.targetUrl === "/assistant") setDestType("assistant");
    else if (!unpacked.targetUrl || unpacked.targetUrl === "/products") setDestType("all_products");
    else setDestType("custom");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const placementLabels: Record<AdminBannerCfg["placement"], string> = {
    top: "أعلى الصفحة الرئيسية",
    middle: "وسط الصفحة (بين الأقسام والمنتجات)",
    bottom: "أسفل الصفحة (بعد المنتجات)",
    popup: "إعلان منبثق عند فتح الموقع (Popup)",
  };

  const sizeLabels: Record<AdminBannerCfg["size"], string> = {
    auto: "المقاس الكامل الطبيعي للصورة (بدون قص)",
    small: "صغير مدمج",
    medium: "متوسط متناسق",
    large: "كبير سينمائي",
  };

  return (
    <div className="admin-content">
      <AdminHeading
        eyebrow="استوديو الإعلانات الاحترافي"
        title="الإعلانات والنوافذ الترويجية"
        text="تحكم كامل في صفاء الصورة بدون ضبابية أو نصوص مزعجة، مع تحديد مكان الزر المرسوم داخل الصورة باليد واختيار القسم وحجم ومكان الإعلان."
        icon={Megaphone}
      />
      <section className="admin-form-card">
        <div className="form-card-heading">
          <span className="form-card-number">{editing ? "✳" : "01"}</span>
          <div>
            <h2>{editing ? "تعديل الإعلان وإعداداته" : "إضافة إعلان احترافي جديد"}</h2>
            <p>الصورة تظهر صافية 100% بدون ضبابية ولا كلام يغطي عليها، ويمكنك تحديد الزر المرسوم داخل صورتك مباشرة.</p>
          </div>
          {editing && <button type="button" className="small-button" onClick={reset}>إلغاء التعديل<X size={14} /></button>}
        </div>

        <form className="admin-form" onSubmit={submit}>
          <div className="product-form-layout">
            <div className="form-fields-grid">
              <label>
                اسم الإعلان (مرجع لك في الإدارة)
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: عرض الشاورما العربي والفلافل الساخنة" />
              </label>
              <label>
                مكان ظهور الإعلان في الموقع
                <select value={cfg.placement} onChange={e => setCfg({ ...cfg, placement: e.target.value as AdminBannerCfg["placement"] })}>
                  <option value="top">أعلى الصفحة الرئيسية (السلايدر الرئيسي)</option>
                  <option value="middle">وسط الصفحة (بين الأقسام والمنتجات)</option>
                  <option value="bottom">أسفل الصفحة (بعد المنتجات)</option>
                  <option value="popup">نافذة منبثقة أول ما يفتح الزبون الموقع (Popup)</option>
                </select>
              </label>
              <label>
                حجم الإعلان على الشاشة
                <select value={cfg.size} onChange={e => setCfg({ ...cfg, size: e.target.value as AdminBannerCfg["size"] })}>
                  <option value="auto">المقاس الكامل الطبيعي للصورة (بدون قص أي جزء)</option>
                  <option value="medium">متوسط متناسق (القياسي)</option>
                  <option value="large">كبير وبارز</option>
                  <option value="small">صغير مدمج (شريط إعلاني)</option>
                </select>
              </label>
              <label>
                طريقة تفاعل الزبون عند لمس الإعلان
                <select value={cfg.clickMode} onChange={e => setCfg({ ...cfg, clickMode: e.target.value as AdminBannerCfg["clickMode"] })}>
                  <option value="full">الضغط على أي مكان في صورة الإعلان بالكامل</option>
                  <option value="hotspot">تحديد مكان الزر المرسوم داخل الصورة فقط (مثل: اطلب الآن)</option>
                  <option value="none">بدون ضغط (عرض الصورة فقط)</option>
                </select>
              </label>

              {cfg.clickMode !== "none" && (
                <>
                  <label>
                    عند الضغط يتوجه الزبون إلى:
                    <select
                      value={destType}
                      onChange={e => {
                        const next = e.target.value as typeof destType;
                        setDestType(next);
                        if (next === "all_products") setForm(f => ({ ...f, targetUrl: "/products" }));
                        else if (next === "assistant") setForm(f => ({ ...f, targetUrl: "/assistant" }));
                        else if (next === "category" && cats.data?.[0]) setForm(f => ({ ...f, targetUrl: "/products?category=" + cats.data![0].id }));
                        else if (next === "product" && prods.data?.[0]) setForm(f => ({ ...f, targetUrl: "/product/" + prods.data![0].id }));
                      }}
                    >
                      <option value="category">قسم معين من أقسام المتجر</option>
                      <option value="product">منتج معين في المتجر</option>
                      <option value="all_products">صفحة جميع المنتجات</option>
                      <option value="assistant">المساعد الذكي والشيف</option>
                      <option value="custom">رابط مخصص</option>
                    </select>
                  </label>

                  {destType === "category" && (
                    <label>
                      اختر القسم الذي يفتحه الإعلان
                      <select
                        value={form.targetUrl.replace("/products?category=", "")}
                        onChange={e => setForm({ ...form, targetUrl: e.target.value ? "/products?category=" + e.target.value : "/products" })}
                      >
                        <option value="">-- اختر القسم --</option>
                        {cats.data?.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                      </select>
                    </label>
                  )}

                  {destType === "product" && (
                    <label>
                      اختر المنتج الذي يفتحه الإعلان
                      <select
                        value={form.targetUrl.replace("/product/", "")}
                        onChange={e => setForm({ ...form, targetUrl: e.target.value ? "/product/" + e.target.value : "/products" })}
                      >
                        <option value="">-- اختر المنتج --</option>
                        {prods.data?.map(p => <option key={p.id} value={String(p.id)}>{p.name} ({money(p.price)})</option>)}
                      </select>
                    </label>
                  )}

                  {destType === "custom" && (
                    <label>
                      الرابط المخصص
                      <input value={form.targetUrl} onChange={e => setForm({ ...form, targetUrl: e.target.value })} placeholder="/products?category=1" dir="ltr" />
                    </label>
                  )}
                </>
              )}

              <label>ترتيب العرض<input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })} /></label>
              <label className="toggle-field"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> تفعيل ونشر الإعلان في المتجر</label>

              {cfg.placement === "popup" && (
                <label className="toggle-field field-wide">
                  <input type="checkbox" checked={cfg.popupOnce} onChange={e => setCfg({ ...cfg, popupOnce: e.target.checked })} />
                  إظهار الإعلان المنبثق مرة واحدة فقط لكل زيارة (حتى لا يتكرر إزعاج الزبون)
                </label>
              )}

              <div className="field-wide" style={{ padding: "12px", borderRadius: "12px", background: "#f6f9f6", border: "1px solid #e1ebe3", display: "grid", gap: "8px" }}>
                <strong style={{ fontSize: "11px", color: "#870210" }}>خيارات النصوص والتظليل فوق الصورة (مطفأة افتراضياً لتبقى صورتك صافية 100%):</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
                  <label className="toggle-field"><input type="checkbox" checked={cfg.showTitle} onChange={e => setCfg({ ...cfg, showTitle: e.target.checked })} /> إظهار عنوان ونص فوق الصورة</label>
                  <label className="toggle-field"><input type="checkbox" checked={cfg.shade} onChange={e => setCfg({ ...cfg, shade: e.target.checked })} /> إضافة ضبابية / تظليل داكن</label>
                  <label className="toggle-field"><input type="checkbox" checked={cfg.showBtn} onChange={e => setCfg({ ...cfg, showBtn: e.target.checked })} /> إظهار زر نظام إضافي فوق الصورة</label>
                </div>
                {(cfg.showTitle || cfg.showBtn) && (
                  <div className="form-fields-grid" style={{ marginTop: "6px" }}>
                    {cfg.showTitle && <label className="field-wide">النص الإضافي فوق الصورة<textarea rows={2} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>}
                    {cfg.showBtn && <label>نص الزر الإضافي<input value={form.actionText} onChange={e => setForm({ ...form, actionText: e.target.value })} placeholder="اطلب الآن" /></label>}
                  </div>
                )}
              </div>
            </div>

            <ImageField title="رفع وقص صورة الإعلان" value={form.imageUrl} onChange={imageUrl => setForm(curr => ({ ...curr, imageUrl }))} kind="banner" aspect={2.2} />
          </div>

          {form.imageUrl && cfg.clickMode === "hotspot" && (
            <div style={{ padding: "14px", borderRadius: "16px", background: "#12221a", color: "#fff", display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <strong style={{ fontSize: "12px", color: "#f1d897", display: "block" }}>تحديد مكان الزر المرسوم داخل الصورة (منطقة ضغط الزبون):</strong>
                  <small style={{ fontSize: "10px", color: "#cfe0d5" }}>اسحب المستطيل الذهبي وضعه فوق الزر المرسوم في صورتك (مثل: اطلب الشاورما الآن أو تصفح القائمة)، واسحب الدائرة الصفراء لتغيير حجمه.</small>
                </div>
              </div>
              <div
                ref={stageRef}
                onPointerMove={moveHotspotDrag}
                onPointerUp={endHotspotDrag}
                onPointerCancel={endHotspotDrag}
                style={{ position: "relative", width: "100%", maxWidth: "620px", margin: "0 auto", borderRadius: "14px", overflow: "hidden", userSelect: "none", touchAction: "none", lineHeight: 0 }}
              >
                <img src={form.imageUrl} alt="معاينة الإعلان" draggable={false} style={{ width: "100%", height: "auto", display: "block", pointerEvents: "none" }} />
                <div
                  onPointerDown={e => startHotspotDrag("move", e)}
                  style={{
                    position: "absolute",
                    left: cfg.hx + "%",
                    top: cfg.hy + "%",
                    width: cfg.hw + "%",
                    height: cfg.hh + "%",
                    border: "2.5px dashed #f1d897",
                    background: "rgba(241, 216, 151, 0.28)",
                    borderRadius: "12px",
                    cursor: "move",
                    touchAction: "none",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.32)",
                  }}
                >
                  <span style={{ background: "rgba(15, 45, 30, 0.88)", color: "#f1d897", padding: "3px 8px", borderRadius: "99px", fontSize: "10px", fontWeight: 700, pointerEvents: "none", whiteSpace: "nowrap" }}>
                    👆 منطقة ضغط الزبون
                  </span>
                  <span
                    onPointerDown={e => startHotspotDrag("resize", e)}
                    style={{
                      position: "absolute",
                      bottom: "-12px",
                      right: "-12px",
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background: "#f1d897",
                      border: "2.5px solid #0f5c3a",
                      cursor: "nwse-resize",
                      touchAction: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="form-submit-row" style={{ gap: "8px" }}>
            <button type="submit" className="button button-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? <LoaderCircle className="spin" size={16} /> : editing ? <Save size={16} /> : <Plus size={16} />}
              {editing ? "حفظ تعديلات الإعلان" : "حفظ الإعلان ونشره"}
            </button>
            {editing && <button type="button" className="button button-quiet" onClick={reset}>إلغاء</button>}
          </div>
        </form>
      </section>

      <div className="admin-section-heading">
        <div><h2>الإعلانات المحفوظة</h2><p>تحكم في مكان وحجم وحالة كل إعلان بضغطة واحدة.</p></div>
      </div>
      {!query.data?.length ? <AdminEmpty title="لا توجد إعلانات" text="ستبقى واجهة المتجر نظيفة حتى ترفع إعلانك الأول." /> : (
        <div className="entity-list">
          {query.data.map(item => {
            const meta = unpackAdminBannerUrl(item.actionUrl);
            return (
              <article className="entity-row" key={item.id}>
                <div className="entity-image">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Megaphone size={19} />}</div>
                <div className="entity-main">
                  <strong>{item.title}</strong>
                  <small>
                    {placementLabels[meta.cfg.placement]} · {sizeLabels[meta.cfg.size]} · {meta.cfg.clickMode === "hotspot" ? "زر محدد داخل الصورة" : meta.cfg.clickMode === "full" ? "كامل الصورة قابلة للضغط" : "عرض فقط"}
                  </small>
                </div>
                <label className="toggle-field compact-toggle">
                  <input type="checkbox" checked={item.isActive} onChange={e => update.mutate({ id: item.id, values: { isActive: e.target.checked } })} /> نشط
                </label>
                <div className="entity-actions">
                  <button type="button" className="small-button" onClick={() => edit(item)}>تعديل الإعدادات</button>
                  <button type="button" className="small-button danger-soft" onClick={() => { if (window.confirm("هل أنت متأكد من حذف الإعلان «" + item.title + "» نهائياً؟")) remove.mutate({ id: item.id }); }}><Trash2 size={14} /> حذف</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OffersPanel() {
  const utils = trpc.useUtils(); const query = trpc.commerce.admin.offers.list.useQuery(undefined, { retry: 1 });
  const blank = { title: "", description: "", code: "", discountType: "percent" as "percent" | "fixed", discountValue: "", minimumOrder: "0", startsAt: "", endsAt: "", isActive: true };
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const reset = () => { setEditing(null); setForm(blank); };
  const refresh = async () => { await utils.commerce.admin.offers.list.invalidate(); await utils.commerce.catalog.home.invalidate(); };
  const create = trpc.commerce.admin.offers.create.useMutation({ onSuccess: async () => { toast.success("تم حفظ العرض"); reset(); await refresh(); }, onError: error => toast.error(error.message) });
  const update = trpc.commerce.admin.offers.update.useMutation({ onSuccess: async (_result, variables) => { toast.success("تم تحديث العرض"); if (editing === variables.id) reset(); await refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.commerce.admin.offers.delete.useMutation({ onSuccess: () => { toast.success("تم حذف العرض نهائياً"); void utils.commerce.admin.offers.list.invalidate(); void utils.commerce.catalog.home.invalidate(); } });
  const toLocal = (date: Date | string | null) => date ? new Date(date).toISOString().slice(0, 16) : "";
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.startsAt && form.endsAt && new Date(form.startsAt) > new Date(form.endsAt)) { toast.error("تاريخ نهاية العرض يجب أن يكون بعد تاريخ بدايته."); return; }
    const values = { title: form.title, description: form.description || null, code: form.code.trim().toUpperCase(), discountType: form.discountType, discountValue: Number(form.discountValue), minimumOrder: Number(form.minimumOrder), startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null, isActive: form.isActive };
    if (editing) update.mutate({ id: editing, values }); else create.mutate({ ...values, description: form.description || undefined });
  };
  const edit = (item: NonNullable<typeof query.data>[number]) => { setEditing(item.id); setForm({ title: item.title, description: item.description ?? "", code: item.code, discountType: item.discountType, discountValue: String(item.discountValue), minimumOrder: String(item.minimumOrder), startsAt: toLocal(item.startsAt), endsAt: toLocal(item.endsAt), isActive: item.isActive }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <div className="admin-content"><AdminHeading eyebrow="تحفيز الشراء" title="العروض والخصومات" text="الخصم يطبّق ويُعاد حسابه على الخادم عند تقديم الطلب." icon={BadgePercent} /><section className="admin-form-card"><div className="form-card-heading"><span className="form-card-number">{editing ? "✳" : "01"}</span><div><h2>{editing ? "تعديل العرض" : "إنشاء عرض"}</h2><p>أضف شروط العرض ورمز الكوبون.</p></div>{editing && <button type="button" className="small-button" onClick={reset}>إلغاء التعديل<X size={14} /></button>}</div><form className="admin-form" onSubmit={submit}><div className="form-fields-grid"><label>اسم العرض<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>رمز الخصم<input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label><label className="field-wide">وصف العرض<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>نوع الخصم<select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value as "percent" | "fixed" })}><option value="percent">نسبة مئوية</option><option value="fixed">قيمة ثابتة</option></select></label><label>{form.discountType === "percent" ? "النسبة %" : "قيمة الخصم ر.ي"}<input type="number" min="1" max={form.discountType === "percent" ? "100" : undefined} required value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} /></label><label>الحد الأدنى للطلب ر.ي<input type="number" min="0" step="1" value={form.minimumOrder} onChange={e => setForm({ ...form, minimumOrder: e.target.value })} /></label><label>يبدأ العرض<input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label><label>ينتهي العرض<input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label><label className="toggle-field"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> العرض فعّال</label></div><div className="form-submit-row"><button type="submit" className="button button-primary" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <LoaderCircle className="spin" size={16} /> : editing ? <Save size={16} /> : <Plus size={16} />}{editing ? "حفظ تعديل العرض" : "إنشاء العرض"}</button></div></form></section><div className="admin-section-heading"><div><h2>العروض الحالية</h2><p>رموز العرض تُفحص عند إرسال الطلب.</p></div></div>{!query.data?.length ? <AdminEmpty title="لا توجد عروض مضافة" text="يمكنك إضافة رمز خصم متى أردت." /> : <div className="entity-list">{query.data.map(item => <article className="entity-row" key={item.id}><div className="entity-image offer-art"><BadgePercent size={20} /></div><div className="entity-main"><strong>{item.title}</strong><small>{item.code} · {item.discountType === "percent" ? item.discountValue + "%" : money(item.discountValue)} · حد أدنى {money(item.minimumOrder)} · {item.startsAt ? new Date(item.startsAt).toLocaleDateString("ar-YE") : "دون بداية محددة"} — {item.endsAt ? new Date(item.endsAt).toLocaleDateString("ar-YE") : "دون انتهاء محدد"}</small></div><label className="toggle-field compact-toggle"><input type="checkbox" checked={item.isActive} onChange={e => update.mutate({ id: item.id, values: { isActive: e.target.checked } })} /> فعّال</label><div className="entity-actions"><button type="button" className="small-button" onClick={() => edit(item)}>تعديل</button><button type="button" className="small-button danger-soft" onClick={() => { if (window.confirm("هل أنت متأكد من حذف العرض «" + item.title + "» نهائياً؟")) remove.mutate({ id: item.id }); }}><Trash2 size={14} /> حذف</button></div></article>)}</div>}</div>;
}

function printOrderInvoiceWindow(order: any) {
  const w = window.open("", "_blank", "width=460,height=680");
  if (!w) { toast.error("يرجى السماح بالنوافذ المنبثقة لطباعة الفاتورة"); return; }
  const cancelledEvents = (order.events || []).filter((ev: any) => String(ev.note || "").startsWith("❌"));
  const html = [
    "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>فاتورة طلب " + order.orderNumber + "</title>",
    "<style>body{font-family:Cairo,Tahoma,sans-serif;padding:18px;color:#11261b;max-width:400px;margin:0 auto}h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border-bottom:1px solid #d8e3dc;padding:7px 4px;text-align:right;font-size:12.5px}.tot{font-size:15px;font-weight:800;background:#fdf6f0;padding:10px;border-radius:10px;margin-top:10px}.canc{background:#fff5f4;border:1px solid #f1c8c1;padding:8px;border-radius:8px;font-size:11.5px;margin-top:8px;color:#8a2a1e}</style></head><body>",
    "<h1>🥙 بوفية شهيزو — SHAHEZO (شاورما • فلافل • عصائر)</h1>",
    "<div>رقم الفاتورة: <b>" + order.orderNumber + "</b></div>",
    "<div>التاريخ: " + new Date(order.createdAt).toLocaleString("ar-YE") + "</div>",
    "<hr style=\"border:none;border-top:1px dashed #b9ccc0;margin:10px 0\"/>",
    "<div>العميل: <b>" + order.recipientName + "</b></div>",
    "<div>الهاتف: <b dir=\"ltr\">" + order.phone + "</b></div>",
    "<div>العنوان: " + order.city + " — " + order.district + (order.addressDetails ? (" (" + order.addressDetails + ")") : "") + "</div>",
    "<table><thead><tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr></thead><tbody>",
    ...(order.items || []).map((it: any) => "<tr><td>" + it.productName + "</td><td>" + it.quantity + "</td><td>" + Number(it.lineTotal).toLocaleString("en-US") + " ر.ي</td></tr>"),
    "</tbody></table>",
    cancelledEvents.length ? ("<div class=\"canc\"><b>أصناف ملغاة من الفاتورة:</b><br/>" + cancelledEvents.map((e: any) => "• " + e.note).join("<br/>") + "</div>") : "",
    "<div class=\"tot\">المجموع الفرعي: " + Number(order.subtotal).toLocaleString("en-US") + " ر.ي<br/>التوصيل: " + Number(order.deliveryFee).toLocaleString("en-US") + " ر.ي" + (order.discount ? ("<br/>الخصم: " + Number(order.discount).toLocaleString("en-US") + " ر.ي") : "") + "<br/>الإجمالي المطلوب: " + Number(order.total).toLocaleString("en-US") + " ر.ي</div>",
    "<script>window.onload=function(){window.print();}</script></body></html>"
  ].join("");
  w.document.open(); w.document.write(html); w.document.close();
}

function OrdersPanel() {
  const utils = trpc.useUtils();
  const query = trpc.commerce.admin.orders.list.useQuery(undefined, { retry: 1, refetchInterval: 10_000 });
  const nextStates: Record<string, string[]> = { new: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"], delivered: [], cancelled: [] };
  const [deliveryNotes, setDeliveryNotes] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderSearch, setOrderSearch] = useState<string>("");
  const [cancellingItem, setCancellingItem] = useState<{ orderId: number; itemId: number; itemName: string; maxQty: number; unitPrice: number } | null>(null);
  const [cancelQty, setCancelQty] = useState<number>(1);
  const [cancelReason, setCancelReason] = useState<string>("غير متوفر اليوم في المخزون وتم خصم مبلغه من الفاتورة");
  const [lastWhatsAppAlert, setLastWhatsAppAlert] = useState<{ orderId: number; phone: string; message: string } | null>(null);

  const focusedOrderNo = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("order") : null;
  const change = trpc.commerce.admin.orders.setStatus.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث حالة الطلب وإرسال إشعار فوري للعميل");
      await Promise.all([utils.commerce.admin.orders.list.invalidate(), utils.commerce.admin.overview.invalidate(), utils.commerce.orders.mine.invalidate(), utils.commerce.catalog.home.invalidate(), utils.commerce.catalog.listProducts.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const sendNoteMut = trpc.commerce.admin.orders.sendNote.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success("تم إرسال رسالتك كإشعار فوري لجوال العميل وحفظها في سجل الطلب");
      setDeliveryNotes(current => ({ ...current, [vars.id]: "" }));
      await utils.commerce.admin.orders.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeItemMut = trpc.commerce.admin.orders.removeItem.useMutation({
    onSuccess: async (res, vars) => {
      toast.success("✅ تم إلغاء الصنف من الفاتورة وتحديث الإجمالي وإشعار العميل!");
      const targetOrd = (query.data ?? []).find(o => o.id === vars.orderId);
      if (targetOrd?.phone) {
        setLastWhatsAppAlert({
          orderId: vars.orderId,
          phone: targetOrd.phone,
          message: "مرحباً " + targetOrd.recipientName + " 🌿\nبخصوص طلبك رقم " + res.orderNumber + " في بوفية شهيزو – SHAHEZO:\nتم إلغاء الصنف «" + res.itemName + "» (" + vars.reason + ") وخصم مبلغه (" + res.deductedAmount.toLocaleString("en-US") + " ر.ي) من الفاتورة.\nالإجمالي الجديد للطلب: " + res.newTotal.toLocaleString("en-US") + " ر.ي.\nشكراً لتفهمك!",
        });
      }
      setCancellingItem(null);
      await Promise.all([utils.commerce.admin.orders.list.invalidate(), utils.commerce.admin.overview.invalidate(), utils.commerce.orders.mine.invalidate(), utils.commerce.catalog.home.invalidate()]);
    },
    onError: err => toast.error(err.message),
  });
  const deleteOrder = trpc.commerce.admin.orders.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الطلب نهائياً");
      await Promise.all([utils.commerce.admin.orders.list.invalidate(), utils.commerce.admin.overview.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const allOrders = (query.data ?? []).filter(o => o.city !== "طلب توفير خاص" && !String(o.orderNumber || "").startsWith("REQ-"));

  const customerSummaryByPhone = new Map<string, {
    weekOrdersCount: number;
    weekSpent: number;
    weekItems: Array<{ name: string; qty: number; total: number }>;
    weekCancelledNotes: string[];
    allTimeOrdersCount: number;
    allTimeSpent: number;
    allTimeCancelledOrders: number;
    recentOrderNumbers: Array<{ orderNumber: string; total: number; status: string; createdAt: Date | string }>;
  }>();

  const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const ord of allOrders) {
    const phoneKey = String(ord.phone || "").trim();
    if (!phoneKey) continue;
    let rec = customerSummaryByPhone.get(phoneKey);
    if (!rec) {
      rec = { weekOrdersCount: 0, weekSpent: 0, weekItems: [], weekCancelledNotes: [], allTimeOrdersCount: 0, allTimeSpent: 0, allTimeCancelledOrders: 0, recentOrderNumbers: [] };
      customerSummaryByPhone.set(phoneKey, rec);
    }
    const ordTime = new Date(ord.createdAt).getTime();
    const isWeek = ordTime >= weekCutoff;
    rec.recentOrderNumbers.push({ orderNumber: ord.orderNumber, total: ord.total, status: ord.status, createdAt: ord.createdAt });
    if (ord.status === "cancelled") {
      rec.allTimeCancelledOrders += 1;
    } else {
      rec.allTimeOrdersCount += 1;
      rec.allTimeSpent += Number(ord.total || 0);
      if (isWeek) {
        rec.weekOrdersCount += 1;
        rec.weekSpent += Number(ord.total || 0);
        for (const it of ord.items || []) {
          const existingIt = rec.weekItems.find(x => x.name === it.productName);
          if (existingIt) { existingIt.qty += it.quantity; existingIt.total += Number(it.lineTotal || 0); }
          else { rec.weekItems.push({ name: it.productName, qty: it.quantity, total: Number(it.lineTotal || 0) }); }
        }
      }
    }
    for (const ev of ord.events || []) {
      if (String(ev.note || "").startsWith("❌")) {
        rec.weekCancelledNotes.push("[" + ord.orderNumber + "] " + ev.note);
      }
    }
  }

  const filteredOrders = allOrders.filter(order => {
    if (statusFilter === "active" && !["new", "preparing", "ready", "out_for_delivery"].includes(order.status)) return false;
    if (statusFilter !== "all" && statusFilter !== "active" && order.status !== statusFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      const matchNo = order.orderNumber.toLowerCase().includes(q);
      const matchName = (order.recipientName || "").toLowerCase().includes(q);
      const matchPhone = (order.phone || "").toLowerCase().includes(q);
      const matchItem = (order.items || []).some(i => i.productName.toLowerCase().includes(q));
      if (!matchNo && !matchName && !matchPhone && !matchItem) return false;
    }
    return true;
  });

  const exportOrders = () => {
    if (!filteredOrders.length) return;
    const quote = (value: string | number | null | undefined) => "\"" + String(value ?? "").replace(/"/g, "\"\"") + "\"";
    const rows: Array<Array<string | number | null | undefined>> = [
      ["رقم الطلب", "التاريخ", "المستلم", "الهاتف", "المدينة", "الحي", "الحالة", "المجموع الفرعي", "التوصيل", "الخصم", "الإجمالي", "طريقة الدفع", "الأصناف المشتراة", "الأصناف الملغاة"],
      ...filteredOrders.map(order => [
        order.orderNumber,
        new Date(order.createdAt).toLocaleString("ar-YE"),
        order.recipientName,
        order.phone,
        order.city,
        order.district,
        labels[order.status],
        order.subtotal,
        order.deliveryFee,
        order.discount,
        order.total,
        "نقدًا عند الاستلام",
        order.items.map(item => item.productName + " × " + item.quantity).join("; "),
        order.events.filter(e => String(e.note || "").startsWith("❌")).map(e => e.note).join(" | "),
      ]),
    ];
    const blob = new Blob(["\uFEFF", rows.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "shahezo-orders-" + new Date().toISOString().slice(0, 10) + ".csv"; link.click(); URL.revokeObjectURL(url);
  };

  const quickNotes = ["طلبك قيد التجهيز الآن 👨‍🍳", "طلبك جاهز للتوصيل ✨", "طلبك خرج للتوصيل 🛵", "المندوب قريب من موقعك 📍"];
  const cancelReasonPresets = [
    "غير متوفر اليوم في المخزون وتم خصم مبلغه من الفاتورة",
    "نفدت الكمية الطازجة منه حالياً وخُصم من إجمالي الفاتورة",
    "تم إلغاء الصنف بناءً على طلب العميل وتحديث الفاتورة",
  ];

  return (
    <div className="admin-content">
      <AdminHeading eyebrow="تحكم كامل بالفواتير والأصناف والتواصل" title="إدارة الطلبات والفواتير الذكية" text="ألغِ أي صنف غير متوفر من الفاتورة مع توضيح السبب للزبون، وشارك الفاتورة عبر واتساب أو اطبعها، وشاهد الملخص الأسبوعي لكل زبون." icon={ClipboardList} />
      <OwnerNotificationControl />

      <div className="filter-bar" style={{ marginTop: "12px", marginBottom: "12px" }}>
        <label className="filter-search">
          <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="ابحث برقم الطلب، اسم الزبون، رقم الهاتف، أو اسم الصنف..." />
        </label>
        <label className="filter-select">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">كل الطلبات ({allOrders.length})</option>
            <option value="active">طلبات قيد المتابعة الآن</option>
            <option value="new">جديد</option>
            <option value="preparing">قيد التجهيز</option>
            <option value="ready">جاهز للتوصيل</option>
            <option value="out_for_delivery">خرج للتوصيل</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">ملغي</option>
          </select>
        </label>
        {filteredOrders.length > 0 && (
          <button type="button" className="small-button" onClick={exportOrders}><Download size={15} /> تصدير تقرير CSV ({filteredOrders.length})</button>
        )}
      </div>

      {query.isLoading ? <AdminLoading /> : query.error ? <AdminError message={query.error.message} retry={() => void query.refetch()} /> : !filteredOrders.length ? <AdminEmpty title="لا توجد طلبات مطابقة" text="جرب تغيير فلتر الحالة أو البحث." /> : (
        <div className="admin-orders">
          {filteredOrders.map(order => {
            const allowedStatuses = [order.status, ...(nextStates[order.status] ?? [])];
            const noteVal = deliveryNotes[order.id] ?? "";
            const isFocused = focusedOrderNo === order.orderNumber;
            const canModifyItems = order.status !== "delivered" && order.status !== "cancelled";
            const cancelledEvents = (order.events || []).filter(ev => String(ev.note || "").startsWith("❌"));
            const custSummary = customerSummaryByPhone.get(String(order.phone || "").trim());

            const driverWhatsAppText = [
              "🛵 *طلب توصيل — بوفية شهيزو (SHAHEZO)*",
              "رقم الطلب: " + order.orderNumber,
              "العميل: " + order.recipientName,
              "الهاتف: " + order.phone,
              "العنوان: " + order.city + " - " + order.district + (order.addressDetails ? (" (" + order.addressDetails + ")") : ""),
              order.customerNote ? ("ملاحظة العميل: " + order.customerNote) : "",
              "------------------",
              "📦 *الأصناف المطلوبة:*",
              ...order.items.map(it => "• " + it.productName + " × " + it.quantity + " (" + money(it.lineTotal) + ")"),
              "------------------",
              "💰 *المبلغ المطلوب تحصيله نقداً:* " + money(order.total),
            ].filter(Boolean).join("\n");

            const customerWhatsAppText = [
              "مرحباً " + order.recipientName + " 🌿",
              "تفاصيل فاتورة طلبك رقم *" + order.orderNumber + "* من بوفية شهيزو (SHAHEZO):",
              ...order.items.map(it => "• " + it.productName + " × " + it.quantity + ": " + money(it.lineTotal)),
              ...(cancelledEvents.length ? ["", "🚫 *تعديلات وإلغاءات الفاتورة:*", ...cancelledEvents.map(c => "• " + c.note)] : []),
              "------------------",
              "المجموع الفرعي: " + money(order.subtotal),
              "رسوم التوصيل: " + money(order.deliveryFee),
              order.discount ? ("الخصم: " + money(order.discount)) : "",
              "*الإجمالي النهائي المطلوب:* " + money(order.total),
              "حالة الطلب الحالية: " + labels[order.status],
            ].filter(Boolean).join("\n");

            return (
              <article className="admin-order-card" key={order.id} style={isFocused ? { border: "2px solid #870210", boxShadow: "0 12px 28px rgba(135, 2, 16, 0.14)" } : undefined}>
                <div className="admin-order-top">
                  <div><strong className="order-number">{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleString("ar-YE")}</small></div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <span className={"status-pill status-" + order.status}>{labels[order.status]}</span>
                    <button type="button" className="small-button" onClick={() => printOrderInvoiceWindow(order)}>🖨️ طباعة فاتورة</button>
                    <button type="button" className="small-button danger-soft" onClick={() => { if (window.confirm("هل أنت متأكد من حذف الطلب «" + order.orderNumber + "» نهائياً؟")) deleteOrder.mutate({ id: order.id }); }}><Trash2 size={14} /> حذف</button>
                  </div>
                </div>

                <div className="admin-order-customer">
                  <strong>👤 {order.recipientName}</strong>
                  <span dir="ltr">📞 {order.phone}</span>
                  <span>📍 {order.city}، {order.district}</span>
                  {order.addressDetails && <small>تفاصيل العنوان: {order.addressDetails}</small>}
                  {order.customerNote && <small style={{ color: "#9c6509", fontWeight: 700 }}>📝 ملاحظة العميل: {order.customerNote}</small>}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "6px 0 10px" }}>
                  {order.phone && (
                    <a href={"tel:" + order.phone} className="small-button" style={{ fontSize: "11.5px" }}>📞 اتصال بالعميل</a>
                  )}
                  {order.phone && (
                    <a href={buildWhatsAppUrl(order.phone, customerWhatsAppText)} target="_blank" rel="noreferrer" className="small-button" style={{ background: "#fceee9", color: "#0f5c3a", borderColor: "#a8dfc0", fontWeight: 800, fontSize: "11.5px" }}>
                      📲 إرسال الفاتورة للعميل واتساب
                    </a>
                  )}
                  <a href={["ht", "tps://wa.me/?text="].join("") + encodeURIComponent(driverWhatsAppText)} target="_blank" rel="noreferrer" className="small-button" style={{ background: "#f2f6ff", color: "#1d4ed8", borderColor: "#bfd3fe", fontWeight: 800, fontSize: "11.5px" }}>
                    🛵 إرسال بيانات التوصيل للمندوب واتساب
                  </a>
                </div>

                {lastWhatsAppAlert && lastWhatsAppAlert.orderId === order.id && (
                  <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fceee9", border: "1.5px solid #870210", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#123b2a" }}>✅ تم تحديث الفاتورة وإشعار الزبون في الموقع! هل تود إرسال توضيح له عبر واتساب أيضاً؟</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <a href={buildWhatsAppUrl(lastWhatsAppAlert.phone, lastWhatsAppAlert.message)} target="_blank" rel="noreferrer" className="small-button selected">📲 إرسال التوضيح عبر واتساب</a>
                      <button type="button" className="small-button" onClick={() => setLastWhatsAppAlert(null)}><X size={13} /></button>
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gap: "6px", padding: "10px", borderRadius: "12px", background: "#f7faf8", border: "1px solid #dce7e0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "12px", color: "#870210" }}>🛒 أصناف الفاتورة المعتمدة ({order.items.length}):</strong>
                    {canModifyItems && <small style={{ fontSize: "11px", color: "#5c7365" }}>اضغط «إلغاء الصنف» لحذفه من الفاتورة وإبلاغ الزبون</small>}
                  </div>
                  {order.items.map(item => {
                    const isEditingThisItem = cancellingItem?.orderId === order.id && cancellingItem?.itemId === item.id;
                    return (
                      <div key={item.id} style={{ padding: "7px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #e2ece5", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 800, fontSize: "13px", color: "#132a1f" }}>
                            {item.productName} <span style={{ color: "#870210" }}>× {item.quantity}</span> · <b>{money(item.lineTotal)}</b>
                          </span>
                          {canModifyItems && (
                            <button
                              type="button"
                              className="small-button danger-soft"
                              style={{ minHeight: "26px", padding: "2px 9px", fontSize: "11px", fontWeight: 800 }}
                              onClick={() => {
                                if (isEditingThisItem) {
                                  setCancellingItem(null);
                                } else {
                                  setCancellingItem({ orderId: order.id, itemId: item.id, itemName: item.productName, maxQty: item.quantity, unitPrice: item.unitPrice });
                                  setCancelQty(item.quantity);
                                  setCancelReason("غير متوفر اليوم في المخزون وتم خصم مبلغه من الفاتورة");
                                }
                              }}
                            >
                              {isEditingThisItem ? "إغلاق" : "❌ إلغاء الصنف / تعديل"}
                            </button>
                          )}
                        </div>

                        {isEditingThisItem && (
                          <div style={{ padding: "10px", borderRadius: "10px", background: "#fff8f6", border: "1.5px solid #e8b4ab", display: "grid", gap: "8px" }}>
                            <strong style={{ fontSize: "12px", color: "#8f3225" }}>إلغاء «{item.productName}» من الفاتورة وإبلاغ الزبون بالسبب:</strong>
                            {item.quantity > 1 && (
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 700 }}>
                                <span>الكمية المراد إلغاؤها (من أصل {item.quantity}):</span>
                                <input type="number" min={1} max={item.quantity} value={cancelQty} onChange={e => setCancelQty(Math.max(1, Math.min(item.quantity, Number(e.target.value) || 1)))} style={{ width: "75px", padding: "4px 8px", borderRadius: "8px", background: "#fff" }} />
                                <small style={{ color: "#8f3225" }}>(سيُخصم {money(cancelQty * item.unitPrice)})</small>
                              </label>
                            )}
                            <label style={{ display: "grid", gap: "4px", fontSize: "11.5px", fontWeight: 700, color: "#5e2922" }}>
                              <span>رسالة التوضيح للزبون (تصل للزبون وتُحفظ في التقارير):</span>
                              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="اكتب سبب الإلغاء للزبون..." style={{ padding: "7px 10px", borderRadius: "8px", background: "#fff", border: "1px solid #dfa49a" }} />
                            </label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                              {cancelReasonPresets.map(pr => (
                                <button key={pr} type="button" className="small-button" style={{ fontSize: "10px", minHeight: "24px", padding: "2px 8px", background: "#fff" }} onClick={() => setCancelReason(pr)}>{pr}</button>
                              ))}
                            </div>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button type="button" className="small-button" onClick={() => setCancellingItem(null)}>تراجع</button>
                              <button
                                type="button"
                                className="small-button selected"
                                style={{ background: "#9b3b2e", borderColor: "#9b3b2e", color: "#fff" }}
                                disabled={removeItemMut.isPending || !cancelReason.trim()}
                                onClick={() => removeItemMut.mutate({ orderId: order.id, itemId: item.id, cancelQty, reason: cancelReason.trim() })}
                              >
                                {removeItemMut.isPending ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} تأكيد الحذف من الفاتورة وإشعار الزبون
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {cancelledEvents.length > 0 && (
                  <div style={{ marginTop: "8px", padding: "10px 12px", borderRadius: "12px", background: "#fff5f4", border: "1px solid #f0c4bc", display: "grid", gap: "4px" }}>
                    <strong style={{ fontSize: "12px", color: "#8f3225" }}>🚫 أصناف تم إلغاؤها وخصمها من هذه الفاتورة ({cancelledEvents.length}):</strong>
                    {cancelledEvents.map(ev => (
                      <div key={ev.id} style={{ fontSize: "11.5px", color: "#5e251d", lineHeight: 1.5 }}>• {ev.note}</div>
                    ))}
                  </div>
                )}

                <div className="admin-order-total">
                  <span>فرعي {money(order.subtotal)} · توصيل {money(order.deliveryFee)}{order.discount ? " · خصم " + money(order.discount) : ""}</span>
                  <strong>الإجمالي النهائي: {money(order.total)}</strong>
                </div>

                <div className="admin-order-controls">
                  <label>حالة الطلب
                    <select value={order.status} disabled={order.status === "delivered" || order.status === "cancelled" || change.isPending} onChange={e => change.mutate({ id: order.id, status: e.target.value as "new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled", note: noteVal.trim() || undefined }, { onSuccess: () => setDeliveryNotes(current => ({ ...current, [order.id]: "" })) })}>
                      {Object.entries(labels).filter(([value]) => allowedStatuses.includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <span className="cod-note small"><Truck size={15} /> نقدًا عند الاستلام</span>
                </div>

                <div className="admin-order-delivery-note" style={{ display: "grid", gap: "6px", marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#870210" }}>💬 التحدث مع العميل / إرسال توضيح أو إشعار فوري لجواله:</span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <input maxLength={500} value={noteVal} onChange={e => setDeliveryNotes(current => ({ ...current, [order.id]: e.target.value }))} placeholder="اكتب رسالتك أو توضيحك للعميل..." style={{ flex: "1 1 200px" }} />
                    <button type="button" className="small-button selected" disabled={!noteVal.trim() || sendNoteMut.isPending} onClick={() => sendNoteMut.mutate({ id: order.id, note: noteVal.trim() })}><BellRing size={14} /> إرسال إشعار فوري</button>
                    {order.phone && noteVal.trim() && (
                      <a href={buildWhatsAppUrl(order.phone, "مرحباً " + order.recipientName + " 🌿\nبخصوص طلبك رقم " + order.orderNumber + ":\n" + noteVal.trim())} target="_blank" rel="noreferrer" className="small-button" style={{ background: "#fceee9", color: "#0f5c3a", fontWeight: 800 }}>
                        📲 إرسالها واتساب أيضاً
                      </a>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {quickNotes.map(qn => (
                      <button key={qn} type="button" className="small-button" style={{ fontSize: "10px", minHeight: "26px", padding: "0 8px" }} onClick={() => setDeliveryNotes(current => ({ ...current, [order.id]: qn }))}>{qn}</button>
                    ))}
                  </div>
                </div>

                {custSummary && (
                  <details className="order-history" style={{ marginTop: "10px", background: "#fdf6f0", border: "1.5px solid #c5dfd0", borderRadius: "12px", padding: "10px 12px" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 900, fontSize: "12.5px", color: "#144530", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                      <span>📊 ملخص الطلبات الأسبوعي والشامل للزبون: {order.recipientName} (<b dir="ltr">{order.phone}</b>)</span>
                      <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "#870210", color: "#f1d897" }}>
                        هذا الأسبوع: {custSummary.weekOrdersCount} طلب ({money(custSummary.weekSpent)}) · الكلي: {custSummary.allTimeOrdersCount} طلب
                      </span>
                    </summary>
                    <div style={{ marginTop: "10px", display: "grid", gap: "10px", fontSize: "12px", color: "#1d3b2b" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
                        <div style={{ padding: "8px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d4e6db" }}>
                          <small style={{ color: "#536e5f", display: "block" }}>طلبات هذا الأسبوع (7 أيام)</small>
                          <strong style={{ fontSize: "14px", color: "#870210" }}>{custSummary.weekOrdersCount} طلب · {money(custSummary.weekSpent)}</strong>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d4e6db" }}>
                          <small style={{ color: "#536e5f", display: "block" }}>إجمالي مشتريات الزبون الكلي</small>
                          <strong style={{ fontSize: "14px", color: "#870210" }}>{custSummary.allTimeOrdersCount} طلب · {money(custSummary.allTimeSpent)}</strong>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d4e6db" }}>
                          <small style={{ color: "#536e5f", display: "block" }}>الطلبات الملغاة بالكامل</small>
                          <strong style={{ fontSize: "14px", color: "#8f3225" }}>{custSummary.allTimeCancelledOrders} طلب ملغي</strong>
                        </div>
                      </div>

                      <div style={{ padding: "9px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d4e6db" }}>
                        <strong style={{ display: "block", marginBottom: "5px", color: "#870210" }}>🛍️ كل الأصناف التي اشتراها هذا الزبون خلال الأسبوع:</strong>
                        {!custSummary.weekItems.length ? <small style={{ color: "#6c7f73" }}>لا توجد أصناف مشتراة خلال آخر 7 أيام.</small> : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {custSummary.weekItems.map(wi => (
                              <span key={wi.name} style={{ padding: "4px 9px", borderRadius: "8px", background: "#eef6f1", border: "1px solid #cbe0d2", fontWeight: 700, fontSize: "11.5px" }}>
                                {wi.name} × {wi.qty} ({money(wi.total)})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {custSummary.weekCancelledNotes.length > 0 && (
                        <div style={{ padding: "9px 10px", borderRadius: "10px", background: "#fff6f5", border: "1px solid #f0c8c0" }}>
                          <strong style={{ display: "block", marginBottom: "4px", color: "#8f3225" }}>🚫 الأصناف التي أُلغيت لهذا الزبون:</strong>
                          {custSummary.weekCancelledNotes.map((cn, idx) => (
                            <div key={idx} style={{ fontSize: "11px", color: "#63261e" }}>• {cn}</div>
                          ))}
                        </div>
                      )}

                      <div style={{ padding: "9px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #d4e6db" }}>
                        <strong style={{ display: "block", marginBottom: "5px", color: "#870210" }}>📋 فواتير وطلبات هذا الزبون ({custSummary.recentOrderNumbers.length}):</strong>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {custSummary.recentOrderNumbers.slice(0, 10).map(ro => (
                            <span key={ro.orderNumber} style={{ padding: "3px 8px", borderRadius: "7px", background: "#f5f8f6", border: "1px solid #d5e2da", fontSize: "11px" }}>
                              <b>{ro.orderNumber}</b> · {money(ro.total)} · {labels[ro.status]} ({new Date(ro.createdAt).toLocaleDateString("ar-YE")})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                )}

                {order.events.length ? (
                  <details className="order-history" open={isFocused}>
                    <summary>سجل تغييرات الحالة والإشعارات ({order.events.length})</summary>
                    <ol>{order.events.map(event => <li key={event.id}><span className={"status-pill status-" + event.status}>{labels[event.status]}</span><time>{new Date(event.createdAt).toLocaleString("ar-YE")}</time>{event.note && <small>{event.note}</small>}</li>)}</ol>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
const OWNER_ORDER_CURSOR_KEY = "shahezo-owner-order-notification-cursor-v1";
function readOwnerOrderCursor() {
  try {
    if (typeof window === "undefined") return 0;
    const value = Number(window.localStorage.getItem(OWNER_ORDER_CURSOR_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch { return 0; }
}

function useAdminGlobalPushSync(isAdmin: boolean) {
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  const subscribe = trpc.commerce.admin.notifications.subscribe.useMutation();
  useEffect(() => {
    if (!isAdmin || getPushPermissionState() !== "granted") return;
    let active = true;
    void (async () => {
      try {
        let subscription = await getExistingBrowserPushSubscription();
        if (!subscription) {
          const key = publicKey.data ?? (await publicKey.refetch()).data;
          if (key) subscription = await ensureBrowserPushSubscription(key);
        }
        if (!subscription || !active) return;
        await subscribe.mutateAsync(subscription);
      } catch {}
    })();
    return () => { active = false; };
  }, [isAdmin]);
}

function OwnerNotificationControl() {
  const utils = trpc.useUtils();
  const [permission, setPermission] = useState(getPushPermissionState);
  const [enabled, setEnabled] = useState(() => getPushPermissionState() === "granted");
  const [pending, setPending] = useState(false);
  const [cursor, setCursor] = useState(readOwnerOrderCursor);
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  const subscribe = trpc.commerce.admin.notifications.subscribe.useMutation();
  const testPush = trpc.commerce.admin.notifications.testPush.useMutation({
    onSuccess: () => toast.success("أُرسل إشعار تجريبي لشريط جوالك الآن!"),
    onError: err => toast.error(err.message),
  });
  const newOrders = trpc.commerce.admin.orders.createdAfter.useQuery({ afterId: cursor }, { retry: 1, staleTime: 0, refetchInterval: 10_000, refetchOnWindowFocus: true });

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
        await subscribe.mutateAsync(subscription);
        if (active) setEnabled(true);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const data = newOrders.data;
    if (!data) return;
    const saveCursor = (next: number) => {
      setCursor(next);
      try { window.localStorage.setItem(OWNER_ORDER_CURSOR_KEY, String(next)); } catch {}
    };
    if (cursor === 0) {
      if (data.latestId > 0) saveCursor(data.latestId);
      return;
    }
    const incoming = data.orders.filter(order => order.id > cursor);
    if (incoming.length) {
      incoming.forEach(order => toast.success("🛍️ وصل طلب جديد " + order.orderNumber));
      void Promise.all([utils.commerce.admin.orders.list.invalidate(), utils.commerce.admin.overview.invalidate()]);
    }
    if (data.latestId > cursor) saveCursor(data.latestId);
  }, [newOrders.data, cursor, utils]);

  const enableNotifications = async () => {
    setPending(true);
    try {
      const requestedPermission = await requestPushPermission();
      setPermission(requestedPermission);
      if (requestedPermission === "unsupported") throw new Error("متصفحك لا يدعم إشعارات Push لهذا التطبيق.");
      if (requestedPermission !== "granted") throw new Error("يرجى السماح بالإشعارات من إعدادات الموقع في المتصفح.");
      const key = publicKey.data ?? (await publicKey.refetch()).data;
      if (!key) throw new Error("تعذر الاتصال بخدمة الإشعارات. أعد المحاولة بعد قليل.");
      const subscription = await ensureBrowserPushSubscription(key);
      await subscribe.mutateAsync(subscription);
      setEnabled(true);
      toast.success("تم ربط هذا الجهاز بإشعارات الإدارة الفورية بنجاح!");
      void testPush.mutateAsync().catch(() => {});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تفعيل إشعارات الطلبات.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="owner-push-control" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "14px 16px", borderRadius: "16px", background: enabled ? "#edf7f0" : "#fff9e8", border: enabled ? "1.5px solid #b8dec6" : "1.5px solid #f0dc9c" }}>
      <div>
        <strong style={{ display: "block", color: "#870210", fontSize: "13px" }}>{enabled ? "🔔 إشعارات الإدارة الفورية نشطة على هذا الجهاز" : "🔔 تفعيل إشعارات الطلبات الفورية للإدارة"}</strong>
        <small style={{ color: "#4e6258", fontSize: "11px" }}>{permission === "denied" ? "الإذن محظور من إعدادات المتصفح؛ يرجى السماح به من أيقونة القفل أعلى المتصفح." : enabled ? "يصلك إشعار فوري مع كل طلب جديد لجميع الصلاحيات حتى لو كان الموقع مغلقاً لساعات." : "فعّل الإشعارات مرة واحدة ليصلك تنبيه فوري بشعار المتجر عند تأكيد أي طلب جديد."}</small>
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" className="small-button selected" onClick={() => void enableNotifications()} disabled={pending || permission === "denied" || permission === "unsupported"}>
          <BellRing size={15} />{pending ? "جارٍ الربط..." : enabled ? "تحديث ربط الإشعارات" : "تفعيل الإشعارات الآن"}
        </button>
        {enabled && (
          <button type="button" className="small-button" onClick={() => testPush.mutate()} disabled={testPush.isPending}>
            {testPush.isPending ? "جارٍ الإرسال..." : "🔔 تجربة الإشعار"}
          </button>
        )}
      </div>
    </section>
  );
}


function UsersPanel() {
  const query = trpc.commerce.admin.customers.list.useQuery(undefined, { retry: 1 });
  return <div className="admin-content">
    <AdminHeading eyebrow="مجتمع المتجر" title="سجل العملاء" text="تُجمع أرقام العملاء من الطلبات التي أتموها. لا يحتاج العميل إلى إنشاء حساب؛ اتصل به لتأكيد الطلب والتوصيل." icon={Users} />
    <div className="privacy-note"><ShieldCheck size={17} /><span></span></div>
    {query.isLoading ? <AdminLoading /> : query.error ? <AdminError message={query.error.message} retry={() => void query.refetch()} /> : !query.data?.length ? <AdminEmpty title="لا يوجد عملاء بعد" text="ستظهر أرقام العملاء هنا بعد استلام أول طلب." /> : <div className="user-list">{query.data.map(customer => <article className="user-row" key={customer.phone}>
      <span className="user-avatar"><CircleUserRound size={20} /></span>
      <div className="user-main"><strong dir="ltr">{customer.phone}</strong><small>آخر طلب: {new Date(customer.lastOrderAt).toLocaleString("ar-YE")}</small></div>
      <span className="visibility-tag visible">{customer.orderCount} {customer.orderCount === 1 ? "طلب" : "طلبات"}</span>
      <a className="small-button" href={`tel:${customer.phone}`}>اتصال بالعميل</a>
      <details className="user-details"><summary>ملخص مشتريات العميل</summary><div className="user-detail-grid"><span>عدد الطلبات: <strong>{customer.orderCount}</strong></span><span>قيمة الطلبات غير الملغاة: <strong>{money(customer.totalSpent)}</strong></span><span>آخر طلب: <strong>{new Date(customer.lastOrderAt).toLocaleString("ar-YE")}</strong></span></div><small className="subtle-note">لعرض الاسم والعنوان وتفاصيل التحقق، افتح الطلب الأخير من قائمة الطلبات.</small></details>
    </article>)}</div>}
  </div>;
}

type AdminRewardCfg = {
  rewardMode: "custom_gift" | "free_delivery" | "discount_percent" | "discount_fixed";
  giftName: string;
  fixedDiscount: number;
  endsAt: string;
  audience: "all" | "new_customers" | "returning_customers" | "vip_customers" | "specific_phones";
  allowedPhones: string;
  placement: "everywhere" | "home_and_cart" | "cart_only";
};

function unpackAdminRewardCfg(rawMsg?: string | null, fallbackType?: string): { cleanMessage: string; cfg: AdminRewardCfg } {
  const defaultCfg: AdminRewardCfg = {
    rewardMode: fallbackType === "discount_percent" ? "discount_percent" : "custom_gift",
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

function packAdminRewardCfg(cleanMessage: string, cfg: AdminRewardCfg): string {
  const clean = cleanMessage.trim();
  return (clean ? clean + " " : "") + "[[rcfg:" + JSON.stringify(cfg) + "]]";
}

function SettingsPanel() {
  const utils = trpc.useUtils();
  const query = trpc.commerce.admin.settings.get.useQuery(undefined, { retry: 1 });
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState({
    storeName: "شهيزو – SHAHEZO",
    storeDescription: "",
    contactPhone: "",
    currency: "ر.ي",
    storeIconUrl: "",
    deliveryEnabled: false,
    deliveryFee: "",
    deliveryZones: [] as Array<{ name: string; fee: number; enabled: boolean }>,
    orderPaused: false,
    pausedMessage: "",
    rewardEnabled: false,
    rewardsThreshold: "5000",
    rewardType: "free_delivery" as "free_delivery" | "discount_percent",
    rewardValue: "0",
    rewardsMessage: "",
    aiInstructions: "",
  });
  const [rcfg, setRcfg] = useState<AdminRewardCfg>({
    rewardMode: "custom_gift",
    giftName: "هدية مجانية مميزة من شهيزو 🎁",
    fixedDiscount: 500,
    endsAt: "",
    audience: "all",
    allowedPhones: "",
    placement: "everywhere",
  });

  useEffect(() => {
    if (!query.data || ready) return;
    const raw = query.data;
    let zones: Array<{ name: string; fee: number; enabled: boolean }> = [];
    try { const parsed = JSON.parse(raw.deliveryZones || "[]"); if (Array.isArray(parsed)) zones = parsed; } catch {}
    const unpacked = unpackAdminRewardCfg(raw.rewardsMessage, raw.rewardType);
    setValues({
      storeName: raw.storeName || "شهيزو – SHAHEZO",
      storeDescription: raw.storeDescription || "",
      contactPhone: raw.contactPhone || "",
      currency: raw.currency || "ر.ي",
      storeIconUrl: raw.storeIconUrl || "",
      deliveryEnabled: raw.deliveryEnabled === "true",
      deliveryFee: raw.deliveryFee || "",
      deliveryZones: zones,
      orderPaused: raw.orderPaused === "true",
      pausedMessage: raw.pausedMessage || "",
      rewardEnabled: raw.rewardEnabled === "true",
      rewardsThreshold: raw.rewardsThreshold || "5000",
      rewardType: raw.rewardType === "discount_percent" ? "discount_percent" : "free_delivery",
      rewardValue: raw.rewardValue || "0",
      rewardsMessage: unpacked.cleanMessage,
      aiInstructions: (raw as any).aiInstructions || "",
    });
    setRcfg(unpacked.cfg);
    setReady(true);
  }, [query.data, ready]);

  const save = trpc.commerce.admin.settings.save.useMutation({
    onSuccess: async () => {
      toast.success("تم حفظ إعدادات المتجر وشريط الهدايا التفاعلي بنجاح!");
      await utils.commerce.admin.settings.get.invalidate();
      await utils.commerce.catalog.home.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const update = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues(current => ({ ...current, [key]: value }));
  const updateRcfg = <K extends keyof AdminRewardCfg>(key: K, value: AdminRewardCfg[K]) => setRcfg(current => ({ ...current, [key]: value }));

  const setDurationHours = (hours: number | null) => {
    if (!hours) { updateRcfg("endsAt", ""); return; }
    const d = new Date(Date.now() + hours * 3600 * 1000);
    const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    updateRcfg("endsAt", isoLocal);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (values.deliveryZones.some(zone => !zone.name.trim() || !Number.isInteger(zone.fee) || zone.fee < 0)) { toast.error("أكمل اسم كل منطقة وتأكد أن رسومها رقم صحيح غير سالب."); return; }
    if (values.deliveryEnabled && values.deliveryFee === "" && !values.deliveryZones.some(zone => zone.enabled)) { toast.error("حدد رسومًا أساسية أو فعّل منطقة توصيل واحدة على الأقل قبل استقبال الطلبات."); return; }
    if (values.deliveryFee !== "" && (!Number.isInteger(Number(values.deliveryFee)) || Number(values.deliveryFee) < 0)) { toast.error("الرسوم الأساسية يجب أن تكون عددًا صحيحًا غير سالب."); return; }
    const mappedRewardType = rcfg.rewardMode === "discount_percent" ? "discount_percent" : "free_delivery";
    const packedMessage = packAdminRewardCfg(values.rewardsMessage, rcfg);
    save.mutate({
      storeName: values.storeName,
      storeDescription: values.storeDescription,
      contactPhone: values.contactPhone,
      currency: values.currency,
      storeIconUrl: values.storeIconUrl || null,
      deliveryEnabled: values.deliveryEnabled,
      deliveryFee: values.deliveryFee === "" ? null : Number(values.deliveryFee),
      deliveryZones: values.deliveryZones,
      orderPaused: values.orderPaused,
      pausedMessage: values.pausedMessage,
      rewardEnabled: values.rewardEnabled,
      rewardsThreshold: values.rewardsThreshold === "" ? null : Number(values.rewardsThreshold),
      rewardType: mappedRewardType,
      rewardValue: Math.min(100, Math.max(0, Number(values.rewardValue) || 0)),
      rewardsMessage: packedMessage,
    });
  };

  const addZone = () => update("deliveryZones", [...values.deliveryZones, { name: "", fee: 0, enabled: true }]);
  const patchZone = (index: number, patch: Partial<(typeof values.deliveryZones)[number]>) => update("deliveryZones", values.deliveryZones.map((zone, i) => i === index ? { ...zone, ...patch } : zone));

  const previewThreshold = Number(values.rewardsThreshold) || 5000;
  const previewGiftLabel = rcfg.giftName.trim() || (rcfg.rewardMode === "free_delivery" ? "توصيل مجاني بالكامل 🛵" : rcfg.rewardMode === "discount_percent" ? ("خصم فوري " + (values.rewardValue || 10) + "% 🏷️") : rcfg.rewardMode === "discount_fixed" ? ("خصم نقدي " + rcfg.fixedDiscount + " ر.ي 💸") : "هدية مجانية من شهيزو 🎁");

  return <div className="admin-content"><AdminHeading eyebrow="مركز التحكم" title="إعدادات المتجر وشريط الهدايا الحماسي" text="اضبط هوية المتجر ومناطق التوصيل وشريط المكافآت التفاعلي لرفع حماس ومشتريات الزبائن." icon={Settings2} />{query.isLoading ? <AdminLoading /> : query.error ? <AdminError message={query.error.message} retry={() => void query.refetch()} /> : <form className="settings-form" onSubmit={submit}>
    <section className="admin-form-card"><div className="form-card-heading"><span className="form-card-number">01</span><div><h2>بيانات المتجر وهويته</h2><p>المعلومات والشعار الذي تختاره بنفسك.</p></div></div><div className="settings-brand-layout"><div className="form-fields-grid"><label>اسم المتجر<input required maxLength={100} value={values.storeName} onChange={e => update("storeName", e.target.value)} /></label><label>هاتف التواصل<input type="tel" value={values.contactPhone} onChange={e => update("contactPhone", e.target.value)} placeholder="أضف رقم المتجر" /></label><label>رمز العملة<input maxLength={20} value={values.currency} onChange={e => update("currency", e.target.value)} /></label><label className="field-wide">وصف المتجر<textarea rows={2} value={values.storeDescription} onChange={e => update("storeDescription", e.target.value)} /></label></div><ImageField title="قص شعار وأيقونة شهيزو" value={values.storeIconUrl} onChange={value => update("storeIconUrl", value)} kind="icon" aspect={1} /></div></section>
    <section className="admin-form-card"><div className="form-card-heading"><span className="form-card-number">02</span><div><h2>التوصيل واستقبال الطلبات</h2><p>لا يُفتح الشراء حتى تحدد منطقة أو رسومًا قابلة للتطبيق.</p></div></div><div className="form-fields-grid"><label className="toggle-field"><input type="checkbox" checked={values.deliveryEnabled} onChange={e => update("deliveryEnabled", e.target.checked)} /> تفعيل استقبال طلبات التوصيل</label><label>رسوم أساسية (ر.ي)<input type="number" min="0" step="1" value={values.deliveryFee} onChange={e => update("deliveryFee", e.target.value)} placeholder="غير محدد" /></label><div className="field-wide settings-zone-editor"><div className="admin-section-heading"><div><h3>مناطق التوصيل</h3><p>يمكن وضع رسوم مختلفة لكل مدينة أو منطقة.</p></div><button type="button" className="small-button" onClick={addZone}><Plus size={14} /> إضافة منطقة</button></div>{!values.deliveryZones.length ? <p className="subtle-note">لم تُضف مناطق بعد؛ سيُستخدم الرسم الأساسي إذا حُدد.</p> : values.deliveryZones.map((zone, index) => <div className="delivery-zone-row" key={index}><label>الاسم<input value={zone.name} onChange={e => patchZone(index, { name: e.target.value })} placeholder="اسم المنطقة" /></label><label>الرسم (ر.ي)<input type="number" min="0" step="1" value={zone.fee} onChange={e => patchZone(index, { fee: Number(e.target.value) })} /></label><label className="toggle-field"><input type="checkbox" checked={zone.enabled} onChange={e => patchZone(index, { enabled: e.target.checked })} /> مفعّلة</label><button type="button" className="small-button danger-soft" onClick={() => update("deliveryZones", values.deliveryZones.filter((_, i) => i !== index))}>حذف</button></div>)}</div><label className="toggle-field"><input type="checkbox" checked={values.orderPaused} onChange={e => update("orderPaused", e.target.checked)} /> إيقاف استقبال الطلبات مؤقتًا</label><label className="field-wide">رسالة الإيقاف<textarea value={values.pausedMessage} onChange={e => update("pausedMessage", e.target.value)} placeholder="اكتب الرسالة التي يراها العميل" /></label></div></section>

    <section className="admin-form-card" style={{ border: "2px solid #e3c472", background: "linear-gradient(180deg, #fffdf7 0%, #ffffff 100%)" }}>
      <div className="form-card-heading">
        <span className="form-card-number" style={{ background: "#870210", color: "#f1d897" }}>03</span>
        <div>
          <h2>🎁 شريط المكافآت والهدايا التفاعلي الحماسي</h2>
          <p>شريط تفاعلي يتحرك أمام الزبون كلما أضاف منتجاً للسلة ليحفّزه على إكمال المبلغ المحدد والفوز بالهدية.</p>
        </div>
      </div>

      <div className="form-fields-grid">
        <label className="toggle-field field-wide" style={{ padding: "12px 14px", borderRadius: "12px", background: values.rewardEnabled ? "#fceee9" : "#f5f5f2", border: values.rewardEnabled ? "1.5px solid #870210" : "1px solid #dcdcd4", fontWeight: 800 }}>
          <input type="checkbox" checked={values.rewardEnabled} onChange={e => update("rewardEnabled", e.target.checked)} />
          <span>{values.rewardEnabled ? "✅ شريط الهدايا التفاعلي الحماسي مفعّل ويظهر للزبائن الآن" : "تفعيل شريط الهدايا والمكافآت التفاعلي في المتجر"}</span>
        </label>

        <div className="field-wide" style={{ display: "grid", gap: "8px" }}>
          <label>💰 المبلغ المطلوب للحصول على الهدية (ر.ي)
            <input type="number" min="100" step="100" value={values.rewardsThreshold} onChange={e => update("rewardsThreshold", e.target.value)} placeholder="مثلاً: 5000" />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {[2000, 3000, 5000, 7500, 10000, 15000].map(amt => (
              <button key={amt} type="button" className={"small-button" + (Number(values.rewardsThreshold) === amt ? " selected" : "")} onClick={() => update("rewardsThreshold", String(amt))}>
                {amt.toLocaleString("en-US")} ر.ي
              </button>
            ))}
          </div>
        </div>

        <label>🎯 نوع المكافأة عند بلوغ المبلغ
          <select value={rcfg.rewardMode} onChange={e => updateRcfg("rewardMode", e.target.value as AdminRewardCfg["rewardMode"])}>
            <option value="custom_gift">🎁 هدية مجانية يحددها المتجر (تُضاف تلقائياً لفاتورة الطلب)</option>
            <option value="free_delivery">🛵 توصيل مجاني بالكامل (+ هدية اختيارية)</option>
            <option value="discount_percent">🏷️ خصم نسبة مئوية % من السلة (+ هدية اختيارية)</option>
            <option value="discount_fixed">💸 خصم مبلغ نقدي ثابت بالريال (+ هدية اختيارية)</option>
          </select>
        </label>

        {rcfg.rewardMode === "discount_percent" && (
          <label>نسبة الخصم %
            <input type="number" min="1" max="100" value={values.rewardValue} onChange={e => update("rewardValue", e.target.value)} placeholder="مثلاً: 10" />
          </label>
        )}

        {rcfg.rewardMode === "discount_fixed" && (
          <label>قيمة الخصم النقدي الثابت (ر.ي)
            <input type="number" min="50" step="50" value={rcfg.fixedDiscount} onChange={e => updateRcfg("fixedDiscount", Number(e.target.value) || 0)} placeholder="مثلاً: 500" />
          </label>
        )}

        <div className="field-wide" style={{ display: "grid", gap: "8px" }}>
          <label>🎁 اسم الهدية التي تظهر للزبون في الشريط وفي الطلب
            <input maxLength={140} value={rcfg.giftName} onChange={e => updateRcfg("giftName", e.target.value)} placeholder="مثلاً: ساندوتش فلافل مجاناً 🥙 أو عصير طبيعي بارد هدية 🧃" />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {["ساندوتش فلافل مجاناً 🥙", "عصير طبيعي بارد هدية 🧃", "صحن بطاط مقرمش هدية 🍟", "هدية مفاجأة من شهيزو 🎁", "توصيل مجاني + هدية فورية 🚀"].map(preset => (
              <button key={preset} type="button" className={"small-button" + (rcfg.giftName === preset ? " selected" : "")} style={{ fontSize: "11px" }} onClick={() => updateRcfg("giftName", preset)}>
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="field-wide" style={{ display: "grid", gap: "8px", padding: "12px", borderRadius: "12px", background: "#f8faf8", border: "1px solid #e1eae4" }}>
          <label style={{ margin: 0 }}>⏳ مدة العرض والعدّاد التنازلي الحماسي (اختياري)
            <input type="datetime-local" value={rcfg.endsAt} onChange={e => updateRcfg("endsAt", e.target.value)} />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <button type="button" className={"small-button" + (!rcfg.endsAt ? " selected" : "")} onClick={() => setDurationHours(null)}>♾️ مفتوح بدون انتهاء</button>
            <button type="button" className="small-button" onClick={() => setDurationHours(3)}>🔥 لمدة 3 ساعات</button>
            <button type="button" className="small-button" onClick={() => setDurationHours(12)}>⚡ لمدة 12 ساعة</button>
            <button type="button" className="small-button" onClick={() => setDurationHours(24)}>⏳ لمدة 24 ساعة</button>
            <button type="button" className="small-button" onClick={() => setDurationHours(72)}>📅 لمدة 3 أيام</button>
            <button type="button" className="small-button" onClick={() => setDurationHours(168)}>🗓️ لمدة أسبوع</button>
          </div>
        </div>

        <label>👥 لمن يظهر هذا العرض؟
          <select value={rcfg.audience} onChange={e => updateRcfg("audience", e.target.value as AdminRewardCfg["audience"])}>
            <option value="all">🌟 جميع زوار المتجر (الكل)</option>
            <option value="new_customers">🆕 الزبائن الجدد فقط (من لم يطلبوا سابقاً)</option>
            <option value="returning_customers">💎 الزبائن الدائمون فقط (من لديهم طلب سابق أو أكثر)</option>
            <option value="vip_customers">👑 كبار العملاء VIP (من لديهم 3 طلبات فأكثر)</option>
            <option value="specific_phones">📱 أرقام هواتف محددة فقط</option>
          </select>
        </label>

        <label>📍 مكان ظهور الشريط التفاعلي
          <select value={rcfg.placement} onChange={e => updateRcfg("placement", e.target.value as AdminRewardCfg["placement"])}>
            <option value="everywhere">🔥 في كل مكان (أعلى المتجر + المنتجات + السلة + شريط عائم سفلي)</option>
            <option value="home_and_cart">🏠 الصفحة الرئيسية + السلة فقط</option>
            <option value="cart_only">🛒 صفحة السلة فقط</option>
          </select>
        </label>

        {rcfg.audience === "specific_phones" && (
          <label className="field-wide">📱 أرقام الهواتف المسموح لها برؤية العرض (افصل بينها بفاصلة)
            <input value={rcfg.allowedPhones} onChange={e => updateRcfg("allowedPhones", e.target.value)} placeholder="مثلاً: 770731619, 771234567" dir="ltr" />
          </label>
        )}

        <label className="field-wide">✨ عبارة تشويقية إضافية تحت الشريط (اختياري)
          <input maxLength={220} value={values.rewardsMessage} onChange={e => update("rewardsMessage", e.target.value)} placeholder="مثلاً: اطلب الآن واستمتع بهدايا وعروض شهيزو اليومية!" />
        </label>

        <div className="field-wide" style={{ padding: "14px", borderRadius: "16px", background: "linear-gradient(135deg, #0f3826 0%, #1d5c41 100%)", color: "#ffffff", boxShadow: "0 10px 24px rgba(15, 56, 38, 0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "12px" }}>
            <strong style={{ color: "#f5dc98" }}>👀 معاينة حية لشكل الشريط أمام الزبون:</strong>
            <span style={{ background: "rgba(241, 216, 151, 0.2)", color: "#f5dc98", padding: "2px 8px", borderRadius: "99px", fontSize: "10px", fontWeight: 800 }}>65% مكتمل</span>
          </div>
          <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "8px" }}>
            ⚡ اقتربت جداً! أضف بقيمة {Math.round(previewThreshold * 0.35).toLocaleString("en-US")} ر.ي فقط لتربح «{previewGiftLabel}»!
          </div>
          <div style={{ height: "11px", borderRadius: "99px", background: "rgba(255,255,255,0.16)", overflow: "hidden", padding: "2px" }}>
            <div style={{ width: "65%", height: "100%", borderRadius: "99px", background: "linear-gradient(90deg, #f3c65f, #ffe89e, #4ade80)" }} />
          </div>
        </div>
      </div>
    </section>
    <section className="admin-form-card">
        <div className="form-card-heading">
          <span className="form-card-number">🤖</span>
          <div><h2>توجيهات وشخصية المساعد الذكي</h2><p>اكتب أي توجيهات تريد من الذكاء الاصطناعي الالتزام بها أثناء محادثة الزبائن (مثلاً: اقترح العصائر الطبيعية مع وجبات الشاورما والفلافل، ركز على البوكسات العائلية، إلخ).</p></div>
        </div>
        <div className="form-stack">
          <label className="field-wide">توجيهاتك الخاصة للمساعد الذكي
            <textarea rows={4} maxLength={2500} value={values.aiInstructions} onChange={e => setValues({ ...values, aiInstructions: e.target.value })} placeholder="مثلاً: رحب بالزبون بحرارة، واقترح عليه العصائر الطبيعية مع وجبات الشاورما والفلافل، وركز على البوكسات العائلية..." />
          </label>
        </div>
      </section>
      <button className="button button-primary settings-save" disabled={save.isPending}>{save.isPending ? <LoaderCircle className="spin" size={16} /> : <Save size={17} />}{save.isPending ? "جارٍ الحفظ..." : "حفظ كل الإعدادات"}</button>
  </form>}</div>;
}


function AdminHeading({ eyebrow, title, text, icon: Icon }: { eyebrow: string; title: string; text: string; icon: typeof Package }) { return <div className="admin-page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div><span className="admin-heading-mark"><Icon size={25} /></span></div>; }
function AdminEmpty({ title, text }: { title: string; text: string }) { return <div className="admin-empty"><span><Box size={22} /></span><strong>{title}</strong><small>{text}</small></div>; }
function AdminLoading() { return <div className="admin-loading"><LoaderCircle className="spin" size={20} /> جارٍ تحميل بيانات المتجر...</div>; }
function AdminError({ message, retry }: { message: string; retry: () => void }) { return <div className="admin-error"><AlertTriangle size={18} /><div><strong>تعذر تحميل بيانات الإدارة</strong><small>{message}</small></div><button className="small-button" onClick={retry}>إعادة المحاولة</button></div>; }

function ChatsPanel() {
  const utils = trpc.useUtils();
  const query = trpc.commerce.admin.chats.list.useQuery(undefined, { refetchInterval: 3000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const replyMutation = trpc.commerce.admin.chats.reply.useMutation({
    onSuccess: async () => {
      setReplyText("");
      toast.success("تم إرسال ردك للزبون في المحادثة مباشرة!");
      await utils.commerce.admin.chats.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });
  const toggleAiMutation = trpc.commerce.admin.chats.toggleAi.useMutation({
    onSuccess: async () => {
      await utils.commerce.admin.chats.list.invalidate();
    },
  });
  const deleteMutation = trpc.commerce.admin.chats.delete.useMutation({
    onSuccess: async () => {
      toast.success("حُذفت المحادثة");
      setSelectedId(null);
      await utils.commerce.admin.chats.list.invalidate();
    },
  });

  const sessions = query.data ?? [];
  const activeSession = sessions.find(s => s.sessionId === selectedId) ?? sessions[0] ?? null;

  const sendOwnerReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !replyText.trim() || replyMutation.isPending) return;
    replyMutation.mutate({ sessionId: activeSession.sessionId, text: replyText.trim() });
  };

  return (
    <div className="admin-content">
      <AdminHeading eyebrow="متابعة حية ومباشرة" title="محادثات الزبائن مع المساعد الذكي" text="شاهد جميع رسائل الزبائن مع الذكاء الاصطناعي لحظة بلحظة، وأرسل أي رد ليظهر للزبون فوراً داخل نفس المحادثة." icon={Sparkles} />
      {query.isLoading ? <AdminLoading /> : !sessions.length ? (
        <AdminEmpty title="لا توجد محادثات نشطة بعد" text="بمجرد أن يراسل أي زبون المساعد الذكي في المتجر، ستظهر محادثته هنا فوراً." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "16px", alignItems: "start" }}>
          <section className="admin-form-card" style={{ padding: "14px", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <strong>قائمة المحادثات ({sessions.length})</strong>
              <small style={{ color: "#0f5c3a" }}>تحديث تلقائي كل 3 ثوانٍ</small>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sessions.map(s => {
                const isSel = activeSession?.sessionId === s.sessionId;
                const lastMsg = s.messages[s.messages.length - 1];
                return (
                  <button
                    key={s.sessionId}
                    type="button"
                    onClick={() => setSelectedId(s.sessionId)}
                    style={{
                      textAlign: "right",
                      padding: "12px",
                      borderRadius: "12px",
                      border: isSel ? "2px solid #0f5c3a" : "1px solid #e2ebe5",
                      background: isSel ? "#f1f8f4" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "#12261c", fontSize: "0.92rem" }}>{s.customerName || "زبون المتجر"}</strong>
                      <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "99px", background: s.aiPaused ? "#fff3cd" : "#e3f5ec", color: s.aiPaused ? "#856404" : "#0f5c3a", fontWeight: 700 }}>
                        {s.aiPaused ? "✋ تدخل مباشر" : "🤖 الذكاء نشط"}
                      </span>
                    </div>
                    <small style={{ color: "#0f5c3a", fontWeight: 600 }} dir="ltr">{s.customerPhone}</small>
                    {lastMsg && <p style={{ margin: 0, fontSize: "0.8rem", color: "#556b5f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastMsg.sender}: {lastMsg.text}</p>}
                    <small style={{ fontSize: "0.7rem", color: "#889990" }}>{new Date(s.updatedAt).toLocaleTimeString("ar-YE")}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {activeSession && (
            <section className="admin-form-card" style={{ padding: "16px", display: "flex", flexDirection: "column", height: "70vh" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "8px", paddingBottom: "12px", borderBottom: "1px solid #e2ebe5" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>{activeSession.customerName}</h3>
                  <small style={{ color: "#0f5c3a", fontWeight: 700 }} dir="ltr">{activeSession.customerPhone}</small>
                  {activeSession.customerPhone && activeSession.customerPhone !== "غير مسجل بالموقع" && (
                    <a href={"tel:" + activeSession.customerPhone} className="small-button" style={{ marginRight: "8px", padding: "2px 8px", fontSize: "0.75rem" }}>📞 اتصال</a>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => toggleAiMutation.mutate({ sessionId: activeSession.sessionId, aiPaused: !activeSession.aiPaused })}
                    style={{ background: activeSession.aiPaused ? "#0f5c3a" : "#fff3cd", color: activeSession.aiPaused ? "#fff" : "#856404" }}
                  >
                    {activeSession.aiPaused ? "🤖 إعادة تفعيل الذكاء" : "✋ إيقاف الذكاء والرد بنفسي"}
                  </button>
                  <button
                    type="button"
                    className="small-button danger-soft"
                    onClick={() => deleteMutation.mutate({ sessionId: activeSession.sessionId })}
                  >
                    حذف
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 4px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeSession.messages.map(msg => {
                  const isUser = msg.role === "user";
                  const isOwner = msg.role === "owner";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isUser ? "flex-start" : "flex-end",
                        maxWidth: "85%",
                        padding: "10px 14px",
                        borderRadius: "14px",
                        background: isUser ? "#0f5c3a" : isOwner ? "#fff8e6" : "#f3f7f4",
                        color: isUser ? "#ffffff" : "#12261c",
                        border: isOwner ? "1.5px solid #e0a800" : isUser ? "none" : "1px solid #d5e6dc",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "4px", fontSize: "0.72rem", opacity: 0.85, fontWeight: 700 }}>
                        <span>{isUser ? "🧑 " + msg.sender : isOwner ? "👨‍💼 أنت (إدارة المتجر)" : "🤖 المساعد الذكي"}</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString("ar-YE")}</span>
                      </div>
                      <p style={{ margin: 0, whiteSpace: "pre-line", fontSize: "0.88rem", lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendOwnerReply} style={{ display: "flex", gap: "8px", paddingTop: "10px", borderTop: "1px solid #e2ebe5" }}>
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="اكتب رسالتك لتصل للزبون فوراً في نفس محادثة المساعد..."
                  style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid #cddbd2" }}
                />
                <button type="submit" className="button button-primary" disabled={!replyText.trim() || replyMutation.isPending}>
                  إرسال للزبون
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
// --- CHATS_PANEL_END ---
// --- STAFF_PANEL_START ---
function StaffManagementPanel({ actorIsOwner, actorPermissions, actorStaffId }: { actorIsOwner: boolean; actorPermissions: PermissionKey[]; actorStaffId: number | null }) {
  const utils = trpc.useUtils();
  const staffQuery = trpc.commerce.admin.staff.list.useQuery(undefined, { retry: 1 });
  const logsQuery = trpc.commerce.admin.staff.auditLogs.useQuery(undefined, { retry: 1, refetchInterval: 5000 });
  const catsQuery = trpc.commerce.admin.categories.list.useQuery(undefined, { retry: 1 });
  const [logActorFilter, setLogActorFilter] = useState<string>("all");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState<"general_manager" | "product_manager" | "order_manager" | "content_manager" | "staff">("product_manager");
  const [permissions, setPermissions] = useState<PermissionKey[]>(ROLE_DEFINITIONS.product_manager.defaultPermissions);
  const [allowedCategoryIds, setAllowedCategoryIds] = useState<number[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetMustChange, setResetMustChange] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const refreshAll = async () => {
    await Promise.all([
      utils.commerce.admin.staff.list.invalidate(),
      utils.commerce.admin.staff.auditLogs.invalidate(),
    ]);
  };

  const resetForm = () => {
    setEditingId(null);
    setDisplayName("");
    setUsername("");
    setPassword("");
    setRoleKey("product_manager");
    setPermissions([...ROLE_DEFINITIONS.product_manager.defaultPermissions]);
    setAllowedCategoryIds([]);
    setMustChangePassword(true);
  };

  const createMut = trpc.commerce.admin.staff.create.useMutation({
    onSuccess: async () => {
      toast.success("تم إنشاء الحساب الإداري وحفظ صلاحياته بنجاح");
      resetForm();
      await refreshAll();
    },
    onError: err => toast.error(err.message),
  });

  const updateMut = trpc.commerce.admin.staff.update.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث بيانات وصلاحيات المدير بنجاح");
      resetForm();
      await refreshAll();
    },
    onError: err => toast.error(err.message),
  });

  const statusMut = trpc.commerce.admin.staff.setStatus.useMutation({
    onSuccess: async (_res, vars) => {
      toast.success(vars.isActive ? "تم تفعيل الحساب الإداري" : "تم تعطيل الحساب وإبطال جلسته");
      await refreshAll();
    },
    onError: err => toast.error(err.message),
  });

  const resetPassMut = trpc.commerce.admin.staff.resetPassword.useMutation({
    onSuccess: async () => {
      toast.success("تم إعادة تعيين كلمة المرور بنجاح");
      setResetTarget(null);
      setResetNewPass("");
      await refreshAll();
    },
    onError: err => toast.error(err.message),
  });

  const deleteMut = trpc.commerce.admin.staff.delete.useMutation({
    onSuccess: async () => {
      toast.success("تم حذف الحساب الإداري بأمان");
      setDeleteTarget(null);
      await refreshAll();
    },
    onError: err => toast.error(err.message),
  });

  const handleRoleChange = (nextRole: "general_manager" | "product_manager" | "order_manager" | "content_manager" | "staff") => {
    setRoleKey(nextRole);
    const defaults = ROLE_DEFINITIONS[nextRole]?.defaultPermissions ?? [];
    const allowedDefaults = actorIsOwner ? defaults : defaults.filter(p => actorPermissions.includes(p));
    setPermissions([...allowedDefaults]);
  };

  const togglePermission = (perm: PermissionKey) => {
    if (!actorIsOwner && !actorPermissions.includes(perm)) {
      toast.error("لا يمكنك منح صلاحية لا تملكها في حسابك.");
      return;
    }
    setPermissions(curr => curr.includes(perm) ? curr.filter(p => p !== perm) : [...curr, perm]);
  };

  const generateStrongPass = (setter: (val: string) => void) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setter(out);
    navigator.clipboard?.writeText(out).catch(() => {});
    toast.success("تم توليد ونسخ كلمة مرور قوية: " + out);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.length) {
      toast.error("اختر صلاحية واحدة على الأقل لهذا الحساب.");
      return;
    }
    if (editingId) {
      updateMut.mutate({ id: editingId, displayName, username, roleKey, permissions, allowedCategoryIds });
    } else {
      if (password.length < 6) {
        toast.error("كلمة المرور يجب ألا تقل عن 6 أحرف.");
        return;
      }
      createMut.mutate({ displayName, username, password, roleKey, permissions, allowedCategoryIds, mustChangePassword });
    }
  };

  const startEdit = (item: NonNullable<typeof staffQuery.data>["items"][number]) => {
    setEditingId(item.id);
    setDisplayName(item.displayName);
    setUsername(item.username);
    setPassword("");
    const r = (["general_manager", "product_manager", "order_manager", "content_manager", "staff"].includes(item.roleKey) ? item.roleKey : "staff") as "general_manager" | "product_manager" | "order_manager" | "content_manager" | "staff";
    setRoleKey(r);
    setPermissions([...item.permissions]);
    setAllowedCategoryIds(Array.isArray((item as any).allowedCategoryIds) ? [...(item as any).allowedCategoryIds] : []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const items = staffQuery.data?.items ?? [];
  const summary = staffQuery.data?.summary ?? { total: 0, active: 0, disabled: 0 };
  const filteredItems = items.filter(item => {
    if (roleFilter !== "all" && item.roleKey !== roleFilter) return false;
    if (statusFilter === "active" && !item.isActive) return false;
    if (statusFilter === "disabled" && item.isActive) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!item.displayName.toLowerCase().includes(q) && !item.username.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="admin-content">
      <AdminHeading
        eyebrow="الأمن والحوكمة متعددة المستويات"
        title="إدارة المديرين والمشرفين والصلاحيات"
        text="تحكم كامل في حسابات الطاقم الإداري، وحدد لكل مدير أو موظف الصلاحيات الدقيقة المسموح له بها في الخادم."
        icon={ShieldCheck}
      />

      <div className="admin-stat-grid">
        <div className="admin-stat"><span><Users size={18} /></span><small>إجمالي الطاقم الإداري</small><strong>{summary.total}</strong><em>بخلاف حساب المالك الرئيسي</em></div>
        <div className="admin-stat"><span><Check size={18} /></span><small>الحسابات النشطة</small><strong style={{ color: "#870210" }}>{summary.active}</strong><em>يمكنهم الدخول حسب صلاحياتهم</em></div>
        <div className="admin-stat"><span><AlertTriangle size={18} /></span><small>الحسابات المعطلة</small><strong style={{ color: "#9b5346" }}>{summary.disabled}</strong><em>ممنوعون من الدخول فوراً</em></div>
        <div className="admin-stat"><span><ClipboardList size={18} /></span><small>عمليات مسجلة في التدقيق</small><strong>{logsQuery.data?.length ?? 0}</strong><em>أحدث السجلات الأمنية</em></div>
      </div>

      <section className="admin-form-card">
        <div className="form-card-heading">
          <span className="form-card-number">{editingId ? "✳" : "01"}</span>
          <div>
            <h2>{editingId ? "تعديل بيانات وصلاحيات المدير" : "إضافة مدير أو مشرف جديد"}</h2>
            <p>تُحفظ كلمات المرور مشفرة بخوارزمية scrypt في قاعدة البيانات ولا تُخزن كنص صريح أبداً.</p>
          </div>
          {editingId && <button type="button" className="small-button" onClick={resetForm}>إلغاء التعديل <X size={14} /></button>}
        </div>

        <form onSubmit={submitForm} className="admin-form">
          <div className="form-fields-grid">
            <label>
              الاسم الكامل للمدير / الموظف
              <input required minLength={2} maxLength={160} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="مثال: أحمد محمد - مدير الطلبات" />
            </label>
            <label>
              اسم المستخدم أو البريد الإلكتروني للدخول
              <input required minLength={3} maxLength={120} value={username} onChange={e => setUsername(e.target.value)} placeholder="مثال: ahmed_orders أو ahmed@store.com" dir="ltr" />
            </label>
            {!editingId && (
              <label>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>كلمة المرور المؤقتة (6 أحرف فأكثر)</span>
                  <button type="button" className="text-link" style={{ fontSize: "10px", padding: 0 }} onClick={() => generateStrongPass(setPassword)}>توليد ونسخ كلمة قوية</button>
                </span>
                <input required minLength={6} maxLength={128} type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="أدخل كلمة مرور أو اضغط توليد" dir="ltr" />
              </label>
            )}
            <label>
              الدور الوظيفي الأساسي
              <select value={roleKey} onChange={e => handleRoleChange(e.target.value as any)}>
                <option value="general_manager">مدير عام — {ROLE_DEFINITIONS.general_manager.description}</option>
                <option value="product_manager">مدير منتجات — {ROLE_DEFINITIONS.product_manager.description}</option>
                <option value="order_manager">مدير طلبات — {ROLE_DEFINITIONS.order_manager.description}</option>
                <option value="content_manager">مدير محتوى وعروض — {ROLE_DEFINITIONS.content_manager.description}</option>
                <option value="staff">موظف / مشرف — {ROLE_DEFINITIONS.staff.description}</option>
              </select>
            </label>
            {!editingId && (
              <label className="toggle-field field-wide">
                <input type="checkbox" checked={mustChangePassword} onChange={e => setMustChangePassword(e.target.checked)} />
                إلزام هذا المدير بتغيير كلمة المرور المؤقتة فور أول تسجيل دخول له
              </label>
            )}
          </div>

          <div style={{ padding: "12px 14px", borderRadius: "14px", border: "1.5px solid #cfe2d5", background: "#f3f9f5", display: "grid", gap: "8px" }}>
            <strong style={{ fontSize: "12px", color: "#870210" }}>⚡ قوالب صلاحيات سريعة جاهزة (اختَر المهمة بنقرة واحدة):</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button type="button" className="small-button" onClick={() => { setRoleKey("staff"); setPermissions(["products.view", "products.add"]); toast.info("تم ضبط الصلاحيات: إضافة منتجات فقط (ممنوع التعديل والحذف)"); }}>
                ➕ إضافة منتجات فقط (بدون حذف أو تعديل)
              </button>
              <button type="button" className="small-button" onClick={() => { setRoleKey("product_manager"); setPermissions(["products.view", "products.add", "products.edit", "inventory.manage"]); toast.info("تم ضبط الصلاحيات: إضافة وتعديل منتجات وأسعار (ممنوع الحذف النهائي)"); }}>
                ✏️ إضافة وتعديل المنتجات والأسعار (ممنوع الحذف)
              </button>
              <button type="button" className="small-button" onClick={() => { setRoleKey("order_manager"); setPermissions(["overview.view", "orders.view", "orders.manage", "customers.view", "chats.manage"]); toast.info("تم ضبط الصلاحيات: إدارة الطلبات والفواتير والرد على الزبائن"); }}>
                📦 مسؤول طلبات وتواصل مع الزبائن فقط
              </button>
              <button type="button" className="small-button" onClick={() => { setRoleKey("general_manager"); setPermissions(actorIsOwner ? [...PERMISSION_KEYS] : [...actorPermissions]); toast.info("تم تحديد كامل الصلاحيات"); }}>
                👑 مدير شامل بجميع الصلاحيات
              </button>
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "14px", border: "1.5px solid #d8e5dc", background: "#ffffff", display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <strong style={{ fontSize: "12.5px", color: "#870210", display: "block" }}>📂 تخصيص الأقسام المسموح لهذا المشرف بالتحكم بها:</strong>
                <small style={{ color: "#5b7063", fontSize: "11px" }}>
                  {allowedCategoryIds.length === 0 ? "✅ مسموح له بإدارة جميع أقسام المتجر (اضغط على أي قسم بالأسفل إذا أردت حصره في أقسام معينة فقط مثل الشاورما أو العصائر)." : ("🔒 مقيّد بإدارة (" + allowedCategoryIds.length + ") قسم محدد فقط — لن يتمكن من إضافة أو تعديل منتجات خارجها.")}
                </small>
              </div>
              {allowedCategoryIds.length > 0 && (
                <button type="button" className="small-button selected" onClick={() => setAllowedCategoryIds([])}>إتاحة كل الأقسام</button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {(catsQuery.data ?? []).map(cat => {
                const isSelected = allowedCategoryIds.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "99px",
                      border: isSelected ? "2px solid #870210" : "1px solid #d4e0d8",
                      background: isSelected ? "#fceee9" : "#f8faf9",
                      fontWeight: 800,
                      fontSize: "12px",
                      color: "#153b29",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setAllowedCategoryIds(curr => curr.includes(cat.id) ? curr.filter(id => id !== cat.id) : [...curr, cat.id])}
                      style={{ width: "14px", minHeight: "14px", accentColor: "#870210" }}
                    />
                    <span>{cat.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ padding: "14px", borderRadius: "14px", border: "1px solid #e2ebe4", background: "#f9fbf8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
              <strong style={{ fontSize: "12px", color: "#870210" }}>تخصيص الصلاحيات الدقيقة ({permissions.length} محددة)</strong>
              <div style={{ display: "flex", gap: "6px" }}>
                <button type="button" className="small-button" onClick={() => setPermissions(actorIsOwner ? [...PERMISSION_KEYS] : [...actorPermissions])}>تحديد الكل المسموح</button>
                <button type="button" className="small-button" onClick={() => handleRoleChange(roleKey)}>إعادة الافتراضي للدور</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "8px" }}>
              {PERMISSION_KEYS.map(perm => {
                const meta = PERMISSION_LABELS[perm];
                const checked = permissions.includes(perm);
                const disabled = !actorIsOwner && !actorPermissions.includes(perm);
                return (
                  <label
                    key={perm}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      border: checked ? "1.5px solid #870210" : "1px solid #e1e8e2",
                      background: checked ? "#eef6f0" : "#ffffff",
                      opacity: disabled ? 0.5 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePermission(perm)} style={{ width: "15px", minHeight: "15px", accentColor: "#870210" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#1c3b2b" }}>{meta.label}</span>
                      <small style={{ fontSize: "9px", color: meta.sensitive ? "#9b5346" : "#78847b" }}>{meta.group}{meta.sensitive ? " · صلاحية حساسة" : ""}</small>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-submit-row">
            <button type="submit" className="button button-primary" disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? <LoaderCircle size={16} className="spin" /> : editingId ? <Save size={16} /> : <Plus size={16} />}
              {editingId ? "حفظ تعديلات المدير والصلاحيات" : "إضافة المدير وتفعيل صلاحياته"}
            </button>
          </div>
        </form>
      </section>

      <div className="admin-section-heading">
        <div><h2>قائمة المديرين والمشرفين</h2><p>ابحث أو صفِّ حسب الدور والحالة، أو تحكم في الحسابات النشطة.</p></div>
        <span className="count-chip">{filteredItems.length}</span>
      </div>

      <div className="filter-bar" style={{ marginBottom: "14px" }}>
        <label className="filter-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو اسم المستخدم..." /></label>
        <label className="filter-select">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">كل الأدوار</option>
            <option value="general_manager">مدير عام</option>
            <option value="product_manager">مدير منتجات</option>
            <option value="order_manager">مدير طلبات</option>
            <option value="content_manager">مدير محتوى وعروض</option>
            <option value="staff">موظف / مشرف</option>
          </select>
        </label>
        <label className="filter-select">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="all">كل الحالات</option>
            <option value="active">نشط فقط</option>
            <option value="disabled">معطل فقط</option>
          </select>
        </label>
      </div>

      {staffQuery.isLoading ? <AdminLoading /> : staffQuery.error ? <AdminError message={staffQuery.error.message} retry={() => void staffQuery.refetch()} /> : !filteredItems.length ? (
        <AdminEmpty title="لا توجد حسابات إدارية مطابقة" text="أضف أول مدير أو موظف من النموذج أعلاه ليظهر هنا." />
      ) : (
        <div className="entity-list">
          {filteredItems.map(item => {
            const isSelf = Boolean(actorStaffId && actorStaffId === item.id);
            return (
              <article className="admin-order-card" key={item.id} style={{ borderLeft: item.isActive ? "4px solid #870210" : "4px solid #b95653" }}>
                <div className="admin-order-top">
                  <div>
                    <strong style={{ fontSize: "14px", color: "#173c2a" }}>{item.displayName} {isSelf && <span className="default-tag">حسابك</span>}</strong>
                    <small dir="ltr" style={{ fontWeight: 700, color: "#870210" }}>@{item.username}</small>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <span className="status-pill status-ready">{item.roleLabel}</span>
                    <span className={"visibility-tag " + (item.isActive ? "visible" : "hidden")}>{item.isActive ? "نشط" : "معطل"}</span>
                    {item.mustChangePassword && <span className="status-pill status-new">تغيير كلمة المرور مطلوب</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", margin: "10px 0" }}>
                  {item.permissions.map(p => (
                    <span key={p} style={{ padding: "3px 8px", borderRadius: "6px", background: "#f1f6f2", color: "#29523c", fontSize: "10px", fontWeight: 600 }}>
                      {PERMISSION_LABELS[p]?.label || p}
                    </span>
                  ))}
                  {Array.isArray((item as any).allowedCategoryIds) && (item as any).allowedCategoryIds.length > 0 ? (
                    <span style={{ padding: "3px 9px", borderRadius: "6px", background: "#fff4d9", color: "#8a5a00", fontSize: "10.5px", fontWeight: 800, border: "1px solid #efd595" }}>
                      🔒 مخصص للأقسام: {(item as any).allowedCategoryIds.map((cid: number) => (catsQuery.data ?? []).find(c => c.id === cid)?.name || ("#" + cid)).join("، ")}
                    </span>
                  ) : (
                    <span style={{ padding: "3px 9px", borderRadius: "6px", background: "#e8f4ec", color: "#870210", fontSize: "10px", fontWeight: 700 }}>
                      📂 كل الأقسام المسموحة
                    </span>
                  )}
                </div>
                <div className="admin-order-customer" style={{ marginTop: "6px", paddingBottom: "8px" }}>
                  <span>تاريخ الإنشاء: {new Date(item.createdAt).toLocaleDateString("ar-YE")}</span>
                  <span>آخر دخول: {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString("ar-YE") : "لم يسجل الدخول بعد"}</span>
                  {item.createdBy && <span>أُنشئ بواسطة: {item.createdBy}</span>}
                </div>
                {!isSelf && (
                  <div className="entity-actions" style={{ justifyContent: "flex-start", paddingTop: "8px", borderTop: "1px solid #eef1ec" }}>
                    <button type="button" className="small-button" onClick={() => startEdit(item)}>تعديل الصلاحيات</button>
                    <button type="button" className="small-button" onClick={() => { setResetTarget({ id: item.id, name: item.displayName }); setResetNewPass(""); setResetMustChange(true); }}>إعادة تعيين كلمة المرور</button>
                    <button
                      type="button"
                      className={"small-button " + (item.isActive ? "danger-soft" : "selected")}
                      onClick={() => {
                        if (item.isActive && !window.confirm("هل أنت متأكد من تعطيل حساب «" + item.displayName + "» وإخراجه فوراً من النظام؟")) return;
                        statusMut.mutate({ id: item.id, isActive: !item.isActive });
                      }}
                    >
                      {item.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                    </button>
                    {actorIsOwner && (
                      <button type="button" className="small-button danger-soft" onClick={() => setDeleteTarget({ id: item.id, name: item.displayName })}>
                        حذف نهائي
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {resetTarget && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setResetTarget(null); }}>
          <section className="checkout-modal" style={{ maxWidth: "440px" }}>
            <div className="modal-heading">
              <div><span className="eyebrow">أمان الحساب</span><h2>إعادة تعيين كلمة مرور: {resetTarget.name}</h2></div>
              <button type="button" className="icon-button" onClick={() => setResetTarget(null)}><X size={18} /></button>
            </div>
            <form
              className="form-stack"
              onSubmit={e => {
                e.preventDefault();
                if (resetNewPass.length < 6) { toast.error("كلمة المرور يجب ألا تقل عن 6 أحرف."); return; }
                resetPassMut.mutate({ id: resetTarget.id, newPassword: resetNewPass, mustChangePassword: resetMustChange });
              }}
            >
              <label>
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>كلمة المرور الجديدة</span>
                  <button type="button" className="text-link" style={{ fontSize: "10px", padding: 0 }} onClick={() => generateStrongPass(setResetNewPass)}>توليد ونسخ كلمة قوية</button>
                </span>
                <input required minLength={6} type="text" value={resetNewPass} onChange={e => setResetNewPass(e.target.value)} placeholder="أدخل كلمة المرور الجديدة" dir="ltr" />
              </label>
              <label className="toggle-field">
                <input type="checkbox" checked={resetMustChange} onChange={e => setResetMustChange(e.target.checked)} />
                إلزام المدير بتغييرها عند أول دخول قادم
              </label>
              <div className="modal-footer">
                <button type="button" className="button button-quiet" onClick={() => setResetTarget(null)}>إلغاء</button>
                <button type="submit" className="button button-primary" disabled={resetPassMut.isPending}>حفظ كلمة المرور</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <section className="checkout-modal" style={{ maxWidth: "420px" }}>
            <div className="modal-heading">
              <div><span className="eyebrow">تأكيد عملية حساسة</span><h2>حذف الحساب الإداري</h2></div>
              <button type="button" className="icon-button" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "12px", lineHeight: 1.8, color: "#4e5e53" }}>
              هل أنت متأكد من حذف حساب <strong>«{deleteTarget.name}»</strong> نهائياً؟ سيتم إبطال جلسته فوراً مع الحفاظ الكامل على سجلات الطلبات والعمليات السابقة المرتبطة به.
            </p>
            <div className="modal-footer">
              <button type="button" className="button button-quiet" onClick={() => setDeleteTarget(null)}>تراجع</button>
              <button type="button" className="button button-primary" style={{ background: "#9b5346" }} disabled={deleteMut.isPending} onClick={() => deleteMut.mutate({ id: deleteTarget.id })}>
                تأكيد الحذف النهائي
              </button>
            </div>
          </section>
        </div>
      )}

            <div className="admin-section-heading" style={{ marginTop: "32px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2>📋 سجل الرقابة الشامل لنشاط المشرفين (باللغة العربية)</h2>
          <p>يعرض بالتفصيل ماذا فعل كل أدمن، وأي قسم دخله وشاهده، وماذا أضاف أو عدّل أو حذف مع الوقت والتاريخ.</p>
        </div>
        <select
          value={logActorFilter}
          onChange={e => setLogActorFilter(e.target.value)}
          style={{ minHeight: "36px", padding: "0 12px", borderRadius: "10px", border: "1px solid #cfe0d4", background: "#ffffff", color: "#870210", fontSize: "12px", fontWeight: 700 }}
        >
          <option value="all">👤 عرض نشاط جميع الإداريين ({logsQuery.data?.length ?? 0})</option>
          {Array.from(new Set((logsQuery.data ?? []).map(l => l.actorName))).map(name => (
            <option key={name} value={name}>👤 نشاط: {name}</option>
          ))}
        </select>
      </div>
      {!logsQuery.data?.length ? (
        <AdminEmpty title="لا توجد سجلات نشاط بعد" text="ستظهر هنا جميع تحركات وعمليات المشرفين باللغة العربية فور حدوثها." />
      ) : (
        <div style={{ display: "grid", gap: "8px", maxHeight: "480px", overflowY: "auto", padding: "4px" }}>
          {logsQuery.data
            .filter(log => logActorFilter === "all" || log.actorName === logActorFilter)
            .map(log => {
              const roleMapAr: Record<string, string> = {
                owner: "مالك المتجر",
                general_manager: "مدير عام",
                product_manager: "مدير منتجات",
                order_manager: "مدير طلبات",
                content_manager: "مدير محتوى وعروض",
                staff: "موظف / مشرف",
                unauthenticated: "محاولة دخول غير مصرحة",
              };
              const actionMapAr: Record<string, string> = {
                LOGIN_SUCCESS: "🔑 تسجيل دخول للوحة التحكم",
                LOGIN_FAILED_OWNER: "⚠️ محاولة دخول فاشلة لحساب المالك",
                LOGIN_FAILED_STAFF: "⚠️ محاولة دخول فاشلة لحساب مشرف",
                LOGIN_BLOCKED_DISABLED: "🚫 محاولة دخول لحساب معطّل",
                CREATE_STAFF: "👤 إضافة مدير / مشرف جديد",
                UPDATE_STAFF: "✏️ تعديل بيانات وصلاحيات مدير",
                ACTIVATE_STAFF: "✅ تفعيل حساب مدير",
                DISABLE_STAFF: "⏸️ تعطيل حساب مدير وإخراجه",
                RESET_STAFF_PASSWORD: "🔐 تغيير كلمة مرور مدير",
                DELETE_STAFF: "🗑️ حذف حساب مدير نهائياً",
                CHANGE_OWN_PASSWORD: "🔐 تحديث كلمة المرور الشخصية",
              };
              const roleAr = roleMapAr[log.actorRole] || log.actorRole || "مشرف";
              const actionAr = actionMapAr[log.action] || log.action;
              let detailsAr = String(log.details || "");
              for (const k of PERMISSION_KEYS) {
                if (detailsAr.includes(k)) {
                  detailsAr = detailsAr.split(k).join(PERMISSION_LABELS[k]?.label || k);
                }
              }
              const isView = actionAr.includes("تصفح") || actionAr.includes("👁️");
              const isDanger = actionAr.includes("حذف") || actionAr.includes("فاشلة") || actionAr.includes("تعطيل");
              return (
                <div
                  key={log.id}
                  style={{
                    padding: "11px 14px",
                    borderRadius: "13px",
                    background: isDanger ? "#fff9f8" : isView ? "#f8fbf9" : "#ffffff",
                    border: isDanger ? "1px solid #f2d0c9" : isView ? "1px solid #dcebe2" : "1px solid #cfe2d5",
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "13px", color: "#123b29" }}>👤 {log.actorName}</strong>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: "#e8f3ec", color: "#870210" }}>
                        {roleAr}
                      </span>
                      <span style={{ fontSize: "11.5px", fontWeight: 800, padding: "3px 10px", borderRadius: "8px", background: isDanger ? "#fde8e4" : isView ? "#eef6f1" : "#fff7e0", color: isDanger ? "#9b3b2e" : isView ? "#1d5c3f" : "#8a5a00" }}>
                        {actionAr}
                      </span>
                    </div>
                    <small style={{ color: "#64746b", fontSize: "11px", fontWeight: 600 }}>
                      🕒 {new Date(log.createdAt).toLocaleString("ar-YE")}
                    </small>
                  </div>
                  <div style={{ fontSize: "12px", color: "#2c4637", lineHeight: 1.6, paddingTop: "2px" }}>
                    {log.targetName ? <strong style={{ color: "#870210" }}>[{log.targetName}] </strong> : null}
                    <span>{detailsAr || "تم تنفيذ العملية بنجاح"}</span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
// --- STAFF_PANEL_END ---

function canAccessSection(section: Section, isOwner: boolean, perms: PermissionKey[]): boolean {
  if (isOwner) return true;
  const has = (p: PermissionKey) => perms.includes(p);
  if (section === "overview") return has("overview.view");
  if (section === "products") return has("products.view") || has("products.add") || has("products.edit") || has("products.delete") || has("products.manage") || has("inventory.manage");
  if (section === "categories") return has("categories.manage");
  if (section === "delivery") return has("settings.manage") || has("orders.manage");
  if (section === "banners") return has("banners.manage");
  if (section === "offers") return has("offers.manage");
  if (section === "orders") return has("orders.view") || has("orders.manage");
  if (section === "chats") return has("chats.manage");
  if (section === "users") return has("customers.view");
  if (section === "staff") return has("staff.manage");
  if (section === "settings") return has("settings.manage");
  return false;
}

function AdminPanel({ section, isOwner, permissions, allowedCategoryIds, staffId }: { section: Section; isOwner: boolean; permissions: PermissionKey[]; allowedCategoryIds: number[]; staffId: number | null }) {
  if (section === "chats") return <ChatsPanel />;
  if (section === "products") return <ProductsPanel isOwner={isOwner} permissions={permissions} allowedCategoryIds={allowedCategoryIds} />;
  if (section === "categories") return <CategoriesPanel />;
  if (section === "delivery") return <DeliveryZonesPanel />;
  if (section === "banners") return <BannersPanel />;
  if (section === "offers") return <OffersPanel />;
  if (section === "orders") return <OrdersPanel />;
  if (section === "users") return <UsersPanel />;
  if (section === "staff") return <StaffManagementPanel actorIsOwner={isOwner} actorPermissions={permissions} actorStaffId={staffId} />;
  if (section === "settings") return <SettingsPanel />;
  return <Overview />;
}

export default function Admin() {
  const [location, navigate] = useLocation();
  const auth = useAuth();
  const utils = trpc.useUtils();
  const access = trpc.commerce.access.useQuery(undefined, { retry: 1, refetchOnWindowFocus: false });
  useAdminGlobalPushSync(Boolean(access.data?.isAdmin));
  const logout = async () => { try { await auth.logout(); } finally { await utils.commerce.access.invalidate(); navigate("/admin"); } };
  const onLoginSuccess = async () => {
    await Promise.all([auth.refresh(), utils.commerce.access.invalidate()]);
  };

  if (auth.loading || access.isLoading) return <main className="admin-gate" dir="rtl"><AdminLoading /></main>;
  if (auth.error && !auth.user) return <AdminLoginGate reason="login" onSuccess={() => void onLoginSuccess()} />;
  if (!auth.user) return <AdminLoginGate reason="login" onSuccess={() => void onLoginSuccess()} />;
  if (auth.user.suspended || access.data?.isSuspended) return <AdminLoginGate reason="suspended" onLogout={logout} />;
  if (!access.data?.isAdmin) return <AdminLoginGate reason="forbidden" onLogout={logout} />;

  const isOwner = Boolean(access.data.isOwner);
  const permissions = (access.data.permissions ?? []) as PermissionKey[];
  const allowedCategoryIds = ((access.data as any).allowedCategoryIds ?? []) as number[];
  const staffId = access.data.staffId ?? null;
  const roleLabel = isOwner ? "مالك المتجر" : (ROLE_DEFINITIONS[access.data.adminRole as AdminRoleKey]?.label || "مدير");

  if (access.data.mustChangePassword) {
    return <ForcePasswordChangeGate displayName={auth.user.name || "المدير"} onSuccess={() => void onLoginSuccess()} onLogout={() => void logout()} />;
  }

  const allowedSections = sections.filter(item => canAccessSection(item.id, isOwner, permissions));
  const requestedSection = location.split("/")[2] as Section | undefined;
  const activeSection = allowedSections.some(item => item.id === requestedSection)
    ? requestedSection!
    : (allowedSections[0]?.id ?? "overview");

  return (
    <div className="admin-app" dir="rtl">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand"><span className="brand-mark has-brand-image"><img src="/app-icon-192-v4.png" alt="شهيزو" /></span><span><strong style={{ fontFamily: "inherit", letterSpacing: "0.02em" }}>شهيزو · SHAHEZO</strong><small>لوحة إدارة البوفية</small></span></Link>
        <div className="admin-profile">
          <span className="profile-initial">{(auth.user.name || "O").slice(0, 1)}</span>
          <span><strong>{auth.user.name || "مالك المتجر"}</strong><small>{roleLabel}</small></span>
          <span className="online-dot" />
        </div>
        <nav className="admin-nav">
          {allowedSections.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={activeSection === item.id ? "active" : ""} onClick={() => { document.body.classList.remove("admin-menu-open"); navigate(item.id === "overview" ? "/admin" : "/admin/" + item.id); }}>
                <Icon size={18} /><span>{item.label}</span>{activeSection === item.id && <i />}
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" className="back-store"><ShoppingBag size={16} />عرض المتجر<ArrowLeft size={14} /></Link>
          <button className="logout-admin" onClick={() => void logout()}><LogOut size={16} />تسجيل الخروج</button>
          <small>نظام صلاحيات متعدد المستويات</small>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => document.body.classList.toggle("admin-menu-open")}><ChevronDown size={18} />القائمة</button>
          <span className="admin-breadcrumb">شهيزو – SHAHEZO <span>/</span> {allowedSections.find(item => item.id === activeSection)?.label}</span>
          <Link className="small-button" href="/">فتح المتجر<ArrowLeft size={14} /></Link>
        </header>
        <AdminPanel section={activeSection} isOwner={isOwner} permissions={permissions} allowedCategoryIds={allowedCategoryIds} staffId={staffId} />
      </main>
      <div className="admin-mobile-backdrop" onClick={() => document.body.classList.remove("admin-menu-open")} />
    </div>
  );
}
