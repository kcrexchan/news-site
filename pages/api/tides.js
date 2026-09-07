import tideStations from "../../data/tide-stations";

/**
 * Tide predictions proxy — stateless passthrough to NOAA CO-OPS datagetter.
 * No persistence, so no Cloudflare context needed (unlike the balloon
 * leaderboard route).
 *
 * GET /api/tides?station=<slug>&date=YYYY-MM-DD
 *   -> 200 { station, date, hilo: [{time,height,type}], curve: [{time,height}] }
 *
 * NOAA shape (verified against the live API):
 *   { "predictions": [ { "t": "2026-09-10 04:43", "v": "-0.264", "type": "L" }, ... ] }
 * `v` is a STRING (feet relative to MLLW); hilo entries carry type H or L.
 */

const NOAA_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.json(body);
  return res;
}

// Fetch one NOAA datagetter call and normalize to [{time, height}].
async function fetchNoaa(noaaId, compactDate, extraParams) {
  const params = new URLSearchParams({
    product: "predictions",
    datum: "MLLW",
    // NOAA validates this strictly — accepted values are gmt | lst | lst_ldt.
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
    station: noaaId,
    begin_date: compactDate,
    end_date: compactDate,
  });
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) params.set(k, v);
  }

  let resp;
  try {
    resp = await fetch(`${NOAA_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    return { error: "Could not reach the NOAA tide service — check your connection and try again." };
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    return { error: `NOAA returned an unreadable response (HTTP ${resp.status}).` };
  }

  // NOAA's failure shape: { "error": { "message": "..." } }
  if (data && typeof data === "object" && data.error) {
    const msg =
      (typeof data.error === "string" ? data.error : data.error.message) ||
      "NOAA returned an error for that request.";
    return { error: msg };
  }

  if (!Array.isArray(data.predictions)) {
    return { error: "Unexpected response shape from NOAA — no predictions array." };
  }

  const rows = [];
  for (const p of data.predictions) {
    if (!p || typeof p.t !== "string" || p.v == null || p.v === "M") continue; // skip missing values
    const height = Number(p.v);
    if (!Number.isFinite(height)) continue;
    rows.push({ time: p.t, height, type: p.type != null ? String(p.type) : null });
  }

  return { rows };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const slug = String(req.query.station || "").trim();
  const date = String(req.query.date || "").trim();

  if (!slug) return json(res, 400, { error: "Missing required query param 'station' (a station slug)." });
  if (!DATE_RE.test(date)) {
    return json(res, 400, { error: "Missing or invalid 'date' — expected format YYYY-MM-DD." });
  }

  const station = tideStations.find((s) => s.slug === slug);
  if (!station) return json(res, 404, { error: `Unknown station '${slug}'.` });

  // Strip dashes -> compact YYYYMMDD for NOAA's begin_date/end_date.
  const compactDate = date.replace(/-/g, "");

  // Call A: hilo events (interval=hilo). Call B: full 6-minute curve (no interval param).
  const [hiloRes, curveRes] = await Promise.all([
    fetchNoaa(station.noaaId, compactDate, { interval: "hilo" }),
    fetchNoaa(station.noaaId, compactDate),
  ]);

  if (hiloRes.error) return json(res, 502, { error: hiloRes.error });
  if (curveRes.error) return json(res, 502, { error: curveRes.error });

  const body = {
    station,
    date,
    hilo: hiloRes.rows.map((r) => ({ time: r.time, height: r.height, type: r.type })),
    curve: curveRes.rows.map(({ time, height }) => ({ time, height })),
  };

  res.setHeader("Cache-Control", "public, max-age=3600");
  return json(res, 200, body);
}
