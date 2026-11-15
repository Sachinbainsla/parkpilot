import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
function csv(value: unknown) { const v = String(value ?? ""); return '"' + (/^[=+@-]/.test(v) ? "'" : "") + v.replaceAll('"','""') + '"'; }
export async function GET(request: Request) {
 try {
 const user = await requireApiUser(); if (!["OWNER","MANAGER"].includes(user.role)) return new Response("Forbidden", {status:403});
 const url = new URL(request.url), start = new Date(url.searchParams.get("start") || new Date(Date.now()-30*86400000).toISOString()), end = new Date(url.searchParams.get("end") || new Date().toISOString());
 if (!Number.isFinite(+start) || !Number.isFinite(+end) || end < start || +end - +start > 366*86400000) return new Response("Choose a valid range of up to 366 days.",{status:400});
 const scope = { organizationId: user.organizationId };
 const sessions = await db.parkingSession.findMany({ where: { ...scope, entryAt: { lte: end }, OR: [{exitAt:null},{exitAt:{gte:start}}] }, include: { vehicle:true, space:true }, take: 10000 });
 const payments = await db.payment.findMany({ where: { ...scope, createdAt:{gte:start,lte:end} }, include: { invoice:true }, take:10000 });
 const rows: unknown[][] = [["FICTIONAL DEMO DATA - timestamps UTC"],["Type","Reference","Space / Invoice","Entry / Date UTC","Exit UTC","Amount INR"], ...sessions.map(s => ["Parking",s.vehicle.plate,s.space.number,s.entryAt.toISOString(),s.exitAt?.toISOString() || "Active", ""]), ...payments.map(p => [p.method,p.reference,p.invoice.number,p.createdAt.toISOString(),"",p.amountPaise/100])];
 await db.auditLog.create({ data: { ...scope, actorId:user.id, action:"EXPORT", entityId:"reports", details:{start,end} } });
 return new Response(rows.map(row=>row.map(csv).join(",")).join("\r\n"), {headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=parkpilot-report.csv","Cache-Control":"private, no-store"}});
 } catch { return new Response("Export unavailable",{status:400}); }
}
