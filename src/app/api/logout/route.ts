import { checkOrigin, logout } from "@/lib/auth";
export async function POST() { await checkOrigin(); await logout(); return Response.json({ ok: true }); }
