import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readMongoConfig, redact } from "../src/lib/db/config.ts";
import { closeDatabase, DatabaseConfigError, DatabaseUnavailableError, getDatabase, getMongoClient, safeReason } from "../src/lib/db/mongo.ts";
import { COLLECTIONS, ensureSchema, INDEXES, VALIDATORS } from "../src/lib/db/collections.ts";
import { checkDatabase } from "../src/lib/db/health.ts";
import { legacyProjectDoc, planLegacyOwnership, type LegacyRun } from "../src/lib/db/legacy-ownership.ts";

/*
 * F10 database foundation. No Atlas account is needed: config, parsing, an unreachable server (127.0.0.1:1),
 * connection reuse, schema/index setup (recording fake) and the ownership-migration plan are all tested offline.
 * A live Atlas check runs only when MONGODB_URI_TEST is set (a throwaway database), otherwise it is reported as skipped.
 */

const SECRET_URI = "mongodb://exampleuser:S3cretPassw0rd@127.0.0.1:1/?serverSelectionTimeoutMS=300&connectTimeoutMS=300";
const saved = { ...process.env };
beforeEach(async () => {
  await closeDatabase();
  for (const k of ["MONGODB_URI", "MONGODB_DB", "MONGODB_TIMEOUT_MS"]) delete process.env[k];
});
after(async () => {
  await closeDatabase();
  Object.assign(process.env, saved);
});

test("1. missing MONGODB_URI: clear configuration error, no connection attempted", async () => {
  const config = readMongoConfig({});
  assert.equal(config.ok, false);
  assert.equal(!config.ok && config.problem, "missing");
  assert.throws(() => getMongoClient(), DatabaseConfigError);
  await assert.rejects(getDatabase(), DatabaseConfigError);
});

test("2. invalid connection strings are rejected before connecting, without echoing them", () => {
  for (const uri of ["http://example.com", "mongodb://", "postgres://u:p@h/db", "   "]) {
    const config = readMongoConfig({ MONGODB_URI: uri });
    assert.equal(config.ok, false, uri);
  }
  assert.equal(readMongoConfig({ MONGODB_URI: "mongodb+srv://u:p@cluster0.example.mongodb.net/", MONGODB_DB: "bad name!" }).ok, false, "bad database name");
  process.env.MONGODB_URI = "mongodb://user:pa@ss@word@host:notaport/";
  try {
    getMongoClient();
    assert.fail("should not parse");
  } catch (error) {
    assert.ok(error instanceof DatabaseConfigError);
    assert.doesNotMatch((error as Error).message, /pa@ss|word@host/);
  }
});

test("3. valid settings: defaults and explicit database name", () => {
  assert.deepEqual(readMongoConfig({ MONGODB_URI: "mongodb+srv://u:p@cluster0.example.mongodb.net/?retryWrites=true" }), { ok: true, uri: "mongodb+srv://u:p@cluster0.example.mongodb.net/?retryWrites=true", dbName: "explivio" });
  assert.equal((readMongoConfig({ MONGODB_URI: "mongodb://localhost:27017", MONGODB_DB: "explivio_test" }) as { dbName: string }).dbName, "explivio_test");
});

test("4. database unavailable: a safe DatabaseUnavailableError, no credentials in the message", { timeout: 20_000 }, async () => {
  process.env.MONGODB_URI = SECRET_URI;
  process.env.MONGODB_TIMEOUT_MS = "300";
  const error = await getDatabase().then(() => null, (e: unknown) => e);
  assert.ok(error instanceof DatabaseUnavailableError, String(error));
  assert.match((error as Error).message, /could not reach the cluster|connection failed/);
  assert.doesNotMatch((error as Error).message, /S3cret|exampleuser|127\.0\.0\.1/);
});

test("5. one shared client per process: reused across calls, replaced only when settings change", () => {
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=300";
  const a = getMongoClient();
  const b = getMongoClient();
  assert.equal(a, b, "same client");
  process.env.MONGODB_DB = "other_db";
  assert.notEqual(getMongoClient(), a, "new client after a settings change");
});

/** Records what ensureSchema asks the database to do. */
function fakeDb(existing: string[] = []) {
  const calls: { createCollection: [string, unknown][]; collMod: string[]; indexes: [string, object, { name: string; unique?: boolean; expireAfterSeconds?: number }][] } = { createCollection: [], collMod: [], indexes: [] };
  const db = {
    listCollections: () => ({ toArray: async () => existing.map((name) => ({ name })) }),
    createCollection: async (name: string, options: unknown) => { calls.createCollection.push([name, options]); },
    command: async (cmd: { collMod: string }) => { calls.collMod.push(cmd.collMod); return { ok: 1 }; },
    collection: (name: string) => ({ createIndex: async (key: object, options: { name: string }) => { calls.indexes.push([name, key, options]); return options.name; } }),
  };
  return { db: db as unknown as Parameters<typeof ensureSchema>[0], calls };
}

test("6. schema setup creates every collection (validators on users and videoProjects) and all indexes; idempotent", async () => {
  const fresh = fakeDb();
  const result = await ensureSchema(fresh.db);
  assert.deepEqual(result.createdCollections.sort(), Object.values(COLLECTIONS).sort());
  assert.ok(fresh.calls.createCollection.some(([n, o]) => n === "users" && JSON.stringify(o).includes("$jsonSchema")));
  assert.equal(fresh.calls.indexes.length, INDEXES.length);
  const again = fakeDb(Object.values(COLLECTIONS));
  const second = await ensureSchema(again.db);
  assert.deepEqual(second.createdCollections, [], "nothing created the second time");
  assert.deepEqual(again.calls.collMod.sort(), Object.keys(VALIDATORS).sort(), "validators refreshed in place");
});

test("7. duplicate emails are prevented by a unique index on the normalised email (and the validator requires it)", () => {
  const spec = INDEXES.find((i) => i.collection === "users" && "emailNormalized" in i.key);
  assert.ok(spec?.options.unique, "unique index on emailNormalized");
  const required = (VALIDATORS.users as { $jsonSchema: { required: string[] } }).$jsonSchema.required;
  assert.ok(required.includes("emailNormalized") && required.includes("passwordHash"));
  const hashRule = (VALIDATORS.users as { $jsonSchema: { properties: { passwordHash: { pattern: string } } } }).$jsonSchema.properties.passwordHash.pattern;
  assert.equal(new RegExp(hashRule).test("plaintext-password"), false, "a plaintext password fails validation");
});

test("8. ownership indexes: every user-owned collection is indexed by owner, newest first; TTL on sessions and tokens", () => {
  const has = (c: string, key: Record<string, number>) => INDEXES.some((i) => i.collection === c && JSON.stringify(i.key) === JSON.stringify(key));
  assert.ok(has("videoProjects", { ownerUserId: 1, createdAt: -1 }));
  assert.ok(has("videoProjects", { ownerUserId: 1, status: 1, createdAt: -1 }));
  assert.ok(has("generationAttempts", { ownerUserId: 1, createdAt: -1 }));
  assert.ok(has("generationAttempts", { videoId: 1, createdAt: -1 }));
  for (const c of ["sessions", "emailTokens"]) assert.equal(INDEXES.find((i) => i.collection === c && "expiresAt" in i.key)?.options.expireAfterSeconds, 0, `${c} TTL`);
  const ownerPattern = (VALIDATORS.videoProjects as { $jsonSchema: { required: string[] } }).$jsonSchema.required;
  assert.ok(ownerPattern.includes("ownerUserId"), "a project can't be stored without an owner");
});

test("9. health check answers only a status word and latency", async () => {
  const logs: string[] = [];
  delete process.env.MONGODB_URI;
  assert.deepEqual(await checkDatabase(async () => ({ ok: 1 }), (l) => logs.push(l)), { status: "not_configured", latencyMs: null });
  process.env.MONGODB_URI = SECRET_URI;
  const ok = await checkDatabase(async () => ({ ok: 1 }), (l) => logs.push(l));
  assert.equal(ok.status, "ok");
  assert.deepEqual(Object.keys(ok).sort(), ["latencyMs", "status"]);
  const down = await checkDatabase(async () => { throw new Error(`connect ECONNREFUSED to ${SECRET_URI}`); }, (l) => logs.push(l));
  assert.deepEqual(down, { status: "unavailable", latencyMs: null });
  assert.ok(logs.every((l) => !l.includes("S3cret") && !l.includes("exampleuser")), logs.join(" | "));
});

test("10. no secret leakage: redaction of URIs and password-like values; startup warning names the variable, not the value", () => {
  assert.equal(redact(`failed ${SECRET_URI}`).includes("S3cret"), false);
  assert.match(redact("mongodb+srv://u:p@h.net/x"), /^mongodb\+srv:\/\/\*\*\*@h\.net\/x$/);
  assert.equal(redact("authSource=admin&password=abc&x=1"), "authSource=admin&password=***&x=1");
  assert.doesNotMatch(safeReason(new Error(`MongoServerError: bad auth : Authentication failed. ${SECRET_URI}`)), /S3cret|exampleuser/);
  assert.match(safeReason(new Error("querySrv ENOTFOUND _mongodb._tcp.cluster0.example.mongodb.net")), /host not found/);
  const missing = readMongoConfig({});
  assert.ok(!missing.ok && /MONGODB_URI/.test(missing.message));
});

// Old-video ownership migration (designed, not executed).
const run = (id: string, extra: Partial<LegacyRun> = {}): LegacyRun => ({ id, title: id, prompt: "p", durationSeconds: 30, status: "ready", createdAt: "2026-11-01T00:00:00.000Z", ...extra });
const verified = { id: "usr_00000000000000000000000000000001", emailVerified: true, status: "active" as const };

test("legacy ownership: assigns only to the configured, existing, verified account; never reassigns", () => {
  const runs = [run("a"), run("b"), run("c", { requestOwnerUserId: "usr_x" })];
  const plan = planLegacyOwnership(runs, new Set(["b"]), "me@example.com", verified);
  assert.deepEqual(plan.toAssign, ["a"], "b already has a record; c belongs to a newer account");
  assert.equal(plan.canApply, true);
  assert.equal(planLegacyOwnership(runs, new Set(), undefined, verified).canApply, false, "email not configured");
  assert.equal(planLegacyOwnership(runs, new Set(), "me@example.com", null).owner, "not_found");
  assert.equal(planLegacyOwnership(runs, new Set(), "me@example.com", { ...verified, emailVerified: false }).canApply, false, "unverified account");
  assert.equal(planLegacyOwnership(runs, new Set(), "me@example.com", { ...verified, status: "disabled" }).canApply, false);
  assert.equal(planLegacyOwnership(runs, new Set(["a", "b"]), "me@example.com", verified).canApply, false, "idempotent: nothing left to do");
  const doc = legacyProjectDoc(runs[0], verified.id, new Date("2026-11-03T00:00:00Z"));
  assert.deepEqual(doc.storage, { kind: "local-run", runId: "a" }, "file stays in runs/a");
  assert.equal(doc.ownerUserId, verified.id);
});

test("live Atlas: connect, create schema, enforce unique email (needs MONGODB_URI_TEST)", { skip: !process.env.MONGODB_URI_TEST && "MONGODB_URI_TEST not set: no live cluster configured" }, async () => {
  process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
  process.env.MONGODB_DB = `explivio_test_${process.pid}`;
  const db = await getDatabase();
  try {
    await ensureSchema(db);
    const users = db.collection("users");
    const doc = { _id: "usr_0000000000000000000000000000000a", email: "A@example.com", emailNormalized: "a@example.com", name: "A", passwordHash: "scrypt$x", emailVerified: false, status: "active", authProvider: "local", createdAt: new Date(), updatedAt: new Date() };
    await users.insertOne(doc as never);
    await assert.rejects(users.insertOne({ ...doc, _id: "usr_0000000000000000000000000000000b" } as never), /E11000/);
    await assert.rejects(users.insertOne({ ...doc, _id: "usr_0000000000000000000000000000000c", emailNormalized: "c@example.com", passwordHash: "plain" } as never), /validation/i);
  } finally {
    await db.dropDatabase();
  }
});
