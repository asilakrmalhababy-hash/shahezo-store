import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { clearPendingOrderIdempotencyKey, getPendingOrderIdempotencyKey } from "./CustomerContext";

const storageKey = "shahezo-pending-order-idempotency-v1";
let values: Map<string, string>;

function installBrowserStorage() {
  values = new Map();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { crypto: webcrypto, localStorage } as unknown as Window,
  });
}

describe("guest order idempotency storage", () => {
  beforeEach(installBrowserStorage);
  afterEach(() => { Reflect.deleteProperty(globalThis, "window"); });

  it("reuses a secure key for the same checkout and separates different checkout payloads", () => {
    const first = getPendingOrderIdempotencyKey("cart-a|phone-a|address-a");
    expect(getPendingOrderIdempotencyKey("cart-a|phone-a|address-a")).toBe(first);
    const second = getPendingOrderIdempotencyKey("cart-b|phone-b|address-b");
    expect(second).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("persists only hashed checkout scopes, not the entered checkout data", () => {
    getPendingOrderIdempotencyKey("phone=777123456;address=home");
    const serialized = values.get(storageKey) ?? "";
    expect(serialized).not.toContain("777123456");
    expect(serialized).not.toContain("address=home");
    const scopes = Object.keys(JSON.parse(serialized) as Record<string, string>);
    expect(scopes).toHaveLength(1);
    expect(scopes[0]).toMatch(/^[0-9a-f]{16}$/);
  });

  it("removes the key after an order is confirmed", () => {
    const key = getPendingOrderIdempotencyKey("checkout-complete");
    clearPendingOrderIdempotencyKey(key);
    expect(values.has(storageKey)).toBe(false);
    expect(getPendingOrderIdempotencyKey("checkout-complete")).not.toBe(key);
  });
});
