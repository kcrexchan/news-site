/**
 * Shared leaderboard identity store.
 *
 * One PIN account (name + 4-digit PIN) works across ALL games.
 * The shared store holds the identity (salt + pinHash); each game
 * keeps its own score store (wallet / best-ms / best-score).
 *
 * R2 bucket: TETRIS_LEADERBOARD (same bucket as all game stores)
 * Object key: leaderboard/accounts.json
 *
 * HASH SCHEME — MUST match the live Blackjack/Reaction APIs exactly:
 *   pinHash = sha256Hex(salt + ":" + pin)   (Web Crypto, 16-byte hex salt)
 *
 * Lazy migration: existing Blackjack/Reaction accounts that still
 * carry salt+pinHash in their per-game store are migrated into the
 * shared store on first access (idempotent, no data loss).
 */

const ACCOUNTS_KEY = "leaderboard/accounts.json";

// ── Web Crypto helpers (CF Workers + Node 18+ both expose globalThis.crypto) ──
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufToHex(digest);
}
async function randomSaltHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr);
}
async function hashPin(pin, salt) {
  return sha256Hex(salt + ":" + pin);
}
// Timing-safe-ish compare (constant-length hex).
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Name normalization (identical to the live APIs) ──────────────
function normalizeName(raw) {
  const n = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12)
    .trim();
  return n || "PLAYER";
}
function nameKey(name) {
  return normalizeName(name).toLowerCase();
}
function validPin(pin) {
  return typeof pin === "string" && /^\d{4}$/.test(pin);
}

// ── Shared store read/write ────────────────────────────────────
async function readAccounts(bkt) {
  const obj = await bkt.get(ACCOUNTS_KEY);
  if (!obj) return { accounts: {}, updated: new Date(0).toISOString() };
  const text = await obj.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object") {
    return { accounts: {}, updated: new Date(0).toISOString() };
  }
  const accounts = {};
  const src = parsed.accounts && typeof parsed.accounts === "object" ? parsed.accounts : {};
  for (const key of Object.keys(src)) {
    const a = src[key] || {};
    if (!a.salt || !a.pinHash) continue; // skip malformed rows
    accounts[key] = {
      name: typeof a.name === "string" && a.name ? a.name : key,
      salt: String(a.salt),
      pinHash: String(a.pinHash),
      created: typeof a.created === "string" ? a.created : new Date(0).toISOString(),
    };
  }
  return {
    updated: typeof parsed.updated === "string" ? parsed.updated : new Date(0).toISOString(),
    accounts,
  };
}

async function writeAccounts(bkt, data) {
  data.updated = new Date().toISOString();
  await bkt.put(ACCOUNTS_KEY, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
  return data;
}

// ── Identity operations ────────────────────────────────────────

/**
 * Verify a PIN against the shared identity store.
 * Falls back to the game store for lazy migration of pre-existing
 * accounts that still carry salt+pinHash locally.
 *
 * @param {object} bkt       - R2 bucket
 * @param {string} name      - account name (will be normalized)
 * @param {string} pin       - 4-digit PIN
 * @param {object|null} gameStore - parsed game store (for migration), or null
 * @returns {Promise<{ok:boolean, name?:string, error?:string, migrated?:boolean}>}
 */
async function verifyIdentity(bkt, name, pin, gameStore) {
  const key = nameKey(name);
  const store = await readAccounts(bkt);
  const acct = store.accounts[key];

  if (acct) {
    const expect = await hashPin(pin, acct.salt);
    if (!safeEqual(expect, acct.pinHash)) {
      return { ok: false, error: "Wrong PIN" };
    }
    return { ok: true, name: normalizeName(name) };
  }

  // Not in shared store yet — try lazy migration from the game store.
  const gameAcct =
    gameStore && gameStore.accounts && typeof gameStore.accounts === "object"
      ? gameStore.accounts[key]
      : null;

  if (gameAcct && gameAcct.salt && gameAcct.pinHash) {
    const expect = await hashPin(pin, gameAcct.salt);
    if (!safeEqual(expect, gameAcct.pinHash)) {
      return { ok: false, error: "Wrong PIN" };
    }
    // Migrate identity into the shared store (idempotent).
    store.accounts[key] = {
      name: normalizeName(name),
      salt: String(gameAcct.salt),
      pinHash: String(gameAcct.pinHash),
      created:
        typeof gameAcct.created === "string" ? gameAcct.created : new Date().toISOString(),
    };
    await writeAccounts(bkt, store);
    return { ok: true, name: normalizeName(name), migrated: true };
  }

  return { ok: false, error: "No such account — create one first" };
}

/**
 * Create-or-migrate identity. Used by the "create" action.
 *
 * 1. If identity already in shared store → "already exists"
 * 2. If identity in game store (with salt+pinHash) → verify PIN, migrate
 * 3. Otherwise → create new identity in shared store
 *
 * @returns {Promise<{ok:boolean, name?:string, error?:string, migrated?:boolean}>}
 */
async function createOrMigrateIdentity(bkt, name, pin, gameStore) {
  const key = nameKey(name);
  const store = await readAccounts(bkt);

  if (store.accounts[key]) {
    return { ok: false, error: "That name is already taken — try logging in" };
  }

  // Try migration from the game store.
  const gameAcct =
    gameStore && gameStore.accounts && typeof gameStore.accounts === "object"
      ? gameStore.accounts[key]
      : null;

  if (gameAcct && gameAcct.salt && gameAcct.pinHash) {
    const expect = await hashPin(pin, gameAcct.salt);
    if (!safeEqual(expect, gameAcct.pinHash)) {
      return { ok: false, error: "Wrong PIN" };
    }
    store.accounts[key] = {
      name: normalizeName(name),
      salt: String(gameAcct.salt),
      pinHash: String(gameAcct.pinHash),
      created:
        typeof gameAcct.created === "string" ? gameAcct.created : new Date().toISOString(),
    };
    await writeAccounts(bkt, store);
    return { ok: true, name: normalizeName(name), migrated: true };
  }

  // Brand-new identity.
  const salt = await randomSaltHex();
  const pinHash = await hashPin(pin, salt);
  const created = new Date().toISOString();
  store.accounts[key] = { name: normalizeName(name), salt, pinHash, created };
  await writeAccounts(bkt, store);
  return { ok: true, name: normalizeName(name) };
}

/**
 * Create an identity in the shared store only if it does not already exist.
 * Returns { ok:true, created:true } on fresh create, { ok:false, error } if the
 * identity already exists (caller should surface a 409 / "try logging in").
 *
 * Used by the "create" action so that a name already known to ANY game is
 * rejected consistently — one account per name across all games.
 */
async function createIdentityIfAbsent(bkt, name, pin) {
  const key = nameKey(name);
  const store = await readAccounts(bkt);
  if (store.accounts[key]) {
    return { ok: false, error: "That name is already taken — try logging in" };
  }
  const salt = await randomSaltHex();
  const pinHash = await hashPin(pin, salt);
  const created = new Date().toISOString();
  store.accounts[key] = { name: normalizeName(name), salt, pinHash, created };
  await writeAccounts(bkt, store);
  return { ok: true, created: true, name: normalizeName(name) };
}

/**
 * Idempotent "ensure I'm logged in" — used by the "create" action so that
 * creating an account in one game doesn't break creating in another.
 *
 * - Identity exists + PIN correct  -> { ok:true, created:false, name }
 * - Identity exists + PIN wrong    -> { ok:false, error:"Wrong PIN" }
 * - Identity absent (any game store has it + PIN correct) -> migrate, { ok:true, created:true }
 * - Identity absent (no game store) -> fresh create, { ok:true, created:true }
 *
 * @returns {Promise<{ok:boolean, name?:string, created?:boolean, error?:string}>}
 */
async function loginOrCreateIdentity(bkt, name, pin, gameStore) {
  const key = nameKey(name);
  const store = await readAccounts(bkt);
  const acct = store.accounts[key];

  if (acct) {
    const expect = await hashPin(pin, acct.salt);
    if (!safeEqual(expect, acct.pinHash)) {
      return { ok: false, error: "Wrong PIN" };
    }
    return { ok: true, created: false, name: normalizeName(name) };
  }

  // Try migration from the game store.
  const gameAcct =
    gameStore && gameStore.accounts && typeof gameStore.accounts === "object"
      ? gameStore.accounts[key]
      : null;

  if (gameAcct && gameAcct.salt && gameAcct.pinHash) {
    const expect = await hashPin(pin, gameAcct.salt);
    if (!safeEqual(expect, gameAcct.pinHash)) {
      return { ok: false, error: "Wrong PIN" };
    }
    store.accounts[key] = {
      name: normalizeName(name),
      salt: String(gameAcct.salt),
      pinHash: String(gameAcct.pinHash),
      created:
        typeof gameAcct.created === "string" ? gameAcct.created : new Date().toISOString(),
    };
    await writeAccounts(bkt, store);
    return { ok: true, created: true, name: normalizeName(name) };
  }

  // Brand-new identity.
  const salt = await randomSaltHex();
  const pinHash = await hashPin(pin, salt);
  const created = new Date().toISOString();
  store.accounts[key] = { name: normalizeName(name), salt, pinHash, created };
  await writeAccounts(bkt, store);
  return { ok: true, created: true, name: normalizeName(name) };
}

/**
 * Delete an identity from the shared store.
 * (Game-specific score data is deleted separately by each game API.)
 */
async function deleteIdentity(bkt, name) {
  const key = nameKey(name);
  const store = await readAccounts(bkt);
  if (!store.accounts[key]) {
    return { ok: false, error: "No such account — create one first" };
  }
  delete store.accounts[key];
  await writeAccounts(bkt, store);
  return { ok: true };
}

module.exports = {
  ACCOUNTS_KEY,
  bufToHex,
  sha256Hex,
  randomSaltHex,
  hashPin,
  safeEqual,
  normalizeName,
  nameKey,
  validPin,
  readAccounts,
  writeAccounts,
  verifyIdentity,
  createOrMigrateIdentity,
  createIdentityIfAbsent,
  loginOrCreateIdentity,
  deleteIdentity,
};
