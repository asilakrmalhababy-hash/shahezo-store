import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(req: Request): CookieOptions {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return { httpOnly: true, path: "/", sameSite: isSecure ? "none" : "lax", secure: isSecure };
}
