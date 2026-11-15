import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { execute } from "../src/lib/operations";
import type { User } from "@prisma/client";
import { balance } from "../src/lib/rules";
const suffix=crypto.randomUUID(),org="test-"+suffix,other="other-"+suffix;
let owner:User,guard:User,customerUser:User,space:string,reserved:string,vehicle1:string,vehicle2:string,customer:string,invoice:string,foreignSpace:string;
beforeAll(async()=>{
 await db.organization.createMany({data:[{id:org,name:"TEST ONLY",slug:org},{id:other,name:"OTHER TEST ONLY",slug:other}]});
 const location=await db.parkingLocation.create({data:{organizationId:org,name:"Test location",address:"Fictional"}});
 const zone=await db.parkingZone.create({data:{organizationId:org,locationId:location.id,name:"A",floor:"Ground"}});
 const c=await db.customer.create({data:{organizationId:org,name:"Fictional test",phone:"9000000000"}});customer=c.id;
 vehicle1=(await db.vehicle.create({data:{organizationId:org,customerId:customer,plate:"MH02AB1111"}})).id;
 vehicle2=(await db.vehicle.create({data:{organizationId:org,customerId:customer,plate:"MH02AB2222"}})).id;
 for(const [number,target] of [["P001",org],["P002",org],["FOREIGN",other]]){
 const s=await db.parkingSpace.create({data:{organizationId:target,locationId:location.id,zoneId:zone.id,number}});
 if(number==="P001")space=s.id;else if(number==="P002")reserved=s.id;else foreignSpace=s.id;
 }
 owner=await db.user.create({data:{organizationId:org,email:`${suffix}@owner.test`,name:"Test Owner",passwordHash:"UNUSABLE",role:"OWNER"}});
 guard={...owner,role:"GUARD"}; customerUser={...owner,role:"CUSTOMER",customerId:customer};
 invoice=(await db.invoice.create({data:{organizationId:org,customerId:customer,number:"TEST-1",amountPaise:250000,dueAt:new Date()}})).id;
 await execute(owner,{action:"reserve",spaceId:reserved,customerId:customer,plate:"MH02AB1111",startAt:new Date(Date.now()-86400000).toISOString()});
});
afterAll(async()=>{
 for(const id of [org,other]){
 const where={organizationId:id};
 await db.$transaction([db.authSession.deleteMany({where:{user:{organizationId:id}}}),db.payment.deleteMany({where}),db.invoice.deleteMany({where}),db.notification.deleteMany({where}),db.auditLog.deleteMany({where}),db.violation.deleteMany({where}),db.parkingSession.deleteMany({where}),db.reservation.deleteMany({where}),db.waitlistEntry.deleteMany({where}),db.subscription.deleteMany({where}),db.user.deleteMany({where}),db.vehicle.deleteMany({where}),db.customer.deleteMany({where}),db.parkingSpace.deleteMany({where}),db.parkingZone.deleteMany({where}),db.parkingLocation.deleteMany({where}),db.organization.deleteMany({where:{id}})]);
 }
 await db.$disconnect();
});
describe("database-backed business invariants",()=>{
 it("serializes two guards competing for a vacant space",async()=>{
 const results=await Promise.allSettled([execute(guard,{action:"checkin",spaceId:space,plate:"MH02AB1111"}),execute(guard,{action:"checkin",spaceId:space,plate:"MH02AB2222"})]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 const session=await db.parkingSession.findFirstOrThrow({where:{organizationId:org,exitAt:null}});
 await execute(guard,{action:"checkout",sessionId:session.id});
 });
 it("blocks unauthorized entry but permits audited incident override",async()=>{
 await expect(execute(guard,{action:"checkin",spaceId:reserved,plate:"MH02AB2222"})).rejects.toThrow("Unauthorized");
 await execute(guard,{action:"checkin",spaceId:reserved,plate:"MH02AB2222",override:true,reason:"Fictional physical incident"});
 expect(await db.violation.count({where:{organizationId:org}})).toBe(1);
 expect(await db.auditLog.count({where:{organizationId:org,action:"checkin"}})).toBeGreaterThan(0);
 await expect(execute(owner,{action:"release",reservationId:(await db.reservation.findFirstOrThrow({where:{organizationId:org}})).id})).rejects.toThrow("Occupied");
 const s=await db.parkingSession.findFirstOrThrow({where:{organizationId:org,exitAt:null}});await execute(guard,{action:"checkout",sessionId:s.id});
 });
 it("enforces tenant boundaries and roles on the server",async()=>{
 await expect(execute(owner,{action:"block",spaceId:foreignSpace,blocked:true,organizationId:other})).rejects.toThrow();
 await expect(execute(guard,{action:"reserve",spaceId:space,customerId:customer,plate:"MH02AB1111",startAt:new Date().toISOString()})).rejects.toThrow("FORBIDDEN");
 await expect(execute(customerUser,{action:"payment",invoiceId:invoice,amountPaise:1000,method:"CASH",reference:"TEST",idempotencyKey:crypto.randomUUID()})).rejects.toThrow("simulated");
 });
 it("deduplicates concurrent payment retries and protects overpayment",async()=>{
 const c={action:"payment",invoiceId:invoice,amountPaise:100000,method:"SIMULATED",reference:"TEST-SIMULATED",idempotencyKey:crypto.randomUUID()};
 await Promise.all([execute(owner,c),execute(owner,c)]);
 const i=await db.invoice.findUniqueOrThrow({where:{id:invoice},include:{payments:true}});expect(i.payments).toHaveLength(1);expect(balance(i.amountPaise,i.payments)).toBe(150000);
 await expect(execute(owner,{...c,amountPaise:150001,idempotencyKey:crypto.randomUUID()})).rejects.toThrow("exceeds");
 });
 it("database constraints reject duplicate active space occupancy directly",async()=>{
 await db.parkingSession.create({data:{organizationId:org,spaceId:space,vehicleId:vehicle1}});
 await expect(db.parkingSession.create({data:{organizationId:org,spaceId:space,vehicleId:vehicle2}})).rejects.toThrow();
 const s=await db.parkingSession.findFirstOrThrow({where:{organizationId:org,exitAt:null}});await execute(guard,{action:"checkout",sessionId:s.id});
 });
 it("waitlist allocation requires a legitimately vacant space and manager confirmation",async()=>{
 const entry=await execute(owner,{action:"waitlist",customerId:customer,vehicleId:vehicle2}) as {id:string};
 const session=await db.parkingSession.create({data:{organizationId:org,spaceId:space,vehicleId:vehicle1}});
 await expect(execute(owner,{action:"allocate",waitlistId:entry.id,spaceId:space})).rejects.toThrow("not legitimately available");
 await execute(guard,{action:"checkout",sessionId:session.id});
 await execute(owner,{action:"allocate",waitlistId:entry.id,spaceId:space});
 expect((await db.waitlistEntry.findUniqueOrThrow({where:{id:entry.id}})).status).toBe("ALLOCATED");
 expect(await db.reservation.count({where:{organizationId:org,spaceId:space,status:"ACTIVE"}})).toBe(1);
 });
});
