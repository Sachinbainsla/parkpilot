import "dotenv/config";
import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./e2e",timeout:120000,expect:{timeout:15000},fullyParallel:false,use:{baseURL:"http://localhost:3001",trace:"retain-on-failure",launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},webServer:{command:"npm run dev",url:"http://localhost:3001/login",reuseExistingServer:!process.env.CI,timeout:120000}});
