import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export async function GET(_: Request, { params }: { params: Promise<{id: string}> }) {
 try {
 const user = await requireApiUser(); if (!["OWNER","MANAGER","CUSTOMER"].includes(user.role)) return new Response("Forbidden", {status:403});
 const { id } = await params;
 const payment = await db.payment.findFirst({ where: { id, organizationId: user.organizationId, ...(user.role === "CUSTOMER" ? { invoice: { customerId: user.customerId ?? "NONE" } } : {}) }, include: { invoice: true } });
 if (!payment) return new Response("Not found", {status:404});
 const doc = await PDFDocument.create(); const page = doc.addPage([595, 500]); const font = await doc.embedFont(StandardFonts.Helvetica);
 const lines = ["ParkPilot | Payment receipt", "FICTIONAL DEMO - NOT A TAX INVOICE", "Receipt: " + payment.id, "Invoice: " + payment.invoice.number, "Amount: INR " + (payment.amountPaise/100).toFixed(2), "Method: " + payment.method, "Date (UTC): " + payment.createdAt.toISOString(), payment.method === "SIMULATED" ? "SIMULATED PAYMENT. No real money was charged." : "Manually recorded payment."];
 lines.forEach((text,i) => page.drawText(text, { x: 45, y: 445-i*38, size: i===0 ? 22 : 12, font, color: rgb(0.05,0.25,0.22) }));
 return new Response(Buffer.from(await doc.save()), { headers: { "Content-Type":"application/pdf", "Content-Disposition": `attachment; filename="receipt-${id}.pdf"`, "Cache-Control":"private, no-store" } });
 } catch { return new Response("Receipt unavailable", {status:400}); }
}
