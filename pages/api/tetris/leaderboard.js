import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  verifyIdentity,
  loginOrCreateIdentity,
  deleteIdentity,
  normalizeName,
  nameKey,
  validPin,
} from "../../../lib/leaderboard-identity";

// Tetris leaderboard with PIN-protected accounts (shared identity across all
// games), backed by an R2 bucket binding. Also still accepts the legacy
// anonymous {name, score, level, lines} POST for backward compatibility.
//
// RANKING MODEL
//   Each account stores `best` — the player's HIGHEST Tetris score (higher is
//   better). Submitting a score keeps the MAX of the stored best and the new
//   value. Legacy anonymous scores are kept in a separate `scores` array.
//   The public board merges both sources, sorted by score descending, top 10.
//
//   GET  -> { updated, scores: [ {name, score, level, lines} x10 ] }
//   POST -> { action, ... }
//     action "create" : { name, pin }          -> create account (best starts null)
//     action "login"  : { name, pin }          -> verify PIN, return best + board
//     action "score"  : { name, pin, score, level, lines } -> verify PIN, keep max
//     action "delete" : { name, pin }          -> verify PIN, remove the account
//     action "board"  : same as GET
//     (no action)    : legacy anonymous {name, score, level, lines} -> append to scores
//
// Concurrency: optimistic locking — read the object ETag, PUT with that ETag as
// a precondition; on 412 (someone wrote first) re-read + re-merge + retry.

const OBJECT_KEY = "leaderboard/tetris.json";
const MAX_ENTRIES = 10;
const MAX_RETRIES = 5;
const MAX_SCORE = 1000000;

function emptyDoc() {
  return { updated: new Date(0).toISOString(), accounts: {}, scores: [] };
}

function coerceScore(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_SCORE, n);
}
function coerceLevel(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
function coerceLines(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Derive the public top-N board from the account table + legacy scores.
function publicBoard(doc) {
  const rows = [];
  // Account bests (one row per account).
  for (const key of Object.keys(doc.accounts)) {
    const a = doc.accounts[key];
    if (a.best == null) continue;
    rows.push({
      name: a.name,
      score: a.best,
      level: a.level || 1,
      lines: a.lines || 0,
      at: a.last || a.created || new Date(0).toISOString(),
    });
  }
  // Legacy anonymous scores.
  for (const s of doc.scores) {
    rows.push({ name: s.name, score: s.score, level: s.level, lines: s.lines, at: s.ts || new Date(0).toISOString() });
  }
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { updated: doc.updated, scores: rows.slice(0, MAX_ENTRIES) };
}

function normalizeDoc(raw) {
  if (!raw || typeof raw !== "object") return emptyDoc();
  const accounts = {};
  const srcAcct = raw.accounts && typeof raw.accounts === "object" ? raw.accounts : {};
  for (const key of Object.keys(srcAcct)) {
    const a = srcAcct[key] || {};
    const best = a.best == null || !Number.isFinite(Number(a.best)) ? null : Math.min(MAX_SCORE, Math.floor(Number(a.best)));
    accounts[key] = {
      name: String(a.name || key).slice(0, 12) || "PLAYER",
      // Keep salt + pinHash so lazy migration into the shared identity store
      // can verify legacy accounts. Never exposed by publicBoard().
      salt: String(a.salt || ""),
      pinHash: String(a.pinHash || ""),
      best,
      level: Math.max(1, Math.floor(Number(a.level) || 1)),
      lines: Math.max(0, Math.floor(Number(a.lines) || 0)),
      created: typeof a.created === "string" ? a.created : new Date(0).toISOString(),
      last: typeof a.last === "string" ? a.last : new Date(0).toISOString(),
    };
  }
  const scores = Array.isArray(raw.scores) ? raw.scores : Array.isArray(raw) ? raw : [];
  const cleanScores = scores
    .map((e) => ({
      name: String(e?.name ?? "PLAYER").slice(0, 12) || "PLAYER",
      score: Math.max(0, Math.floor(Number(e?.score) || 0)),
      level: Math.max(1, Math.floor(Number(e?.level) || 1)),
      lines: Math.max(0, Math.floor(Number(e?.lines) || 0)),
      ts: typeof e?.ts === "string" ? e.ts : new Date(0).toISOString(),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  return {
    updated: typeof raw.updated === "string" ? raw.updated : new Date(0).toISOString(),
    accounts,
    scores: cleanScores,
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
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { doc: normalizeDoc(parsed), etag: obj.httpEtag ?? null };
}

async function withLock(bkt, mutate) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { doc, etag } = await readDoc(bkt);
    const result = await mutate(doc);
    if (!result || result.write === false) return result || { ok: false, status: 400, body: { error: "Unknown error" } };
    const putOpts = { httpMetadata: { contentType: "application/json" } };
    if (etag) putOpts.httpEtag = etag;
    try {
      await bkt.put(OBJECT_KEY, JSON.stringify(doc), putOpts);
      return { ok: true, status: result.status || 200, body: result.body };
    } catch (err) {
      const status = err?.status ?? err?.statusCode;
      if (status === 412) continue;
      throw err;
    }
  }
  return { ok: false, status: 409, body: { error: "Could not save — please try again" } };
}

export default async function handler(req, res) {
  let env;
  try { ({ env } = getCloudflareContext()); } catch (e) {
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
        if (!ident.ok) return json(res, 409, { error: ident.error });
        const now = new Date().toISOString();
        const result = await withLock(bkt, (d) => {
          const key = nameKey(name);
          if (d.accounts[key]) {
            const a = d.accounts[key];
            return { write: false, status: 200, body: { ok: true, name: a.name, best: a.best, board: publicBoard(d) } };
          }
          d.accounts[key] = { name, best: null, level: 1, lines: 0, created: now, last: now };
          d.updated = now;
          return { write: true, status: 200, body: { ok: true, name, best: null, board: publicBoard(d) } };
        });
        return json(res, result.status, result.body);
      }

      if (action === "login") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        // Read the game store so verifyIdentity can lazy-migrate legacy
        // accounts that still carry salt+pinHash in the tetris store.
        const { doc } = await readDoc(bkt);
        const ident = await verifyIdentity(bkt, name, pin, doc);
        if (!ident.ok) return json(res, 404, { error: ident.error });
        const a = doc.accounts[nameKey(name)];
        if (a) return json(res, 200, { ok: true, name: a.name, best: a.best, board: publicBoard(doc) });
        // Identity valid but no Tetris row yet — auto-create.
        const now = new Date().toISOString();
        const result = await withLock(bkt, (d) => {
          const key = nameKey(name);
          if (d.accounts[key]) return { write: false, status: 200, body: null };
          d.accounts[key] = { name, best: null, level: 1, lines: 0, created: now, last: now };
          d.updated = now;
          return { write: true, status: 200, body: { ok: true, name, best: null, board: publicBoard(d) } };
        });
        if (result.body) return json(res, 200, result.body);
        const { doc: d2 } = await readDoc(bkt);
        const a2 = d2.accounts[nameKey(name)];
        if (a2) return json(res, 200, { ok: true, name: a2.name, best: a2.best, board: publicBoard(d2) });
        return json(res, 404, { error: "No such account — create one first" });
      }

      if (action === "score") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const score = coerceScore(body.score);
        if (score == null) return json(res, 400, { error: "A positive integer score is required" });
        const level = coerceLevel(body.level);
        const lines = coerceLines(body.lines);
        const key = nameKey(name);
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const ident = await verifyIdentity(bkt, name, pin, doc);
          if (!ident.ok) return { write: false, status: 401, body: { error: ident.error } };
          const a = doc.accounts[key];
          const best = a && a.best != null ? Math.max(a.best, score) : score;
          doc.accounts[key] = {
            name: a ? a.name : name,
            best,
            level: score >= (a?.best || 0) ? level : (a?.level || level),
            lines: score >= (a?.best || 0) ? lines : (a?.lines || lines),
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
          if (!ident.ok) return { write: false, status: 401, body: { error: ident.error } };
          delete doc.accounts[key];
          doc.updated = now;
          return { write: true, status: 200, body: { ok: true, name, deleted: true, board: publicBoard(doc) } };
        });
        if (result.status === 200 && result.body?.ok) await deleteIdentity(bkt, name);
        return json(res, result.status, result.body);
      }

      // Legacy anonymous score (old client: {name, score, level, lines}, no action).
      if (!action) {
        const name = normalizeName(body.name);
        const score = coerceScore(body.score);
        if (score == null) return json(res, 400, { error: "A positive integer score is required" });
        const level = coerceLevel(body.level);
        const lines = coerceLines(body.lines);
        const now = new Date().toISOString();
        const result = await withLock(bkt, (doc) => {
          doc.scores.push({ name, score, level, lines, ts: now });
          doc.scores.sort((a, b) => b.score - a.score);
          doc.scores = doc.scores.slice(0, MAX_ENTRIES);
          doc.updated = now;
          return { write: true, status: 200, body: { ok: true, board: publicBoard(doc) } };
        });
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
