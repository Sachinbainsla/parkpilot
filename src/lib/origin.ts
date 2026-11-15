export function appOrigin(env: Readonly<Record<string, string | undefined>> = process.env): string {
 if (env.APP_ORIGIN) return new URL(env.APP_ORIGIN).origin;
 const host = env.VERCEL_ENV === "preview" ? env.VERCEL_URL : env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
 if (host) return new URL("https://" + host).origin;
 if (env.NODE_ENV === "production") throw new Error("APP_ORIGIN is required for this production deployment.");
 return "http://localhost:3001";
}
