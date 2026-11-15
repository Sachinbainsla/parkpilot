import { Prisma, User } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { balance, canEnter, normalizePlate, subscriptionStatus } from "./rules";
const id = z.string().min(1).max(100);
const plate = z.string().min(6).max(15).transform(normalizePlate).refine(v => /^[A-Z0-9]{6,12}$/.test(v), "Invalid vehicle plate");
export const commandSchema = z.discriminatedUnion("action", [
 z.object({ action: z.literal("checkin"), spaceId: id, plate, override: z.boolean().default(false), reason: z.string().max(500).optional() }),
 z.object({ action: z.literal("checkout"), sessionId: id }),
 z.object({ action: z.literal("move"), sessionId: id, spaceId: id }),
 z.object({ action: z.literal("reserve"), spaceId: id, customerId: id, plate, startAt: z.string().datetime(), endAt: z.string().datetime().optional() }),
 z.object({ action: z.literal("release"), reservationId: id }),
 z.object({ action: z.literal("suspend"), reservationId: id }),
 z.object({ action: z.literal("block"), spaceId: id, blocked: z.boolean() }),
 z.object({ action: z.literal("customer"), name: z.string().min(2).max(100), phone: z.string().regex(/^[6-9][0-9]{9}$/), email: z.union([z.string().email(), z.literal("")]), plate, consent: z.boolean().default(false) }),
 z.object({ action: z.literal("payment"), invoiceId: id, amountPaise: z.number().int().positive().max(100000000), method: z.enum(["CASH", "UPI", "BANK", "SIMULATED"]), reference: z.string().min(3).max(100), idempotencyKey: z.string().uuid() }),
 z.object({ action: z.literal("refund"), paymentId: id, amountPaise: z.number().int().positive(), reason: z.string().min(5).max(300), idempotencyKey: z.string().uuid() }),
 z.object({ action: z.literal("reminders") }),
 z.object({ action: z.literal("resolve"), violationId: id }),
 z.object({ action: z.literal("issue"), reason: z.string().min(5).max(500), spaceId: id }),
 z.object({ action: z.literal("waitlist"), customerId: id, vehicleId: id }),
 z.object({ action: z.literal("allocate"), waitlistId: id, spaceId: id }),
 z.object({ action: z.literal("renew"), subscriptionId: id, months: z.number().int().min(1).max(12) }),
 z.object({ action: z.literal("cancel"), subscriptionId: id, reason: z.string().min(5).max(300) }),
 z.object({ action: z.literal("tenant"), name: z.string().min(3).max(100), slug: z.string().regex(/^[a-z0-9-]{3,40}$/) }),
 z.object({ action: z.literal("settings"), name: z.string().min(3).max(100), branding: z.string().regex(/^#[a-fA-F0-9]{6}$/) }),
]);
type Tx = Prisma.TransactionClient;
const roles: Record<string, string[]> = {
 checkin: ["OWNER","MANAGER","GUARD"], checkout: ["OWNER","MANAGER","GUARD"], move: ["OWNER","MANAGER","GUARD"], resolve: ["OWNER","MANAGER","GUARD"],
 reserve: ["OWNER","MANAGER"], release: ["OWNER","MANAGER"], suspend: ["OWNER","MANAGER"], block: ["OWNER","MANAGER"], customer: ["OWNER","MANAGER"],
 payment: ["OWNER","MANAGER","CUSTOMER"], refund: ["OWNER"], reminders: ["OWNER","MANAGER"], issue: ["OWNER","MANAGER","GUARD","CUSTOMER"], waitlist: ["OWNER","MANAGER"], allocate: ["OWNER","MANAGER"], renew: ["OWNER","MANAGER"], cancel: ["OWNER","MANAGER"], tenant: ["SUPER_ADMIN"], settings: ["OWNER"],
};
async function notify(tx: Tx, organizationId: string, customerId: string | null, kind: string, message: string, hi: string, key: string) {
 for (const channel of ["IN_APP", "MOCK_EMAIL", "MOCK_SMS", "MOCK_WHATSAPP"]) await tx.notification.upsert({ where: { organizationId_dedupKey_channel: { organizationId, dedupKey: key, channel } }, create: { organizationId, customerId, kind, message, messageHi: hi, dedupKey: key, channel }, update: {} });
}
export async function execute(user: User, input: unknown) {
 const c = commandSchema.parse(input);
 if (!roles[c.action]?.includes(user.role)) throw new Error("FORBIDDEN");
 const organizationId = user.organizationId;
 const scope = { organizationId };
 return db.$transaction(async tx => {
  // All allocation and billing mutations for one tenant serialize across devices/processes.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
  const now = new Date();
  const reservationFor = (spaceId: string) => tx.reservation.findFirst({ where: { ...scope, spaceId, status: "ACTIVE", startAt: { lte: now }, OR: [{ endAt: null }, { endAt: { gt: now } }] } });
  let result: unknown = { ok: true };
  switch(c.action) {
   case "checkin": {
    const space = await tx.parkingSpace.findFirstOrThrow({ where: { id: c.spaceId, ...scope } });
    const vehicle = await tx.vehicle.findFirst({ where: { ...scope, plate: c.plate } });
    if (!vehicle) throw new Error("Register this vehicle under Customers before check-in.");
    const occupied = await tx.parkingSession.findFirst({ where: { ...scope, spaceId: space.id, exitAt: null } });
    const unauthorized = canEnter(space.blocked, !!occupied, await reservationFor(space.id), c.plate, c.override);
    if (c.override && (!c.reason || c.reason.trim().length < 5)) throw new Error("An incident reason of at least 5 characters is required.");
    if (await tx.parkingSession.findFirst({ where: { ...scope, vehicleId: vehicle.id, exitAt: null } })) throw new Error("This vehicle already has an active parking session.");
    result = await tx.parkingSession.create({ data: { ...scope, vehicleId: vehicle.id, spaceId: space.id, unauthorized } });
    if (unauthorized) {
     await tx.violation.create({ data: { ...scope, spaceId: space.id, plate: c.plate, reason: c.reason! } });
     await notify(tx, organizationId, vehicle.customerId, "UNAUTHORIZED", `Unauthorized parking at ${space.number}: ${c.plate}`, "अनधिकृत पार्किंग दर्ज की गई।", "incident:" + (result as {id: string}).id);
    }
    break;
   }
   case "checkout": {
    const session = await tx.parkingSession.findFirstOrThrow({ where: { id: c.sessionId, ...scope, exitAt: null } });
    await tx.parkingSession.update({ where: { id: session.id }, data: { exitAt: now } }); break;
   }
   case "move": {
    const session = await tx.parkingSession.findFirstOrThrow({ where: { id: c.sessionId, ...scope, exitAt: null }, include: { vehicle: true } });
    const space = await tx.parkingSpace.findFirstOrThrow({ where: { id: c.spaceId, ...scope } });
    canEnter(space.blocked, !!await tx.parkingSession.findFirst({ where: { ...scope, spaceId: space.id, exitAt: null } }), await reservationFor(space.id), session.vehicle.plate, false);
    await tx.parkingSession.update({ where: { id: session.id }, data: { exitAt: now } });
    result = await tx.parkingSession.create({ data: { ...scope, spaceId: space.id, vehicleId: session.vehicleId, entryAt: now } }); break;
   }
   case "reserve": {
    const space = await tx.parkingSpace.findFirstOrThrow({ where: { ...scope, id: c.spaceId } });
    await tx.customer.findFirstOrThrow({ where: { ...scope, id: c.customerId } });
    if (!await tx.vehicle.findFirst({ where: { ...scope, customerId: c.customerId, plate: c.plate } })) throw new Error("Vehicle must belong to selected customer.");
    const startAt = new Date(c.startAt), endAt = c.endAt ? new Date(c.endAt) : null;
    if (endAt && endAt <= startAt) throw new Error("End date must follow start date.");
    if (space.blocked || await tx.parkingSession.findFirst({ where: { ...scope, spaceId: space.id, exitAt: null } })) throw new Error("Space must be vacant and unblocked before allocation.");
    const conflict = await tx.reservation.findFirst({ where: { ...scope, spaceId: space.id, status: { in: ["ACTIVE","SUSPENDED"] }, startAt: { lt: endAt ?? new Date("9999-01-01") }, OR: [{ endAt: null }, { endAt: { gt: startAt } }] } });
    if (conflict) throw new Error("Reservation dates conflict with an existing allocation.");
    result = await tx.reservation.create({ data: { ...scope, spaceId: space.id, customerId: c.customerId, authorizedPlates: [c.plate], startAt, endAt } });
    await notify(tx, organizationId, c.customerId, "RESERVATION", `Your reserved space is ${space.number}.`, "आपका पार्किंग स्थान आवंटित कर दिया गया है।", "reservation:" + (result as {id:string}).id); break;
   }
   case "release": case "suspend": {
    const r = await tx.reservation.findFirstOrThrow({ where: { ...scope, id: c.reservationId, status: "ACTIVE" } });
    if (await tx.parkingSession.findFirst({ where: { ...scope, spaceId: r.spaceId, exitAt: null } })) throw new Error("Occupied spaces cannot be released or suspended.");
    await tx.reservation.update({ where: { id: r.id }, data: { status: c.action === "release" ? "RELEASED" : "SUSPENDED", ...(c.action === "release" ? { endAt: now } : {}) } }); break;
   }
   case "block": {
    const s = await tx.parkingSpace.findFirstOrThrow({ where: { ...scope, id: c.spaceId } });
    if (c.blocked && (await reservationFor(s.id) || await tx.parkingSession.findFirst({ where: { ...scope, spaceId: s.id, exitAt: null } }))) throw new Error("Only vacant, unreserved spaces can be blocked.");
    await tx.parkingSpace.update({ where: { id: s.id }, data: { blocked: c.blocked } }); break;
   }
   case "customer": {
    result = await tx.customer.create({ data: { ...scope, name: c.name, phone: c.phone, email: c.email || null, consent: c.consent, vehicles: { create: { plate: c.plate } } } }); break;
   }
   case "payment": {
    const invoice = await tx.invoice.findFirstOrThrow({ where: { ...scope, id: c.invoiceId, ...(user.role === "CUSTOMER" ? { customerId: user.customerId ?? "NONE" } : {}) }, include: { payments: true } });
    if (user.role === "CUSTOMER" && c.method !== "SIMULATED") throw new Error("Customers can only use the simulated gateway.");
    const existing = await tx.payment.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: c.idempotencyKey } } });
    if (existing) { if (existing.invoiceId !== c.invoiceId || existing.amountPaise !== c.amountPaise) throw new Error("Idempotency key conflict"); return existing; }
    if (c.amountPaise > balance(invoice.amountPaise, invoice.payments)) throw new Error("Payment exceeds outstanding balance.");
    result = await tx.payment.create({ data: { ...scope, invoiceId: invoice.id, amountPaise: c.amountPaise, method: c.method, reference: c.reference, idempotencyKey: c.idempotencyKey } });
    await notify(tx, organizationId, invoice.customerId, "PAYMENT", `Payment recorded for ${invoice.number}. ${c.method === "SIMULATED" ? "Simulation only; no money was charged." : "Manually recorded payment."}`, "भुगतान रिकॉर्ड कर लिया गया है।", "payment:" + (result as {id:string}).id); break;
   }
   case "refund": {
    const payment = await tx.payment.findFirstOrThrow({ where: { ...scope, id: c.paymentId, amountPaise: { gt: 0 } } });
    const previous = await tx.payment.findMany({ where: { ...scope, reference: "REFUND:" + payment.id } });
    if (c.amountPaise > payment.amountPaise + previous.reduce((n,p) => n+p.amountPaise,0)) throw new Error("Refund exceeds original payment.");
    result = await tx.payment.create({ data: { ...scope, invoiceId: payment.invoiceId, amountPaise: -c.amountPaise, method: "REFUND", reference: "REFUND:" + payment.id, idempotencyKey: c.idempotencyKey } }); break;
   }
   case "reminders": {
    const subscriptions = await tx.subscription.findMany({ where: { ...scope, status: "ACTIVE" } });
    let count = 0;
    for (const s of subscriptions) {
     const location = await tx.parkingLocation.findFirst({ where: scope });
     const { days } = subscriptionStatus(s, now, location?.timezone);
     if (![10,5,1,-1,-5].includes(days)) continue;
     await notify(tx, organizationId, s.customerId, "EXPIRY", `Your parking subscription ${days < 0 ? "expired " + -days + " days ago" : "expires in " + days + " days"}. Please review your renewal.`, "कृपया अपनी पार्किंग सदस्यता का नवीनीकरण करें।", `expiry:${s.id}:${s.paidThrough.toISOString()}:${days}`); count++;
    }
    result = { ok: true, count }; break;
   }
   case "resolve": {
    const v = await tx.violation.findFirstOrThrow({ where: { ...scope, id: c.violationId } });
    await tx.violation.update({ where: { id: v.id }, data: { resolvedAt: now } }); break;
   }
   case "issue": {
    await tx.parkingSpace.findFirstOrThrow({ where: { ...scope, id: c.spaceId } });
    if (user.role === "CUSTOMER" && !await tx.reservation.findFirst({ where: { ...scope, customerId: user.customerId ?? "NONE", spaceId: c.spaceId, status: "ACTIVE" } })) throw new Error("You can report an issue for your assigned space.");
    result = await tx.violation.create({ data: { ...scope, spaceId: c.spaceId, plate: "REPORTED", reason: c.reason } }); break;
   }
   case "waitlist": {
    const vehicle = await tx.vehicle.findFirstOrThrow({ where: { ...scope, id: c.vehicleId, customerId: c.customerId } });
    if (await tx.waitlistEntry.findFirst({ where: { ...scope, customerId: c.customerId, status: "WAITING" } })) throw new Error("Customer is already on the waitlist.");
    result = await tx.waitlistEntry.create({ data: { ...scope, customerId: c.customerId, vehicleId: vehicle.id } }); break;
   }
   case "allocate": {
    const entry = await tx.waitlistEntry.findFirstOrThrow({ where: { ...scope, id: c.waitlistId, status: "WAITING" } });
    const space = await tx.parkingSpace.findFirstOrThrow({ where: { ...scope, id: c.spaceId } });
    const vehicle = await tx.vehicle.findFirstOrThrow({ where: { ...scope, id: entry.vehicleId } });
    if (space.blocked || await tx.parkingSession.findFirst({ where: { ...scope, spaceId: space.id, exitAt: null } }) || await tx.reservation.findFirst({ where: { ...scope, spaceId: space.id, status: { in: ["ACTIVE","SUSPENDED"] }, OR: [{ endAt: null }, { endAt: { gt: now } }] } })) throw new Error("This space is not legitimately available.");
    result = await tx.reservation.create({ data: { ...scope, customerId: entry.customerId, spaceId: space.id, authorizedPlates: [vehicle.plate], startAt: now } });
    await tx.waitlistEntry.update({ where: { id: entry.id }, data: { status: "ALLOCATED" } });
    await notify(tx, organizationId, entry.customerId, "ALLOCATION", `Your waitlist allocation to ${space.number} is confirmed.`, "प्रतीक्षा सूची से आपका पार्किंग स्थान आवंटित किया गया है।", "waitlist:" + entry.id); break;
   }
   case "renew": {
    const sub = await tx.subscription.findFirstOrThrow({ where: { ...scope, id: c.subscriptionId, status: "ACTIVE" } });
    const paidThrough = new Date(Math.max(now.getTime(), sub.paidThrough.getTime()));
    paidThrough.setUTCMonth(paidThrough.getUTCMonth() + c.months);
    result = await tx.subscription.update({ where: { id: sub.id }, data: { paidThrough, nextRenewal: paidThrough } });
    await tx.invoice.create({ data: { ...scope, customerId: sub.customerId, number: "INV-" + crypto.randomUUID(), amountPaise: sub.amountPaise * c.months, dueAt: now } }); break;
   }
   case "cancel": {
    const sub = await tx.subscription.findFirstOrThrow({ where: { ...scope, id: c.subscriptionId } });
    await tx.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", cancellationReason: c.reason } }); break;
   }
   case "tenant": result = await tx.organization.create({ data: { name: c.name, slug: c.slug } }); break;
   case "settings": result = await tx.organization.update({ where: { id: organizationId }, data: { name: c.name, branding: c.branding } }); break;
  }
  // No credentials or tokens are copied into the audit trail.
  await tx.auditLog.create({ data: { ...scope, actorId: user.id, action: c.action, entityId: "id" in (result as object) ? (result as {id:string}).id : "operation", details: JSON.parse(JSON.stringify(c)) } });
  return result;
 }, { maxWait: 10000, timeout: 20000 });
}
