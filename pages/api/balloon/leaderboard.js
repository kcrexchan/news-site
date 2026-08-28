import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  verifyIdentity,
  loginOrCreateIdentity,
  deleteIdentity,
  normalizeName,
  nameKey,
  validPin,
} from "../../../lib/leaderboard-identity";

// Balloon-Pop leaderboard with PIN-protected accounts, backed by an R2
// bucket binding (same TETRIS_LEADERBOARD bucket as the other boards — separate
// object key). Identity (name + salted SHA-256 PIN hash) lives in the SHARED
// store (leaderboard/accounts.json) so one account works across ALL games; this
// file keeps the game-specific BEST-SCORE store. The plain PIN is never stored.
//
// RANKING MODEL
//   Each account stores `best` — the player's HIGHEST total score (sum of
//   banked balloon sizes over a 30-second round; higher is better). Submitting
//   a score keeps the HIGHER of the stored best and the new value, so the board
//   always reflects a player's personal record. An account that has never
//   submitted a score has `best = null` and ranks last.
//
//   GET  -> { updated, scores: [ {name, best, at} x10 ] }   (best = points | null)
//   POST -> { action, ... }
//     action "create" : { name, pin }        -> create account (best starts null)
//     action "login"  : { name, pin }        -> verify PIN, return best + board
//     action "score"  : { name, pin, best }  -> verify PIN, keep max(stored, new)
//     action "delete" : { name, pin }        -> verify PIN, remove the account
//     action "board"  : same as GET
//
// Concurrency: optimistic locking — read the object ETag, PUT with that ETag as
// a precondition; on 412 (someone wrote first) re-read + re-merge + retry.

const OBJECT_KEY = "leaderboard/balloon.json";
const MAX_ENTRIES = 10;
const MAX_RETRIES = 5;

// Sanity clamp so a tampered client can't post an impossible score. A 30s round
// physically tops out around ~2100 (30s of 7/tap at an infinite tap rate); we
// allow a generous ceiling so the board stays meaningful.
const MIN_BEST = 0;
const MAX_BEST = 999999;

function bucket(env) {
  return env.TETRIS_LEADERBOARD;
}

function emptyDoc() {
  return { updated: new Date(0).toISOString(), accounts: {} };
}
// Coerce a submitted score into a sane integer within the clamp.
function coerceBest(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(MIN_BEST, Math.min(MAX_BEST, n));
}

// Derive the public top-N board from the account table (ranked by best score,
// descending — highest first; null-best accounts rank last).
function publicBoard(doc) {
  const rows = Object.keys(doc.accounts).map((key) => {
    const a = doc.accounts[key];
    const best =
      a.best == null || !Number.isFinite(Number(a.best))
        ? null
        : Math.max(MIN_BEST, Math.min(MAX_BEST, Math.floor(Number(a.best))));
    return {
      name: a.name,
      best,
      at: a.last || a.created || new Date(0).toISOString(),
    };
  });
  rows.sort((x, y) => {
    const bx = x.best == null ? -1 : x.best;
    const by = y.best == null ? -1 : y.best;
    if (bx !== by) return by - bx;
    return x.name.localeCompare(y.name);
  });
  return { updated: doc.updated, scores: rows.slice(0, MAX_ENTRIES) };
}

function normalizeDoc(raw) {
  if (!raw || typeof raw !== "object") return emptyDoc();
  const accounts = {};
  const src = raw.accounts && typeof raw.accounts === "object" ? raw.accounts : {};
  for (const key of Object.keys(src)) {
    const a = src[key] || {};
    const best =
      a.best == null || !Number.isFinite(Number(a.best))
        ? null
        : Math.max(MIN_BEST, Math.min(MAX_BEST, Math.floor(Number(a.best))));
    accounts[key] = {
      name: String(a.name || key).slice(0, 12) || "PLAYER",
      // Keep salt + pinHash so lazy migration into the shared identity store
      // can verify legacy accounts (they still carry their PIN hash locally).
      // Never exposed by publicBoard() — only used for auth fallback.
      salt: String(a.salt || ""),
      pinHash: String(a.pinHash || ""),
      best,
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

// Run a read-modify-write with optimistic locking. `mutate(doc)` mutates `doc`
// in place and returns { write:true, status?, body? } to persist, or
// { write:false, ... } for an app-level error / no change.
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

        // Idempotent: create the identity in the shared store, or (if the
        // player already has a shared account from another game) verify the
        // PIN and treat it as a successful "create".
        const { doc } = await readDoc(bkt);
        const ident = await loginOrCreateIdentity(bkt, name, pin, doc);
        if (!ident.ok) {
          return json(res, 409, { error: ident.error });
        }

        // Create the best-score row (or return the existing one if the player
        // already had a Balloon account — e.g. created from another game).
        const created = new Date().toISOString();
        const result = await withLock(bkt, (d) => {
          const key = nameKey(name);
          if (d.accounts[key]) {
            const a = d.accounts[key];
            return {
              write: false,
              status: 200,
              body: { ok: true, name: a.name, best: a.best, board: publicBoard(d) },
            };
          }
          d.accounts[key] = { name, best: null, created, last: created };
          d.updated = created;
          return { write: true, status: 200, body: { ok: true, name, best: null, board: publicBoard(d) } };
        });
        return json(res, result.status, result.body);
      }

      if (action === "login") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });

        // Read the game store so verifyIdentity can lazy-migrate legacy
        // accounts that still carry salt+pinHash in the balloon store.
        const { doc } = await readDoc(bkt);
        const ident = await verifyIdentity(bkt, name, pin, doc);
        if (!ident.ok) return json(res, 404, { error: ident.error });

        const a = doc.accounts[nameKey(name)];
        if (!a) {
          // Identity is valid but no best-score row yet (created in another
          // game first). Auto-create the row so the player can submit a score.
          const now = new Date().toISOString();
          const result = await withLock(bkt, (d) => {
            const key = nameKey(name);
            if (d.accounts[key]) return { write: false, status: 200, body: null }; // race — re-read below
            d.accounts[key] = { name, best: null, created: now, last: now };
            d.updated = now;
            return { write: true, status: 200, body: { ok: true, name, best: null, board: publicBoard(d) } };
          });
          if (result.body) return json(res, 200, result.body);
          const { doc: d2 } = await readDoc(bkt);
          const a2 = d2.accounts[nameKey(name)];
          if (a2) return json(res, 200, { ok: true, name: a2.name, best: a2.best, board: publicBoard(d2) });
          return json(res, 404, { error: "No such account — create one first" });
        }
        return json(res, 200, {
          ok: true,
          name: a.name,
          best: a.best,
          board: publicBoard(doc),
        });
      }

      if (action === "score") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const key = nameKey(name);
        const submitted = coerceBest(body.best);
        if (submitted == null) return json(res, 400, { error: "A score is required" });
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const ident = await verifyIdentity(bkt, name, pin, doc);
          if (!ident.ok) return { ok: false, write: false, status: 401, body: { error: ident.error } };
          const a = doc.accounts[key];
          // Keep the player's personal best: the HIGHER of stored and new.
          const best = a && a.best != null ? Math.max(a.best, submitted) : submitted;
          doc.accounts[key] = {
            name: a ? a.name : name,
            best,
            created: a ? a.created : now,
            last: now,
          };
          doc.updated = now;
          return { write: true, status: 200, body: { ok: true, name: a ? a.name : name, best, board: publicBoard(doc) } };
        });
        return json(res, result.status, result.body);
      }

      if (action === "delete") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const key = nameKey(name);
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const ident = await verifyIdentity(bkt, name, pin, doc);
          if (!ident.ok) return { ok: false, write: false, status: 401, body: { error: ident.error } };
          delete doc.accounts[key];
          doc.updated = now;
          return { write: true, status: 200, body: { ok: true, name, deleted: true, board: publicBoard(doc) } };
        });
        // Also delete the identity from the shared store.
        if (result.status === 200 && result.body?.ok) {
          await deleteIdentity(bkt, name);
        }
        return json(res, result.status, result.body);
      }

      return json(res, 400, { error: "Unknown action", actions: ["create", "login", "score", "delete", "board"] });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: "Failed to reach leaderboard storage", detail: String(e) });
  }
}
