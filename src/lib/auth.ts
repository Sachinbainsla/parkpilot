import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { appOrigin } from "./origin";
import { redirect } from "next/navigation";
export function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); return salt + ":" + scryptSync(password, salt, 64).toString("hex"); }
export function verifyPassword(password: string, hash: string) { const [salt, key] = hash.split(":"); if (!salt || !key) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(key, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); }
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get("parkpilot_session")?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({ where: { id: digest(token) }, include: { user: true } });
  return session && session.expiresAt > new Date() && !session.user.disabled ? session.user : null;
}
export async function requireUser() { const user = await currentUser(); if (!user) redirect("/login"); return user; }
export async function requireApiUser() { const user = await currentUser(); if (!user) throw new Error("UNAUTHENTICATED"); return user; }
export async function checkOrigin() { const h = await headers(); if (h.get("origin") !== appOrigin()) throw new Error("Invalid request origin"); }
export async function limit(key: string, maximum = 30) {
  const now = new Date();
  const rows = await db.$queryRaw<{ count: number }[]>`INSERT INTO "RateLimit" (key, count, "resetsAt") VALUES (${key}, 1, ${new Date(now.getTime() + 600000)}) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateLimit"."resetsAt" < ${now} THEN 1 ELSE "RateLimit".count + 1 END, "resetsAt" = CASE WHEN "RateLimit"."resetsAt" < ${now} THEN ${new Date(now.getTime() + 600000)} ELSE "RateLimit"."resetsAt" END RETURNING count`;
  if (rows[0].count > maximum) throw new Error("Too many attempts. Try again in 10 minutes.");
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex"); const expiresAt = new Date(Date.now() + 8 * 3600000);
  await db.authSession.create({ data: { id: digest(token), userId, expiresAt } });
  (await cookies()).set("parkpilot_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", expires: expiresAt, path: "/" });
}
export async function logout() { const jar = await cookies(); const token = jar.get("parkpilot_session")?.value; if (token) await db.authSession.deleteMany({ where: { id: digest(token) } }); jar.delete("parkpilot_session"); }
