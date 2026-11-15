import { NextResponse } from "next/server";
import { requireApiUser, checkOrigin, limit } from "@/lib/auth";
import { execute } from "@/lib/operations";
import { snapshot } from "@/lib/snapshot";
import { ZodError } from "zod";
export async function GET() {
 try { return NextResponse.json(await snapshot(await requireApiUser()), { headers: { "Cache-Control": "no-store" } }); }
 catch (e) { const anonymous = e instanceof Error && e.message === "UNAUTHENTICATED"; return NextResponse.json({ error: anonymous ? "Please sign in." : "Workspace unavailable. Check database connectivity." }, { status: anonymous ? 401 : 503 }); }
}
export async function POST(request: Request) {
 try { await checkOrigin(); const user = await requireApiUser(); await limit("action:" + user.id, 100); const text = await request.text(); if (Buffer.byteLength(text, "utf8") > 16384) return NextResponse.json({error:"Request too large"},{status:413}); const result = await execute(user, JSON.parse(text)); return NextResponse.json(result); }
 catch (e) {
 const message = e instanceof ZodError ? e.issues.map(i => i.message).join("; ") : e instanceof Error ? e.message : "Operation failed";
 const safe = message.includes("Prisma") || message.includes("Unique constraint") || message.includes("Record to") ? "Operation conflicted or record unavailable. Refresh and try again." : message;
 return NextResponse.json({ error: safe }, { status: message === "FORBIDDEN" ? 403 : message === "UNAUTHENTICATED" ? 401 : 400 });
 }
}
