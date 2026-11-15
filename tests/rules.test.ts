import { describe, expect, it } from "vitest";
import { balance, calendarDay, canEnter, normalizePlate, subscriptionStatus } from "../src/lib/rules";
describe("reserved parking safeguards",()=>{
 it("normalizes Indian plates",()=>expect(normalizePlate("mh 02-ab 1234")).toBe("MH02AB1234"));
 it("allows an authorized reserved car",()=>expect(canEnter(false,false,{authorizedPlates:["MH02AB1234"]},"mh02 ab1234",false)).toBe(false));
 it("blocks unauthorized normal check-in",()=>expect(()=>canEnter(false,false,{authorizedPlates:["MH02AB1234"]},"MH02XY9999",false)).toThrow("Unauthorized"));
 it("marks explicitly overridden occupancy unauthorized",()=>expect(canEnter(false,false,{authorizedPlates:["MH02AB1234"]},"MH02XY9999",true)).toBe(true));
 it("never overwrites occupancy, including override",()=>expect(()=>canEnter(false,true,null,"MH02AB1234",true)).toThrow("already occupied"));
 it("blocks maintenance occupancy",()=>expect(()=>canEnter(true,false,null,"MH02AB1234",true)).toThrow("maintenance"));
});
describe("billing and local calendar",()=>{
 it("accounts for partial payments and refunds",()=>expect(balance(250000,[{amountPaise:100000},{amountPaise:-25000}])).toBe(175000));
 it("uses Kolkata calendar midnight",()=>expect(calendarDay(new Date("2026-11-14T18:30:00Z"))-calendarDay(new Date("2026-11-14T18:29:59Z"))).toBe(1));
 const now=new Date("2026-11-14T19:00:00Z");
 it.each([[10,"Expiring soon"],[0,"Expiring soon"],[-1,"Grace period"],[-5,"Grace period"],[-6,"Expired"],[11,"Active"]])("classifies %i days as %s",(days,status)=>{
 expect(subscriptionStatus({status:"ACTIVE",paidThrough:new Date(+now+Number(days)*86400000),graceDays:5},now).status).toBe(status);
 });
 it("preserves cancellation",()=>expect(subscriptionStatus({status:"CANCELLED",paidThrough:new Date(+now+86400000),graceDays:5},now).status).toBe("Cancelled"));
});
