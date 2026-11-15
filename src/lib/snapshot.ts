import { User } from "@prisma/client";
import { db } from "./db";
export async function snapshot(user: User) {
 const scope = { organizationId: user.organizationId };
 const customer = user.role === "CUSTOMER" ? { customerId: user.customerId ?? "NONE" } : {};
 const own = user.role === "CUSTOMER";
 const [organization, locations, zones, spaces, customers, vehicles, reservations, sessions, subscriptions, invoices, violations, notifications, waitlist, audits, tenants] = await Promise.all([
 db.organization.findUnique({ where: { id: user.organizationId } }), db.parkingLocation.findMany({ where: scope }), db.parkingZone.findMany({ where: scope }),
 db.parkingSpace.findMany({ where: own ? { ...scope, OR: [{ reservations: { some: { ...scope, ...customer } } }, { sessions: { some: { ...scope, vehicle: { ...customer }, exitAt: null } } }] } : scope, orderBy: { number: "asc" }, take: 500 }),
 db.customer.findMany({ where: { ...scope, ...(own ? { id: user.customerId ?? "NONE" } : {}) }, orderBy: { name: "asc" }, take: 500 }),
 db.vehicle.findMany({ where: { ...scope, ...customer }, take: 1000 }), db.reservation.findMany({ where: { ...scope, ...customer }, orderBy: { createdAt: "desc" }, take: 1000 }),
 db.parkingSession.findMany({ where: { ...scope, ...(own ? { vehicle: { ...customer } } : {}) }, include: { vehicle: { select: { plate: true, customerId: true } } }, orderBy: { entryAt: "desc" }, take: 2000 }),
 db.subscription.findMany({ where: { ...scope, ...customer }, take: 1000 }), db.invoice.findMany({ where: { ...scope, ...customer }, include: { payments: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
 db.violation.findMany({ where: { ...scope, ...(own ? { spaceId: { in: (await db.reservation.findMany({ where: { ...scope, ...customer }, select: { spaceId: true } })).map(r => r.spaceId) } } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
 db.notification.findMany({ where: { ...scope, ...(own ? customer : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
 own ? [] : db.waitlistEntry.findMany({ where: scope, orderBy: { createdAt: "asc" }, take: 200 }),
 own || user.role === "GUARD" ? [] : db.auditLog.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 100 }),
 user.role === "SUPER_ADMIN" ? db.organization.findMany({ take: 100 }) : [],
 ]);
 // Guards receive operational data, never billing amounts or customer contact details.
 return { user: { name: user.name, role: user.role, customerId: user.customerId }, organization, locations, zones, spaces, customers: user.role === "GUARD" ? customers.map(c => ({ ...c, email: null, phone: "", consent: false })) : customers, vehicles, reservations, sessions, subscriptions: user.role === "GUARD" ? [] : subscriptions, invoices: user.role === "GUARD" ? [] : invoices, violations, notifications: user.role === "GUARD" ? notifications.filter(n => ["UNAUTHORIZED", "RESERVATION", "ALLOCATION"].includes(n.kind)) : notifications, waitlist, audits, tenants, serverTime: new Date().toISOString(), truncated: sessions.length >= 2000 || customers.length >= 500 };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
