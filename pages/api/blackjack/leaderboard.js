import { getCloudflareContext } from "@opennextjs/cloudflare";

// Blackjack leaderboard with PIN-protected accounts, backed by an R2 bucket
// binding (same TETRIS_LEADERBOARD bucket as the Tetris board — separate object
// key). Accounts hold a salted SHA-256 hash of their 4-digit PIN; the plain PIN
// is never stored. The public board is the top-10 by best balance, derived at
// read time from the account table.
//
//   GET  -> { updated, scores: [ {name, best, blackjacks, at} x10 ] }
//   POST -> { action, ... }
//     action "create" : { name, pin } -> create account (rejects dup name)
//     action "login"  : { name, pin } -> verify PIN, return account summary
//     action "score"  : { name, pin, best, blackjacks } -> verify PIN,
//                         update account (best = max), recompute board
//     action "board"  : same as GET
//
// Concurrency: optimistic locking — read the object ETag, PUT with that ETag as
// a precondition; on 412 (someone wrote first) re-read + re-merge + retry.

const OBJECT_KEY = "leaderboard/blackjack.json";
const MAX_ENTRIES = 10;
const MAX_RETRIES = 5;

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

function bucket(env) {
  return env.TETRIS_LEADERBOARD;
}

function emptyDoc() {
  return { updated: new Date(0).toISOString(), accounts: {} };
}

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

// Derive the public top-N board from the account table.
function publicBoard(doc) {
  const rows = Object.keys(doc.accounts).map((key) => {
    const a = doc.accounts[key];
    return {
      name: a.name,
      best: Math.max(0, Math.floor(Number(a.best) || 0)),
      blackjacks: Math.max(0, Math.floor(Number(a.blackjacks) || 0)),
      at: a.last || a.created || new Date(0).toISOString(),
    };
  });
  rows.sort((x, y) => y.best - x.best || y.blackjacks - x.blackjacks || x.name.localeCompare(y.name));
  return { updated: doc.updated, scores: rows.slice(0, MAX_ENTRIES) };
}

function normalizeDoc(raw) {
  if (!raw || typeof raw !== "object") return emptyDoc();
  const accounts = {};
  const src = raw.accounts && typeof raw.accounts === "object" ? raw.accounts : {};
  for (const key of Object.keys(src)) {
    const a = src[key] || {};
    accounts[key] = {
      name: String(a.name || key).slice(0, 12) || "PLAYER",
      salt: String(a.salt || ""),
      pinHash: String(a.pinHash || ""),
      best: Math.max(0, Math.floor(Number(a.best) || 0)),
      blackjacks: Math.max(0, Math.floor(Number(a.blackjacks) || 0)),
      created: typeof a.created === "string" ? a.created : new Date(0).toISOString(),
      last: typeof a.last === "string" ? a.last : new Date(0).toISOString(),
    };
  }
  return {
    updated: typeof raw.updated === "string" ? raw.updated : new Date(0).toISOString(),
    accounts,
  };
}

function json(res, status, body, headers = {}) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.json(body);
  return res;
}

async function readDoc(bkt) {
  const obj = await bkt.get(OBJECT_KEY);
  if (!obj) return { doc: emptyDoc(), etag: null };
  const text = await obj.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { doc: normalizeDoc(parsed), etag: obj.httpEtag ?? null };
}

// Run a read-modify-write with optimistic locking. `mutate(doc)` returns
// { ok, status?, body? } or { ok:false, ... } to signal an app-level error.
async function withLock(bkt, mutate) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { doc, etag } = await readDoc(bkt);
    const result = await mutate(doc); // mutate() mutates `doc` in place
    if (!result.write) return result; // app-level error / no change -> respond as-is
    const putOpts = { httpMetadata: { contentType: "application/json" } };
    if (etag) putOpts.httpEtag = etag;
    try {
      await bkt.put(OBJECT_KEY, JSON.stringify(doc), putOpts);
      return { ok: true, status: result.status || 200, body: result.body };
    } catch (err) {
      const status = err?.status ?? err?.statusCode;
      if (status === 412) continue; // conflict -> retry
      throw err;
    }
  }
  return { ok: false, status: 409, body: { error: "Could not save — please try again" } };
}

export default async function handler(req, res) {
  let env;
  try {
    ({ env } = getCloudflareContext());
  } catch (e) {
    return json(res, 500, { error: "Cloudflare context unavailable", detail: String(e) });
  }
  if (!env || !env.TETRIS_LEADERBOARD) {
    return json(res, 500, { error: "TETRIS_LEADERBOARD R2 binding is not configured" });
  }
  const bkt = env.TETRIS_LEADERBOARD;

  try {
    if (req.method === "GET") {
      const { doc } = await readDoc(bkt);
      return json(res, 200, publicBoard(doc));
    }

    if (req.method === "POST") {
      const body = req.body ?? {};
      const action = String(body.action || "").toLowerCase();

      if (action === "board") {
        const { doc } = await readDoc(bkt);
        return json(res, 200, publicBoard(doc));
      }

      if (action === "create") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const salt = await randomSaltHex();
        const pinHash = await hashPin(pin, salt);
        const created = new Date().toISOString();
        const result = await withLock(bkt, (doc) => {
          const key = nameKey(name);
          if (doc.accounts[key]) {
            return { ok: false, write: false, status: 409, body: { error: "That name is already taken — try logging in" } };
          }
          doc.accounts[key] = { name, salt, pinHash, best: 0, blackjacks: 0, created, last: created };
          doc.updated = created;
          return { write: true, status: 200, body: { ok: true, name, board: publicBoard(doc) } };
        });
        return json(res, result.status, result.body);
      }

      if (action === "login" || action === "score") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const key = nameKey(name);

        if (action === "login") {
          const { doc } = await readDoc(bkt);
          const a = doc.accounts[key];
          if (!a) return json(res, 404, { error: "No such account — create one first" });
          const expect = await hashPin(pin, a.salt);
          if (!safeEqual(expect, a.pinHash)) return json(res, 401, { error: "Wrong PIN" });
          return json(res, 200, {
            ok: true,
            name: a.name,
            best: a.best,
            blackjacks: a.blackjacks,
            board: publicBoard(doc),
          });
        }

        // action === "score"
        const best = Math.max(0, Math.floor(Number(body.best) || 0));
        const blackjacks = Math.max(0, Math.floor(Number(body.blackjacks) || 0));
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const a = doc.accounts[key];
          if (!a) return { ok: false, write: false, status: 404, body: { error: "No such account — create one first" } };
          const expect = await hashPin(pin, a.salt);
          if (!safeEqual(expect, a.pinHash)) return { ok: false, write: false, status: 401, body: { error: "Wrong PIN" } };
          const newBest = Math.max(a.best, best);
          doc.accounts[key] = {
            ...a,
            best: newBest,
            blackjacks: blackjacks,
            last: now,
          };
          doc.updated = now;
          return { write: true, status: 200, body: { ok: true, name: a.name, best: newBest, board: publicBoard(doc) } };
        });
        return json(res, result.status, result.body);
      }

      return json(res, 400, { error: "Unknown action", actions: ["create", "login", "score", "board"] });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: "Failed to reach leaderboard storage", detail: String(e) });
  }
}
