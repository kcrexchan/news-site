import { getCloudflareContext } from "@opennextjs/cloudflare";

// Shared Tetris leaderboard backed by an R2 bucket binding.
//   GET  -> current top-10 list
//   POST -> submit {name, score, level, lines}; returns the updated list
// Concurrency is handled with optimistic locking: we read the object's ETag,
// then PUT with that ETag as a precondition. If someone else wrote in the
// meantime, R2 rejects the PUT (412) and we re-read + re-merge + retry.

const OBJECT_KEY = "leaderboard/tetris.json";
const MAX_ENTRIES = 10;
const MAX_RETRIES = 5;

function bucket(env) {
  return env.TETRIS_LEADERBOARD;
}

function emptyBoard() {
  return { updated: new Date(0).toISOString(), scores: [] };
}

function normalizeBoard(raw) {
  if (!raw || typeof raw !== "object") return emptyBoard();
  const scores = Array.isArray(raw.scores) ? raw.scores : Array.isArray(raw) ? raw : [];
  const clean = scores
    .map((e) => ({
      name: String(e?.name ?? "PLAYER").slice(0, 12) || "PLAYER",
      score: Math.max(0, Math.floor(Number(e?.score) || 0)),
      level: Math.max(1, Math.floor(Number(e?.level) || 1)),
      lines: Math.max(0, Math.floor(Number(e?.lines) || 0)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  return {
    updated: typeof raw.updated === "string" ? raw.updated : new Date(0).toISOString(),
    scores: clean,
  };
}

function mergeEntry(board, entry) {
  const scores = board.scores.map((s) => ({ ...s }));
  scores.push({
    name: String(entry.name ?? "PLAYER").trim().slice(0, 12) || "PLAYER",
    score: Math.max(0, Math.floor(Number(entry.score) || 0)),
    level: Math.max(1, Math.floor(Number(entry.level) || 1)),
    lines: Math.max(0, Math.floor(Number(entry.lines) || 0)),
  });
  scores.sort((a, b) => b.score - a.score);
  return { updated: new Date().toISOString(), scores: scores.slice(0, MAX_ENTRIES) };
}

function json(res, status, body, headers = {}) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.json(body);
  return res;
}

// Read the board + its ETag (for conditional writes).
async function readBoard(bkt) {
  const obj = await bkt.get(OBJECT_KEY);
  if (!obj) return { board: emptyBoard(), etag: null };
  const text = await obj.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { board: normalizeBoard(parsed), etag: obj.httpEtag ?? null };
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
      const { board } = await readBoard(bkt);
      return json(res, 200, board);
    }

    if (req.method === "POST") {
      const body = req.body ?? {};
      const score = Math.floor(Number(body.score));
      if (!Number.isFinite(score) || score <= 0) {
        return json(res, 400, { error: "A positive integer score is required" });
      }
      const entry = {
        name: body.name,
        score,
        level: body.level,
        lines: body.lines,
      };

      // Optimistic-concurrency loop: read -> merge -> conditional put.
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { board, etag } = await readBoard(bkt);
        const next = mergeEntry(board, entry);
        const putOpts = {
          httpMetadata: { contentType: "application/json" },
        };
        // Only send a precondition when we read an existing object; the first
        // write (object absent, etag null) must not carry one.
        if (etag) putOpts.httpEtag = etag;
        try {
          await bkt.put(OBJECT_KEY, JSON.stringify(next), putOpts);
          return json(res, 200, next);
        } catch (err) {
          // 412 Precondition Failed == someone else wrote first -> retry.
          const status = err?.status ?? err?.statusCode;
          if (status === 412) continue;
          throw err;
        }
      }
      return json(res, 409, { error: "Could not save your score due to a conflict — please try again" });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: "Failed to reach leaderboard storage", detail: String(e) });
  }
}
