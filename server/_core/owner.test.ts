import { describe, expect, it } from "vitest";
import { isConfiguredOwnerEmail, isConfiguredOwnerIdentity, shouldPromoteConfiguredOwner } from "./owner";

describe("configured owner identity", () => {
  it("matches the configured email after trimming and case normalization", () => {
    expect(isConfiguredOwnerEmail("  Owner@Example.com ", "owner@example.com")).toBe(true);
  });

  it("does not match when the owner setting or account email is missing or different", () => {
    expect(isConfiguredOwnerEmail("owner@example.com", "")).toBe(false);
    expect(isConfiguredOwnerEmail(null, "owner@example.com")).toBe(false);
    expect(isConfiguredOwnerEmail("customer@example.com", "owner@example.com")).toBe(false);
  });

  it("accepts only the configured owner email or exact configured OpenID", () => {
    expect(isConfiguredOwnerIdentity("owner-id", "other@example.com", "owner-id", "owner@example.com")).toBe(true);
    expect(isConfiguredOwnerIdentity("other-id", " OWNER@example.com ", "owner-id", "owner@example.com")).toBe(true);
    expect(isConfiguredOwnerIdentity("other-id", "customer@example.com", "owner-id", "owner@example.com")).toBe(false);
    expect(isConfiguredOwnerIdentity("owner-id", "customer@example.com", "", "")).toBe(false);
  });

  it("promotes only a matching owner account that is not already active admin", () => {
    const owner = { email: "owner@example.com", role: "user" as const, suspended: false };
    expect(shouldPromoteConfiguredOwner(owner, "owner@example.com")).toBe(true);
    expect(shouldPromoteConfiguredOwner(owner, "other@example.com")).toBe(false);
    expect(shouldPromoteConfiguredOwner({ ...owner, role: "admin", suspended: false }, "owner@example.com")).toBe(false);
    expect(shouldPromoteConfiguredOwner({ ...owner, role: "admin", suspended: true }, "owner@example.com")).toBe(true);
  });
});
