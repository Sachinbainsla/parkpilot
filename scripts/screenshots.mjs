import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import "dotenv/config";
await mkdir("screenshots",{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
await page.goto("http://localhost:3001/login");
await page.waitForLoadState("networkidle");
await page.screenshot({path:"screenshots/login.png",fullPage:true});
if(process.env.CAPTURE_DASHBOARD){
 await page.getByLabel("Email address").fill("owner@metro.demo");
 await page.getByLabel("Password",{exact:true}).fill(process.env.DEMO_PASSWORD);
 await page.getByRole("button",{name:"Sign in to ParkPilot"}).click();
 await page.getByRole("heading",{name:"Your parking, at a glance"}).waitFor();
 await page.waitForTimeout(1800);
 await page.screenshot({path:"screenshots/dashboard.png",fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(1800);
 await page.screenshot({path:"screenshots/mobile.png",fullPage:true});
}
await browser.close();
