export type OwnerIdentity = {
  email: string | null | undefined;
  role: "user" | "admin";
  suspended: boolean;
};

export function isConfiguredOwnerEmail(
  email: string | null | undefined,
  configuredOwnerEmail: string | null | undefined,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedOwnerEmail = configuredOwnerEmail?.trim().toLowerCase();
  return Boolean(normalizedEmail && normalizedOwnerEmail && normalizedEmail === normalizedOwnerEmail);
}

export function isConfiguredOwnerIdentity(
  openId: string | null | undefined,
  email: string | null | undefined,
  configuredOwnerOpenId: string | null | undefined,
  configuredOwnerEmail: string | null | undefined,
): boolean {
  const normalizedOpenId = openId?.trim();
  const normalizedOwnerOpenId = configuredOwnerOpenId?.trim();
  return Boolean(
    (normalizedOpenId && normalizedOwnerOpenId && normalizedOpenId === normalizedOwnerOpenId)
    || isConfiguredOwnerEmail(email, configuredOwnerEmail),
  );
}

export function shouldPromoteConfiguredOwner(
  user: OwnerIdentity,
  configuredOwnerEmail: string | null | undefined,
): boolean {
  return isConfiguredOwnerEmail(user.email, configuredOwnerEmail)
    && (user.role !== "admin" || user.suspended);
}
