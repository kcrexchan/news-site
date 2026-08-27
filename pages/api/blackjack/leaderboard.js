import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  verifyIdentity,
  loginOrCreateIdentity,
  deleteIdentity,
  normalizeName,
  nameKey,
  validPin,
} from "../../../lib/leaderboard-identity";

// Blackjack leaderboard with PIN-protected accounts, backed by an R2 bucket
// binding (same TETRIS_LEADERBOARD bucket as the Tetris board — separate object
// key). Identity (name + salted SHA-256 PIN hash) now lives in a SHARED store
// (leaderboard/accounts.json) so one account works across ALL games; this file
// keeps the game-specific WALLET score store. The plain PIN is never stored.
//
// WALLET MODEL
//   Each account stores a `wallet` — the player's bankroll, which is the SAME
//   number as the in-game balance. It can go NEGATIVE (the player can lose more
//   than they started with). When the wallet can't cover the minimum bet the
//   player must BORROW from the casino to keep playing.
//   `borrow`  : wallet += 2000, debt += 2020 (1% interest on the $2000), borrows += 1
//   `debt`    : total owed to the casino (principal + interest), starts at 0.
//   `borrows` : how many times the player has borrowed from the casino.
//   Borrowing is unlimited in COUNT — but only while the player is BROKE:
//   the server rejects the loan whenever wallet >= MIN_BET (the player can
//   still start a hand). Once they lose down below the minimum bet again,
//   they can borrow again.
//
//   GET  -> { updated, scores: [ {name, wallet, debt, borrows, at} x10 ] }
//   POST -> { action, ... }
//     action "create" : { name, pin } -> create account (wallet starts at 1000)
//     action "login"  : { name, pin } -> verify PIN, return wallet/debt/borrows
//     action "score"  : { name, pin, wallet } -> verify PIN, set wallet (can be
//                        negative), recompute board
//     action "borrow" : { name, pin } -> verify PIN, wallet += 2000, debt += 2020 —
//                        only when wallet < MIN_BET; rejected otherwise (player can
//                        still start a hand)
//     action "repay"  : { name, pin } -> verify PIN, pay back the FULL debt only if
//                        wallet >= debt (debt cleared to 0); rejected otherwise so a
//                        player can never drive their own wallet negative by repaying
//     action "delete" : { name, pin } -> verify PIN, remove the account entirely
//     action "board"  : same as GET
//
// Concurrency: optimistic locking — read the object ETag, PUT with that ETag as
// a precondition; on 412 (someone wrote first) re-read + re-merge + retry.

const OBJECT_KEY = "leaderboard/blackjack.json";
const MAX_ENTRIES = 10;
const MAX_RETRIES = 5;

// Casino loan terms: $2000 at a time, 1% interest. A loan is only offered while
// the player is broke — i.e. their wallet can't cover the game's minimum bet.
// Keep MIN_BET in sync with MIN_BET in public/blackjack-game.html.
const MIN_BET = 10;
const LOAN_AMOUNT = 2000;
const LOAN_INTEREST = 0.01; // 1%
const LOAN_TOTAL = LOAN_AMOUNT + Math.round(LOAN_AMOUNT * LOAN_INTEREST); // 2020

function bucket(env) {
  return env.TETRIS_LEADERBOARD;
}

function emptyDoc() {
  return { updated: new Date(0).toISOString(), accounts: {} };
}

// Wallet can be negative (player owes the house) — only coerce to an integer.
function coerceWallet(v) {
  const n = Math.floor(Number(v) || 0);
  return Number.isFinite(n) ? n : 0;
}

// Derive the public top-N board from the account table (ranked by wallet).
function publicBoard(doc) {
  const rows = Object.keys(doc.accounts).map((key) => {
    const a = doc.accounts[key];
    return {
      name: a.name,
      wallet: Math.floor(Number(a.wallet) || 0),
      debt: Math.max(0, Math.floor(Number(a.debt) || 0)),
      borrows: Math.max(0, Math.floor(Number(a.borrows) || 0)),
      at: a.last || a.created || new Date(0).toISOString(),
    };
  });
  rows.sort((x, y) => y.wallet - x.wallet || x.name.localeCompare(y.name));
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
      // Keep salt + pinHash so lazy migration into the shared identity store
      // can verify legacy accounts (they still carry their PIN hash locally).
      // Never exposed by publicBoard() — only used for auth fallback.
      salt: String(a.salt || ""),
      pinHash: String(a.pinHash || ""),
      wallet: coerceWallet(a.wallet),
      debt: Math.max(0, Math.floor(Number(a.debt) || 0)),
      borrows: Math.max(0, Math.floor(Number(a.borrows) || 0)),
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
// { write:true, status?, body? } to persist, or { write:false, ... } for an
// app-level error / no change.
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
        // PIN and treat it as a successful "create". Legacy accounts that
        // still carry salt+pinHash in the blackjack store are lazy-migrated.
        const { doc } = await readDoc(bkt);
        const ident = await loginOrCreateIdentity(bkt, name, pin, doc);
        if (!ident.ok) {
          return json(res, 409, { error: ident.error });
        }

        // Create the wallet row (or return the existing one if the player
        // already had a Blackjack account — e.g. migrated from another game).
        const created = new Date().toISOString();
        const result = await withLock(bkt, (d) => {
          const key = nameKey(name);
          if (d.accounts[key]) {
            const a = d.accounts[key];
            return {
              write: false,
              status: 200,
              body: {
                ok: true,
                name: a.name,
                wallet: a.wallet,
                debt: a.debt,
                borrows: a.borrows,
                board: publicBoard(d),
              },
            };
          }
          d.accounts[key] = { name, wallet: 1000, debt: 0, borrows: 0, created, last: created };
          d.updated = created;
          return {
            write: true,
            status: 200,
            body: { ok: true, name, wallet: 1000, debt: 0, borrows: 0, board: publicBoard(d) },
          };
        });
        return json(res, result.status, result.body);
      }

      if (action === "login") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });

        // Read the game store so verifyIdentity can lazy-migrate legacy
        // accounts that still carry salt+pinHash in the blackjack store.
        const { doc } = await readDoc(bkt);
        const ident = await verifyIdentity(bkt, name, pin, doc);
        if (!ident.ok) return json(res, 404, { error: ident.error });

        const a = doc.accounts[nameKey(name)];
        if (!a) {
          // Identity is valid but no wallet row yet (e.g. created in another
          // game first). Auto-create the wallet row so the player can play.
          const now = new Date().toISOString();
          const result = await withLock(bkt, (d) => {
            const key = nameKey(name);
            if (d.accounts[key]) return { write: false, status: 200, body: null }; // race — re-read below
            d.accounts[key] = { name, wallet: 1000, debt: 0, borrows: 0, created: now, last: now };
            d.updated = now;
            return { write: true, status: 200, body: { ok: true, name, wallet: 1000, debt: 0, borrows: 0, board: publicBoard(d) } };
          });
          if (result.body) return json(res, 200, result.body);
          // Race: another request created the row — re-read and return it.
          const { doc: d2 } = await readDoc(bkt);
          const a2 = d2.accounts[nameKey(name)];
          if (a2) return json(res, 200, { ok: true, name: a2.name, wallet: a2.wallet, debt: a2.debt, borrows: a2.borrows, board: publicBoard(d2) });
          return json(res, 404, { error: "No such account — create one first" });
        }
        return json(res, 200, {
          ok: true,
          name: a.name,
          wallet: a.wallet,
          debt: a.debt,
          borrows: a.borrows,
          board: publicBoard(doc),
        });
      }

      if (action === "score") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const key = nameKey(name);
        const wallet = coerceWallet(body.wallet);
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const ident = await verifyIdentity(bkt, name, pin, doc);
          if (!ident.ok) return { ok: false, write: false, status: 401, body: { error: ident.error } };
          if (!doc.accounts[key]) {
            doc.accounts[key] = { name, wallet, debt: 0, borrows: 0, created: now, last: now };
          } else {
            doc.accounts[key] = { ...doc.accounts[key], wallet, last: now };
          }
          doc.updated = now;
          return { write: true, status: 200, body: { ok: true, name, wallet, board: publicBoard(doc) } };
        });
        return json(res, result.status, result.body);
      }

      if (action === "borrow") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const key = nameKey(name);
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const ident = await verifyIdentity(bkt, name, pin, doc);
          if (!ident.ok) return { ok: false, write: false, status: 401, body: { error: ident.error } };
          const a = doc.accounts[key];
          if (!a) return { ok: false, write: false, status: 404, body: { error: "No such account — create one first" } };
          // Borrowing is only for players who can't start a hand. If the wallet
          // still covers the minimum bet, there is no loan — play a hand instead.
          if (a.wallet >= MIN_BET) return { ok: false, write: false, status: 400, body: { error: "You can still cover a minimum bet — borrow only when you can't start a hand" } };
          const newWallet = a.wallet + LOAN_AMOUNT;
          const newDebt = a.debt + LOAN_TOTAL;
          doc.accounts[key] = { ...a, wallet: newWallet, debt: newDebt, borrows: a.borrows + 1, last: now };
          doc.updated = now;
          return {
            write: true,
            status: 200,
            body: {
              ok: true,
              name: a.name,
              wallet: newWallet,
              debt: newDebt,
              borrows: a.borrows + 1,
              loan: LOAN_AMOUNT,
              interest: LOAN_TOTAL - LOAN_AMOUNT,
              board: publicBoard(doc),
            },
          };
        });
        return json(res, result.status, result.body);
      }

      if (action === "repay") {
        const name = normalizeName(body.name);
        const pin = String(body.pin ?? "").trim();
        if (!validPin(pin)) return json(res, 400, { error: "PIN must be exactly 4 digits" });
        const key = nameKey(name);
        const now = new Date().toISOString();
        const result = await withLock(bkt, async (doc) => {
          const ident = await verifyIdentity(bkt, name, pin, doc);
          if (!ident.ok) return { ok: false, write: false, status: 401, body: { error: ident.error } };
          const a = doc.accounts[key];
          if (!a) return { ok: false, write: false, status: 404, body: { error: "No such account — create one first" } };
          if (a.debt <= 0) return { ok: false, write: false, status: 400, body: { error: "No debt to repay" } };
          // A player can only repay the FULL debt when their wallet covers it — never
          // let a short wallet drive itself negative by repaying (that would be paying
          // the casino with money they don't have). Partial repayment is not offered.
          if (a.wallet < a.debt) return { ok: false, write: false, status: 400, body: { error: "Wallet can't cover the full debt — win more before repaying" } };
          const paid = a.debt;
          const newWallet = a.wallet - paid;
          doc.accounts[key] = { ...a, wallet: newWallet, debt: 0, last: now };
          doc.updated = now;
          return {
            write: true,
            status: 200,
            body: {
              ok: true,
              name: a.name,
              wallet: newWallet,
              debt: 0,
              borrows: a.borrows,
              repaid: paid,
              board: publicBoard(doc),
            },
          };
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

      return json(res, 400, { error: "Unknown action", actions: ["create", "login", "score", "borrow", "repay", "delete", "board"] });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: "Failed to reach leaderboard storage", detail: String(e) });
  }
}
