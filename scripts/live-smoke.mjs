import { chromium } from "@playwright/test";
import { createInterface } from "node:readline";
import { mkdir } from "node:fs/promises";
const rl=createInterface({input:process.stdin});
console.log("Ready for hosted demo verification input.");
rl.once("line",async line=>{
 rl.close();let browser;
 try{
  const {baseUrl,password}=JSON.parse(line);
  if(new URL(baseUrl).protocol!=="https:")throw new Error("Hosted verification requires HTTPS.");
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();page.setDefaultTimeout(60000);
  const anonymous=await context.request.get(baseUrl+"/api/operations");
  if(anonymous.status()!==401)throw new Error("Anonymous API access did not return 401.");
  async function login(email){await page.goto(baseUrl+"/login");await page.getByLabel("Email address").fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in to ParkPilot"}).click();await page.waitForURL("**/dashboard",{timeout:90000});}
  await login("owner@metro.demo");await page.getByRole("heading",{name:"Your parking, at a glance"}).waitFor();
  const owner=await (await context.request.get(baseUrl+"/api/operations")).json();
  if(owner.spaces.length!==100||owner.user.role!=="OWNER")throw new Error("Hosted owner dataset is incorrect.");
  await page.getByRole("button",{name:/^P001:/}).waitFor();await page.waitForTimeout(1800);
  await mkdir("screenshots",{recursive:true});await page.screenshot({path:"screenshots/cloud-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1800);
  const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  if(bounds.width>bounds.viewport+1)throw new Error("Hosted dashboard overflows the mobile viewport.");
  await page.screenshot({path:"screenshots/cloud-mobile.png",fullPage:true});
  await context.clearCookies();await login("customer@metro.demo");await page.getByRole("heading",{name:"Customer Portal",exact:true}).waitFor();
  const own=await (await context.request.get(baseUrl+"/api/operations")).json();
  if(own.customers.length!==1||!own.vehicles.every(v=>v.customerId===own.user.customerId))throw new Error("Hosted customer isolation check failed.");
  console.log(JSON.stringify({url:baseUrl,https:true,anonymousApi:"401",ownerLogin:"passed",spaces:owner.spaces.length,mobile:"passed",customerLogin:"passed",tenantIsolation:"passed"}));
 }catch(e){console.error(e instanceof Error?e.message:"Hosted verification failed.");process.exitCode=1;}finally{await browser?.close();}
});
