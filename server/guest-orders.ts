import { createHash, timingSafeEqual } from "node:crypto";

export function normalizeYemeniPhone(value: string): string {
  const latinDigits = String(value || "")
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0));
  let digits = latinDigits.replace(/\D/g, "");
  if (digits.startsWith("00967") && digits.length >= 14) digits = digits.slice(5);
  else if (digits.startsWith("967") && digits.length >= 12) digits = digits.slice(3);
  else if (digits.startsWith("07") && digits.length === 10) digits = digits.slice(1);
  return digits;
}

export function isValidGuestPhone(value: string): boolean {
  const raw = String(value || "").trim();
  if (!raw || raw.indexOf("+") > 0) return false;
  const latinDigits = raw
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0));
  if (!/^\+?[\d\s().-]+$/.test(latinDigits)) return false;
  const clean = normalizeYemeniPhone(raw);
  return /^(77|73|78|71|70)\d{7}$/.test(clean);
}

export function hashGuestOrderKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function matchesGuestOrderKey(providedKey: string, storedKey: string): boolean {
  const digest = hashGuestOrderKey(providedKey);
  const digestMatches = constantTimeEqual(digest, storedKey);
  const legacyMatches = constantTimeEqual(providedKey, storedKey);
  return digestMatches || legacyMatches;
}
