import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const database=process.env.DATABASE_URL;
if(!database) throw new Error("Configure the hosted DATABASE_URL before deploying ParkPilot.");
const direct=process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || database;
function run(module,args,env=process.env){const result=spawnSync(process.execPath,[require.resolve(module),...args],{stdio:"inherit",env});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run("prisma/build/index.js",["generate"]);
if(process.env.VERCEL_ENV!=="preview"){
 run("prisma/build/index.js",["migrate","deploy"],{...process.env,DATABASE_URL:direct});
 if(process.env.SEED_DEMO==="true"){
  if(!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length<12)throw new Error("Set a DEMO_PASSWORD of at least 12 characters before demo seeding.");
  run("tsx/cli",["prisma/seed.ts"],{...process.env,DATABASE_URL:direct});
 }
}
run("next/dist/bin/next",["build"]);
