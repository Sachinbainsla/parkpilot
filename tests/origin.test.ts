import {describe,it,expect} from "vitest";
import {appOrigin} from "../src/lib/origin";
describe("deployment origin checks",()=>{
 it("honors an explicit canonical origin",()=>expect(appOrigin({APP_ORIGIN:"https://parking.example/"})).toBe("https://parking.example"));
 it("uses the production Vercel domain",()=>expect(appOrigin({NODE_ENV:"production",VERCEL_ENV:"production",VERCEL_PROJECT_PRODUCTION_URL:"parkpilot.vercel.app"})).toBe("https://parkpilot.vercel.app"));
 it("keeps a preview on its own deployment domain",()=>expect(appOrigin({NODE_ENV:"production",VERCEL_ENV:"preview",VERCEL_URL:"parkpilot-preview.vercel.app",VERCEL_PROJECT_PRODUCTION_URL:"parkpilot.vercel.app"})).toBe("https://parkpilot-preview.vercel.app"));
 it("fails closed without a production origin",()=>expect(()=>appOrigin({NODE_ENV:"production"})).toThrow("APP_ORIGIN"));
 it("uses the configured local port for development",()=>expect(appOrigin({NODE_ENV:"development"})).toBe("http://localhost:3001"));
});
