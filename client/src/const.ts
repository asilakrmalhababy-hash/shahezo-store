export { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export async function submitAdminCredentials(username: string, password: string): Promise<{ ok: boolean; error?: string; mustChangePassword?: boolean }> {
  try {
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || "فشل تسجيل الدخول. تحقق من البيانات." };
    }
    return { ok: true, mustChangePassword: Boolean(data.mustChangePassword) };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت." };
  }
}

export const startLogin = () => {
  if (typeof window !== "undefined" && !window.location.pathname.toLowerCase().startsWith("/admin")) {
    window.location.href = "/admin";
  }
};
