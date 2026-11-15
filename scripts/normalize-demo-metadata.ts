import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db=new PrismaClient();
async function main(){
 const now=new Date();const future=new Date(+now+60000);
 const where={organizationId:"metro-demo",createdAt:{gt:future}};
 // Only repair future-dated fictional seed metadata from the initial local timezone.
 await db.$transaction([db.customer.updateMany({where,data:{createdAt:now}}),db.user.updateMany({where,data:{createdAt:now}}),db.reservation.updateMany({where,data:{createdAt:now}}),db.subscription.updateMany({where,data:{createdAt:now}}),db.violation.updateMany({where,data:{createdAt:now}}),db.notification.updateMany({where,data:{createdAt:now}}),db.auditLog.updateMany({where,data:{createdAt:now}})]);
 console.log("Fictional demo metadata checked.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
