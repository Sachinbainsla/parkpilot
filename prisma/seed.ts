import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
const db = new PrismaClient();
const org = "metro-demo", location = "metro-location", zone = "metro-zone";
const now = new Date();
const day = (offset: number) => new Date(now.getTime() + offset * 86400000);
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) throw new Error("Set DEMO_PASSWORD to at least 12 characters in .env");
function hash(value: string) { const salt=randomBytes(16).toString("hex"); return salt+":"+scryptSync(value,salt,64).toString("hex"); }
async function main() {
 if (await db.organization.findUnique({where:{id:org}})) { console.log("Demo already exists. Seed is non-destructive; no data changed."); return; }
 await db.$transaction(async tx=>{
 await tx.organization.create({data:{id:org,name:"Metro Smart Parking",slug:"metro-demo"}});
 await tx.organization.create({data:{id:"isolation-demo",name:"Fictional Isolation Test Organization",slug:"isolation-demo"}});
 await tx.parkingLocation.create({data:{id:location,organizationId:org,name:"Andheri Business Park",address:"Fictional address · Mumbai, Maharashtra"}});
 await tx.parkingZone.create({data:{id:zone,organizationId:org,locationId:location,name:"Zone A",floor:"Ground floor"}});
 for(let i=1;i<=100;i++) await tx.parkingSpace.create({data:{id:`space-${i}`,organizationId:org,locationId:location,zoneId:zone,number:`P${String(i).padStart(3,"0")}`,blocked:i>=98}});
 const names=["Aarav Shah","Diya Mehta","Arjun Kapoor","Ananya Rao","Vihaan Patel","Isha Verma","Aditya Nair","Saanvi Joshi","Kabir Singh","Meera Desai","Rohan Gupta","Tara Iyer","Vivaan Jain","Aditi Kulkarni","Reyansh Sethi","Nisha Menon","Aryan Malhotra","Priya Sharma","Dhruv Bhat","Riya Chawla","Kunal Bose","Neha Reddy","Dev Agarwal","Sara Khan","Yash Trivedi"];
 for(let i=1;i<=45;i++) {
 const customerId=`customer-${i}`,vehicleId=`vehicle-${i}`,plate=`MH02AB${1000+i}`;
 await tx.customer.create({data:{id:customerId,organizationId:org,name:(names[i-1]||`Visitor ${i-25}`)+" (Fictional)",phone:`90000${String(i).padStart(5,"0")}`,email:`customer${i}@metro.demo`,consent:i%3!==0,vehicles:{create:{id:vehicleId,plate}}}});
 if(i<=25) {
 await tx.reservation.create({data:{id:`reservation-${i}`,organizationId:org,spaceId:`space-${i}`,customerId,authorizedPlates:[plate],startAt:day(-60)}});
 const expiry=[25,10,5,1,-1,-8,18,22,7,3][(i-1)%10];
 await tx.subscription.create({data:{id:`subscription-${i}`,organizationId:org,customerId,startAt:day(-60),paidThrough:day(expiry),nextRenewal:day(expiry),amountPaise:250000,graceDays:5}});
 for(let m=0;m<6;m++) {
 const invoiceId=`invoice-${i}-${m}`,createdAt=day(-m*30-7),amountPaise=250000;
 await tx.invoice.create({data:{id:invoiceId,organizationId:org,customerId,number:`MSP-${now.getUTCFullYear()}-${String(m*25+i).padStart(4,"0")}`,amountPaise,dueAt:m===0?day(i%4===0?-5:5):day(-m*30),createdAt}});
 if(m>0||(i%4!==0&&i!==1))await tx.payment.create({data:{organizationId:org,invoiceId,amountPaise:m===0&&i%5===0?125000:amountPaise,method:"SIMULATED",reference:`FICTIONAL-${i}-${m}`,idempotencyKey:`seed-${i}-${m}`,createdAt}});
 }
 }
 }
 // 18 reserved + 20 general + 2 unauthorized = 40 occupied. Reservations remain 25.
 for(let i=1;i<=18;i++)await tx.parkingSession.create({data:{organizationId:org,spaceId:`space-${i}`,vehicleId:`vehicle-${i}`,entryAt:new Date(now.getTime()-(i+1)*23*60000)}});
 for(let i=26;i<=45;i++)await tx.parkingSession.create({data:{organizationId:org,spaceId:`space-${i}`,vehicleId:`vehicle-${i}`,entryAt:new Date(now.getTime()-(i-24)*17*60000)}});
 for(let i=19;i<=20;i++){
 await tx.parkingSession.create({data:{organizationId:org,spaceId:`space-${i}`,vehicleId:`vehicle-${i+2}`,entryAt:new Date(now.getTime()-90*60000),unauthorized:true}});
 await tx.violation.create({data:{organizationId:org,spaceId:`space-${i}`,plate:`MH02AB${1000+i+2}`,reason:"Fictional incident: vehicle found in another customer's reserved space."}});
 }
 for(let days=1;days<=30;days++)for(let i=1;i<=15+(days%8);i++)await tx.parkingSession.create({data:{organizationId:org,spaceId:`space-${26+i}`,vehicleId:`vehicle-${i}`,entryAt:new Date(day(-days).setUTCHours(3+i%5,0,0,0)),exitAt:new Date(day(-days).setUTCHours(17+i%3,0,0,0))}});
 for(let i=23;i<=25;i++)await tx.waitlistEntry.create({data:{organizationId:org,customerId:`customer-${i+15}`,vehicleId:`vehicle-${i+15}`,createdAt:day(-10+i-23)}});
 for(const [email,name,role,customerId] of [
 ["owner@metro.demo","Aarav · Demo Owner",Role.OWNER,null],
 ["manager@metro.demo","Diya · Demo Manager",Role.MANAGER,null],
 ["guard@metro.demo","Rohan · Demo Guard",Role.GUARD,null],
 ["customer@metro.demo","Aarav Shah (Fictional)",Role.CUSTOMER,"customer-1"],
 ["admin@parkpilot.demo","Platform Demo Admin",Role.SUPER_ADMIN,null],
 ] as const) await tx.user.create({data:{organizationId:org,email,name,role,customerId,passwordHash:hash(password!)}});
 await tx.user.create({data:{organizationId:"isolation-demo",email:"other@metro.demo",name:"Other Tenant Owner",role:"OWNER",passwordHash:hash(password!)}});
 await tx.notification.create({data:{organizationId:org,kind:"WELCOME",message:"Welcome to your fictional ParkPilot workspace. All payments are simulated.",messageHi:"आपके काल्पनिक पार्किंग कार्यक्षेत्र में आपका स्वागत है।",dedupKey:"welcome"}});
 await tx.auditLog.create({data:{organizationId:org,actorId:"seed",action:"DEMO_SEEDED",entityId:org,details:{fictional:true,spaces:100,reserved:25,occupied:40}}});
 },{timeout:120000});
 console.log("Fictional demo ready: 100 spaces, 25 reservations, 40 occupied, 45 customers. All role accounts use DEMO_PASSWORD.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
