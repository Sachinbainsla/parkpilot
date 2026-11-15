import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const url = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local DB helper only accepts localhost DATABASE_URL.");
const pg = new EmbeddedPostgres({ databaseDir: "./.local-postgres-utf8", user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), port: Number(url.port || 5432), persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"], authMethod: "scram-sha-256", postgresFlags: ["-h", "127.0.0.1", "-c", "timezone=UTC"] });
async function main() {
 if (!existsSync(".local-postgres-utf8/PG_VERSION")) await pg.initialise();
 await pg.start();
 const client = pg.getPgClient(); await client.connect();
 const name = url.pathname.slice(1); if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error("Invalid database name");
 const result=await client.query("SELECT datname FROM pg_database WHERE datname = $1",[name]);
 await client.end(); if (!result.rows.length) await pg.createDatabase(name);
 console.log("ParkPilot local PostgreSQL is ready. Keep this terminal open. Ctrl+C stops it.");
 for(const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal,async()=>{await pg.stop();process.exit(0);});
 setInterval(()=>{},60000);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
