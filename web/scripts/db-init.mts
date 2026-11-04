// Creates the Explivio collections (with validators) and indexes. Idempotent. Usage: npm run db:init
import { ensureSchema } from "../src/lib/db/collections.ts";
import { closeDatabase, getDatabase, safeReason } from "../src/lib/db/mongo.ts";

try {
  const db = await getDatabase();
  const result = await ensureSchema(db);
  console.log(`Collections created: ${result.createdCollections.join(", ") || "none (all existed)"}`);
  console.log(`Indexes ensured (${result.indexes.length}): ${result.indexes.join(", ")}`);
} catch (error) {
  console.error(`db:init failed: ${error instanceof Error && error.name === "DatabaseConfigError" ? error.message : safeReason(error)}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
