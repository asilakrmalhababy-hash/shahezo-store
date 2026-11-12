export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID || "shahezo-store"; },
  get cookieSecret() { return process.env.MANUS_JWT_SECRET || process.env.JWT_SECRET || "shahezo-store-permanent-jwt-secret-key-2026-yemen"; },
  get databaseUrl() { return process.env.DATABASE_URL || ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL || ""; },
  get ownerOpenId() { return process.env.OWNER_OPEN_ID?.trim() || "admin-owner"; },
  get ownerEmail() { return process.env.OWNER_EMAIL?.trim().toLowerCase() || "admin@shahezo.store"; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL || ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY || ""; },
};
