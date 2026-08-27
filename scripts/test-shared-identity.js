/**
 * Test the SHARED leaderboard identity store (lib/leaderboard-identity.js).
 *
 * Proves:
 *   1. createIdentityIfAbsent creates a new identity.
 *   2. createIdentityIfAbsent rejects a duplicate.
 *   3. verifyIdentity accepts the correct PIN.
 *   4. verifyIdentity rejects a wrong PIN.
 *   5. verifyIdentity lazy-migrates a legacy per-game identity into the shared store.
 *   6. deleteIdentity removes the identity.
 *   7. hashPin matches the live sha256(salt + ":" + pin) scheme.
 *   8. normalizeName / nameKey are case-insensitive and trim.
 *   9. validPin accepts 4 digits, rejects others.
 *
 * Run: node scripts/test-shared-identity.js
 */
"use strict";
const assert = require("node:assert");
const id = require("../lib/leaderboard-identity.js");

// ── minimal in-memory R2 bucket ──────────────────────────────────────────────
function makeBucket() {
  const store = new Map();
  return {
    get: async (key) => {
      if (!store.has(key)) return null;
      const data = store.get(key);
      return { text: async () => data, httpEtag: `"etag-${store.size}"` };
    },
    put: async (key, value, _opts) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    // expose the raw store for test assertions
    _store: store,
  };
}

(async () => {
  const bkt = makeBucket();
  const SHARED_KEY = "leaderboard/accounts.json";

  // ── 7. hashPin matches the live scheme ────────────────────────────────────
  const salt = await id.randomSaltHex();
  const pinHash = await id.hashPin("4321", salt);
  assert.strictEqual(pinHash.length, 64, "pinHash is 64 hex chars");
  // Verify against a known Web Crypto computation.
  const { createHash } = require("node:crypto");
  const expected = createHash("sha256").update(salt + ":" + "4321").digest("hex");
  assert.strictEqual(pinHash, expected, "hashPin matches sha256(salt+':'+pin)");
  console.log("✓ hashPin matches live sha256(salt+':'+pin) scheme");

  // ── 9. validPin ───────────────────────────────────────────────────────────
  assert.strictEqual(id.validPin("1234"), true, "validPin accepts 4 digits");
  assert.strictEqual(id.validPin("9999"), true, "validPin accepts 9999");
  assert.strictEqual(id.validPin("123"), false, "validPin rejects 3 digits");
  assert.strictEqual(id.validPin("12345"), false, "validPin rejects 5 digits");
  assert.strictEqual(id.validPin("abcd"), false, "validPin rejects letters");
  assert.strictEqual(id.validPin(""), false, "validPin rejects empty");
  console.log("✓ validPin accepts 4 digits, rejects others");

  // ── 8. normalizeName / nameKey ────────────────────────────────────────────
  assert.strictEqual(id.normalizeName("  Rex  "), "Rex", "normalizeName trims");
  assert.strictEqual(id.normalizeName("Rex"), "Rex", "normalizeName preserves case");
  assert.strictEqual(id.nameKey("Rex"), "rex", "nameKey lowercases");
  assert.strictEqual(id.nameKey("  NOVA  "), "nova", "nameKey trims + lowercases");
  console.log("✓ normalizeName / nameKey case-insensitive and trim");

  // ── 1. createIdentityIfAbsent creates a new identity ─────────────────────
  let r = await id.createIdentityIfAbsent(bkt, "Rex", "4321");
  assert.strictEqual(r.ok, true, "create Rex ok");
  assert.strictEqual(r.created, true, "create Rex created=true");
  let raw = JSON.parse(bkt._store.get(SHARED_KEY));
  assert.ok(raw.accounts["rex"], "shared store has 'rex'");
  assert.strictEqual(raw.accounts["rex"].name, "Rex", "shared store name");
  assert.strictEqual(raw.accounts["rex"].pinHash.length, 64, "shared store pinHash");
  assert.strictEqual(raw.accounts["rex"].salt.length, 32, "shared store salt (16 bytes = 32 hex)");
  console.log("✓ createIdentityIfAbsent creates a new identity");

  // ── 2. createIdentityIfAbsent rejects a duplicate ────────────────────────
  r = await id.createIdentityIfAbsent(bkt, "rex", "9999");
  assert.strictEqual(r.ok, false, "duplicate create rejected");
  assert.ok(r.error, "duplicate create has error");
  console.log("✓ createIdentityIfAbsent rejects a duplicate");

  // ── 3. verifyIdentity accepts the correct PIN ────────────────────────────
  r = await id.verifyIdentity(bkt, "Rex", "4321", null);
  assert.strictEqual(r.ok, true, "verify correct PIN ok");
  assert.strictEqual(r.name, "Rex", "verify returns name");
  console.log("✓ verifyIdentity accepts the correct PIN");

  // ── 4. verifyIdentity rejects a wrong PIN ────────────────────────────────
  r = await id.verifyIdentity(bkt, "Rex", "9999", null);
  assert.strictEqual(r.ok, false, "verify wrong PIN rejected");
  assert.ok(r.error, "verify wrong PIN has error");
  console.log("✓ verifyIdentity rejects a wrong PIN");

  // ── 5. verifyIdentity lazy-migrates a legacy identity ────────────────────
  // Seed a legacy per-game account (salt+pinHash in the game store, NOT in shared).
  const legacySalt = await id.randomSaltHex();
  const legacyHash = await id.hashPin("1357", legacySalt);
  const now = new Date().toISOString();
  await bkt.put(
    "leaderboard/blackjack.json",
    JSON.stringify({
      updated: now,
      accounts: { legacy: { name: "Legacy", salt: legacySalt, pinHash: legacyHash, wallet: 4200 } },
    }),
    {}
  );
  // Ensure 'legacy' is NOT in the shared store yet.
  raw = JSON.parse(bkt._store.get(SHARED_KEY));
  assert.ok(!raw.accounts["legacy"], "legacy not in shared store before verify");

  // Verify with the legacy per-game doc → should lazy-migrate.
  const legacyDoc = { accounts: { legacy: { name: "Legacy", salt: legacySalt, pinHash: legacyHash } } };
  r = await id.verifyIdentity(bkt, "Legacy", "1357", legacyDoc);
  assert.strictEqual(r.ok, true, "legacy verify ok");
  assert.strictEqual(r.name, "Legacy", "legacy verify name");
  // Now 'legacy' should be in the shared store.
  raw = JSON.parse(bkt._store.get(SHARED_KEY));
  assert.ok(raw.accounts["legacy"], "legacy migrated into shared store");
  assert.strictEqual(raw.accounts["legacy"].pinHash, legacyHash, "legacy pinHash carried over");
  assert.strictEqual(raw.accounts["legacy"].salt, legacySalt, "legacy salt carried over");
  console.log("✓ verifyIdentity lazy-migrates a legacy identity into the shared store");

  // ── 6. deleteIdentity removes the identity ───────────────────────────────
  r = await id.deleteIdentity(bkt, "Rex");
  assert.strictEqual(r.ok, true, "delete Rex ok");
  raw = JSON.parse(bkt._store.get(SHARED_KEY));
  assert.ok(!raw.accounts["rex"], "rex removed from shared store");
  console.log("✓ deleteIdentity removes the identity");

  // ── verifyIdentity still works after migration for the migrated account ──
  r = await id.verifyIdentity(bkt, "Legacy", "1357", null);
  assert.strictEqual(r.ok, true, "migrated account verify ok");
  r = await id.verifyIdentity(bkt, "Legacy", "9999", null);
  assert.strictEqual(r.ok, false, "migrated account wrong PIN rejected");
  console.log("✓ migrated account continues to work (correct PIN ok, wrong PIN rejected)");

  console.log("\n✅ ALL SHARED-IDENTITY TESTS PASSED");
})().catch((e) => {
  console.error("❌ SHARED-IDENTITY TEST FAILED:", e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
