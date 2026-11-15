import { expect, test } from "@playwright/test";
async function login(page:import("@playwright/test").Page,email:string){await page.goto("/login");await page.getByLabel("Email address").fill(email);await page.getByLabel("Password",{exact:true}).fill(process.env.DEMO_PASSWORD!);await page.getByRole("button",{name:"Sign in to ParkPilot"}).click();await expect(page).toHaveURL(/dashboard/, { timeout: 30000 });}
test("owner sees seeded map and tenant-safe dashboard",async({page})=>{await login(page,"owner@metro.demo");await expect(page.getByRole("heading",{name:"Your parking, at a glance"})).toBeVisible();await expect(page.getByRole("button",{name:/^P[0-9]{3}:/})).toHaveCount(100);await page.getByRole("button",{name:"P025: reserved"}).click();await expect(page.getByRole("dialog")).toContainText("MH02AB1025");});
test("customer only sees their own invoice and vehicle data",async({page})=>{await login(page,"customer@metro.demo");await expect(page.getByRole("heading",{name:"Customer Portal",exact:true})).toBeVisible();const response=await page.request.get("/api/operations");const data=await response.json();expect(data.customers).toHaveLength(1);expect(data.vehicles.every((v:{customerId:string})=>v.customerId===data.user.customerId)).toBeTruthy();expect(data.audits).toHaveLength(0);});
test("guard cannot reserve or record payments",async({page})=>{await login(page,"guard@metro.demo");const response=await page.request.post("/api/operations",{headers:{Origin:"http://localhost:3001"},data:{action:"settings",name:"Unauthorized",branding:"#000000"}});expect(response.status()).toBe(403);});
test("anonymous workspace API does not disclose data",async({request})=>{const response=await request.get("/api/operations");expect(response.ok()).toBeFalsy();expect(await response.text()).not.toContain("passwordHash");});

test("guard completes authorized check-in, rejects wrong reserved car, then audits a physical incident",async({page})=>{
 await login(page,"guard@metro.demo");
 await page.getByRole("button",{name:"P025: reserved",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Check in vehicle",exact:true}).click();
 let dialog=page.getByRole("dialog");await dialog.getByLabel("Vehicle license plate").fill("MH02AB1025");await dialog.getByRole("button",{name:"Confirm",exact:true}).click();
 await expect(page.getByRole("button",{name:"P025: occupied",exact:true})).toBeVisible();
 await page.getByRole("dialog").getByRole("button",{name:"Check out vehicle",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Confirm",exact:true}).click();
 await expect(page.getByRole("button",{name:"P025: reserved",exact:true})).toBeVisible();
 await page.getByRole("dialog").getByRole("button",{name:"Check in vehicle",exact:true}).click();
 dialog=page.getByRole("dialog");await dialog.getByLabel("Vehicle license plate").fill("MH02AB1024");await dialog.getByRole("button",{name:"Confirm",exact:true}).click();
 await expect(page.getByRole("status")).toContainText("Unauthorized vehicle");
 await dialog.getByRole("button",{name:"Cancel",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Record unauthorized parking",exact:true}).click();
 dialog=page.getByRole("dialog");await dialog.getByLabel("Vehicle license plate").fill("MH02AB1024");await dialog.getByLabel("Incident reason").fill("Fictional browser test: physically parked in wrong space");await dialog.getByRole("button",{name:"Confirm",exact:true}).click();
 await expect(page.getByRole("button",{name:"P025: violation",exact:true})).toBeVisible();
 await page.getByRole("dialog").getByRole("button",{name:"Check out vehicle",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Confirm",exact:true}).click();
 await expect(page.getByRole("button",{name:"P025: reserved",exact:true})).toBeVisible();
});

test("customer pays a demo invoice and downloads a receipt",async({page})=>{
 await login(page,"customer@metro.demo");await page.getByRole("button",{name:"Billing",exact:true}).click();
 const before=await (await page.request.get("/api/operations")).json();
 const invoice=before.invoices.find((i:{amountPaise:number;payments:{amountPaise:number}[]})=>i.amountPaise-i.payments.reduce((n,p)=>n+p.amountPaise,0)>0);
 if(!invoice){test.skip(true,"Demo customer's invoice has already been fully paid");return;}
 await page.getByRole("button",{name:"Record payment",exact:true}).first().click();
 const dialog=page.getByRole("dialog");await dialog.getByLabel("Amount (INR)").fill("1");await dialog.getByRole("button",{name:"Confirm",exact:true}).click();await expect(dialog).not.toBeVisible();
 const after=await (await page.request.get("/api/operations")).json();
 const updated=after.invoices.find((i:{id:string})=>i.id===invoice.id);
 expect(updated.payments.reduce((n:number,p:{amountPaise:number})=>n+p.amountPaise,0)).toBe(invoice.payments.reduce((n:number,p:{amountPaise:number})=>n+p.amountPaise,0)+100);
 const payment=updated.payments.find((p:{id:string})=>!invoice.payments.some((old:{id:string})=>old.id===p.id));
 const receipt=await page.request.get("/api/receipt/"+payment.id);expect(receipt.status()).toBe(200);expect(receipt.headers()["content-type"]).toContain("application/pdf");
});
test("owner creates idempotent reminders and exports a report",async({page})=>{
 await login(page,"owner@metro.demo");
 for(let i=0;i<2;i++){const response=await page.request.post("/api/operations",{headers:{Origin:"http://localhost:3001"},data:{action:"reminders"}});expect(response.ok()).toBeTruthy();}
 const data=await (await page.request.get("/api/operations")).json();const keys=data.notifications.map((n:{dedupKey:string;channel:string})=>n.dedupKey+n.channel);expect(new Set(keys).size).toBe(keys.length);
 const report=await page.request.get("/api/reports");expect(report.status()).toBe(200);expect(await report.text()).toContain("FICTIONAL DEMO DATA");
});
