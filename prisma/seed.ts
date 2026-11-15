import "dotenv/config";
import { PrismaClient, Role, Prisma } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
const db = new PrismaClient();
const org="metro-demo", location="metro-location", zone="metro-zone";
const now=new Date();
const day=(offset:number)=>new Date(+now+offset*86400000);
const password=process.env.DEMO_PASSWORD;
if(!password||password.length<12)throw new Error("Set DEMO_PASSWORD to at least 12 characters.");
function hash(value:string){const salt=randomBytes(16).toString("hex");return salt+":"+scryptSync(value,salt,64).toString("hex");}
async function main(){
 if(await db.organization.findUnique({where:{id:org}})){console.log("Demo already exists. No records changed.");return;}
 const names=["Aarav Shah","Diya Mehta","Arjun Kapoor","Ananya Rao","Vihaan Patel","Isha Verma","Aditya Nair","Saanvi Joshi","Kabir Singh","Meera Desai","Rohan Gupta","Tara Iyer","Vivaan Jain","Aditi Kulkarni","Reyansh Sethi","Nisha Menon","Aryan Malhotra","Priya Sharma","Dhruv Bhat","Riya Chawla","Kunal Bose","Neha Reddy","Dev Agarwal","Sara Khan","Yash Trivedi"];
 const spaces:Prisma.ParkingSpaceCreateManyInput[]=Array.from({length:100},(_,i)=>({id:`space-${i+1}`,organizationId:org,locationId:location,zoneId:zone,number:`P${String(i+1).padStart(3,"0")}`,blocked:i+1>=98}));
 const customers:Prisma.CustomerCreateManyInput[]=[],vehicles:Prisma.VehicleCreateManyInput[]=[],reservations:Prisma.ReservationCreateManyInput[]=[],subscriptions:Prisma.SubscriptionCreateManyInput[]=[],invoices:Prisma.InvoiceCreateManyInput[]=[],payments:Prisma.PaymentCreateManyInput[]=[],sessions:Prisma.ParkingSessionCreateManyInput[]=[],violations:Prisma.ViolationCreateManyInput[]=[];
 for(let i=1;i<=45;i++){
  const customerId=`customer-${i}`,vehicleId=`vehicle-${i}`,plate=`MH02AB${1000+i}`;
  customers.push({id:customerId,organizationId:org,name:(names[i-1]||`Visitor ${i-25}`)+" (Fictional)",phone:`90000${String(i).padStart(5,"0")}`,email:`customer${i}@metro.demo`,consent:i%3!==0});
  vehicles.push({id:vehicleId,organizationId:org,customerId,plate});
  if(i<=25){
   reservations.push({id:`reservation-${i}`,organizationId:org,spaceId:`space-${i}`,customerId,authorizedPlates:[plate],startAt:day(-60)});
   const expiry=[25,10,5,1,-1,-8,18,22,7,3][(i-1)%10];
   subscriptions.push({id:`subscription-${i}`,organizationId:org,customerId,startAt:day(-60),paidThrough:day(expiry),nextRenewal:day(expiry),amountPaise:250000,graceDays:5});
   for(let m=0;m<6;m++){
    const invoiceId=`invoice-${i}-${m}`,createdAt=day(-m*30-7);
    invoices.push({id:invoiceId,organizationId:org,customerId,number:`MSP-${now.getUTCFullYear()}-${String(m*25+i).padStart(4,"0")}`,amountPaise:250000,dueAt:m===0?day(i%4===0?-5:5):day(-m*30),createdAt});
    if(m>0||(i%4!==0&&i!==1))payments.push({organizationId:org,invoiceId,amountPaise:m===0&&i%5===0?125000:250000,method:"SIMULATED",reference:`FICTIONAL-${i}-${m}`,idempotencyKey:`seed-${i}-${m}`,createdAt});
   }
  }
 }
 for(let i=1;i<=18;i++)sessions.push({organizationId:org,spaceId:`space-${i}`,vehicleId:`vehicle-${i}`,entryAt:new Date(+now-(i+1)*23*60000)});
 for(let i=26;i<=45;i++)sessions.push({organizationId:org,spaceId:`space-${i}`,vehicleId:`vehicle-${i}`,entryAt:new Date(+now-(i-24)*17*60000)});
 for(let i=19;i<=20;i++){
  sessions.push({organizationId:org,spaceId:`space-${i}`,vehicleId:`vehicle-${i+2}`,entryAt:new Date(+now-90*60000),unauthorized:true});
  violations.push({organizationId:org,spaceId:`space-${i}`,plate:`MH02AB${1000+i+2}`,reason:"Fictional incident: vehicle found in another customer's reserved space."});
 }
 for(let days=1;days<=30;days++)for(let i=1;i<=15+days%8;i++)sessions.push({organizationId:org,spaceId:`space-${26+i}`,vehicleId:`vehicle-${i}`,entryAt:new Date(day(-days).setUTCHours(3+i%5,0,0,0)),exitAt:new Date(day(-days).setUTCHours(17+i%3,0,0,0))});
 const users:Prisma.UserCreateManyInput[]=[
  {email:"owner@metro.demo",name:"Aarav - Demo Owner",role:Role.OWNER,customerId:null},
  {email:"manager@metro.demo",name:"Diya - Demo Manager",role:Role.MANAGER,customerId:null},
  {email:"guard@metro.demo",name:"Rohan - Demo Guard",role:Role.GUARD,customerId:null},
  {email:"customer@metro.demo",name:"Aarav Shah (Fictional)",role:Role.CUSTOMER,customerId:"customer-1"},
  {email:"admin@parkpilot.demo",name:"Platform Demo Admin",role:Role.SUPER_ADMIN,customerId:null},
 ].map(u=>({...u,organizationId:org,passwordHash:hash(password!)}));
 users.push({organizationId:"isolation-demo",email:"other@metro.demo",name:"Other Tenant Owner",role:Role.OWNER,passwordHash:hash(password!)});
 // Batch inserts keep initial cloud provisioning fast over a remote database connection.
 await db.$transaction(async tx=>{
  await tx.organization.createMany({data:[{id:org,name:"Metro Smart Parking",slug:"metro-demo"},{id:"isolation-demo",name:"Fictional Isolation Test Organization",slug:"isolation-demo"}]});
  await tx.parkingLocation.create({data:{id:location,organizationId:org,name:"Andheri Business Park",address:"Fictional address - Mumbai, Maharashtra"}});
  await tx.parkingZone.create({data:{id:zone,organizationId:org,locationId:location,name:"Zone A",floor:"Ground floor"}});
  await tx.parkingSpace.createMany({data:spaces});await tx.customer.createMany({data:customers});await tx.vehicle.createMany({data:vehicles});
  await tx.reservation.createMany({data:reservations});await tx.subscription.createMany({data:subscriptions});await tx.invoice.createMany({data:invoices});await tx.payment.createMany({data:payments});
  await tx.parkingSession.createMany({data:sessions});await tx.violation.createMany({data:violations});
  await tx.waitlistEntry.createMany({data:[23,24,25].map(i=>({organizationId:org,customerId:`customer-${i+15}`,vehicleId:`vehicle-${i+15}`,createdAt:day(-10+i-23)}))});
  await tx.user.createMany({data:users});
  await tx.notification.create({data:{organizationId:org,kind:"WELCOME",message:"Welcome to your fictional ParkPilot workspace. All payments are simulated.",messageHi:"आपके काल्पनिक पार्किंग कार्यक्षेत्र में आपका स्वागत है।",dedupKey:"welcome"}});
  await tx.auditLog.create({data:{organizationId:org,actorId:"seed",action:"DEMO_SEEDED",entityId:org,details:{fictional:true,spaces:100,reserved:25,occupied:40}}});
 },{maxWait:10000,timeout:120000});
 console.log("Fictional demo ready: 100 spaces, 25 reservations, 40 occupied, 45 customers.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
