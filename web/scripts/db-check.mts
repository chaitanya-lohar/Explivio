// Checks the MongoDB Atlas connection without printing the connection string. Usage: npm run db:check
import { checkDatabase } from "../src/lib/db/health.ts";
import { closeDatabase } from "../src/lib/db/mongo.ts";

const health = await checkDatabase(undefined, (line) => console.error(line));
console.log(`MongoDB: ${health.status}${health.latencyMs !== null ? ` (${health.latencyMs} ms)` : ""}`);
await closeDatabase();
process.exit(health.status === "ok" ? 0 : 1);
