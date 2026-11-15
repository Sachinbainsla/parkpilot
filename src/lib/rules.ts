export function normalizePlate(plate: string) { return plate.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
export function calendarDay(date: Date, timezone = "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))) / 86400000;
}
export function subscriptionStatus(s: { status: string; paidThrough: Date; graceDays: number }, now = new Date(), timezone = "Asia/Kolkata") {
  const days = calendarDay(s.paidThrough, timezone) - calendarDay(now, timezone);
  const status = s.status === "CANCELLED" ? "Cancelled" : days < -s.graceDays ? "Expired" : days < 0 ? "Grace period" : days <= 10 ? "Expiring soon" : "Active";
  return { days, status };
}
export function balance(amount: number, payments: { amountPaise: number }[]) { return amount - payments.reduce((n, p) => n + p.amountPaise, 0); }
export function canEnter(blocked: boolean, occupied: boolean, reservation: { authorizedPlates: string[] } | null, plate: string, override: boolean) {
  if (blocked) throw new Error("This space is blocked for maintenance.");
  if (occupied) throw new Error("Space already occupied. Check out the existing vehicle first.");
  const unauthorized = !!reservation && !reservation.authorizedPlates.includes(normalizePlate(plate));
  if (unauthorized && !override) throw new Error("Unauthorized vehicle: this space is reserved. Use the audited incident workflow to record physical parking.");
  return unauthorized;
}
export const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
