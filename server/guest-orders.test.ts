import { describe, expect, it } from "vitest";
import { hashGuestOrderKey, isValidGuestPhone, matchesGuestOrderKey } from "./guest-orders";

describe("guest-order access references", () => {
  it("accepts callable phone numbers with Arabic or international formatting", () => {
    expect(isValidGuestPhone("+967 771 234 567")).toBe(true);
    expect(isValidGuestPhone("٧٧١٢٣٤٥٦٧")).toBe(true);
    expect(isValidGuestPhone("not-a-phone")).toBe(false);
    expect(isValidGuestPhone("123+4567")).toBe(false);
    expect(isValidGuestPhone("12345")).toBe(false);
    expect(isValidGuestPhone("123456789012345678")).toBe(false);
  });

  it("stores a SHA-256 digest instead of the browser-held secret", () => {
    const secret = "b2fb67fa-0281-4d7a-8a40-29cf4ccf7a8f";
    const digest = hashGuestOrderKey(secret);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(secret);
    expect(matchesGuestOrderKey(secret, digest)).toBe(true);
  });

  it("supports legacy orders without exposing their phone or address", () => {
    const legacySecret = "f512b654-9d86-4d84-b02e-65e2fb912b7d";
    expect(matchesGuestOrderKey(legacySecret, legacySecret)).toBe(true);
    expect(matchesGuestOrderKey("a9a11cb1-bf79-43fc-88c4-98b010c58aa1", legacySecret)).toBe(false);
  });

  it("does not authorize a different secret", () => {
    const digest = hashGuestOrderKey("7f9ac865-e45c-4b61-9708-16f8b5768231");
    expect(matchesGuestOrderKey("b38ac61a-179e-4c6d-8ecf-2662577c9c0a", digest)).toBe(false);
  });
});
