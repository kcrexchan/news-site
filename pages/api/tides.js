import tideStations from "../../data/tide-stations";

/**
 * Tide predictions proxy — stateless passthrough to NOAA CO-OPS datagetter.
 * No persistence, so no Cloudflare context needed (unlike the balloon
 * leaderboard route).
 *
 * GET /api/tides?station=<slug>&date=YYYY-MM-DD
 *   -> 200 { station, date, hilo: [{time,height,type}], curve: [{time,height}] }
 *
 * GET /api/tides?station=<slug>&month=YYYY-MM&mode=monthly-lows
 *   -> 200 { station, month, lowestTides: [{time,height}] } (up to 5, ascending)
 *
 * GET /api/tides?station=<slug>&month=YYYY-MM&mode=all-station-lows-month
 *   -> 200 { month, monthLabel, results: [...] } for EVERY station: the 5
 *      lowest low-tide heights within that single calendar month, ascending.
 *
 * GET /api/tides?station=<slug>&year=YYYY&mode=all-station-lows
 *   -> 200 { year, results: [{ station, ok, error, lowestTides }] } for EVERY
 *      station: the 5 lowest low-tide heights across the *entire calendar year*,
 *      ascending (lowest first). Failures degrade gracefully — that station's
 *      entry has ok:false. The `station` param is required but ignored in this
 *      mode — the page fetches all locations at once.
 *
 * NOTE: NOAA datagetter has no meaningful single-query range cap; one call per
 * station returns the full year (verified: ~1400+ hilo events for a year). We
 * fetch the whole year in a single NOAA call per station and slice the lowest
 * 5 lows from that union — no per-month fan-out needed.
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
async function fetchNoaa(noaaId, compactDate, extraParams, compactEndDate) {
  const params = new URLSearchParams({
    product: "predictions",
    datum: "MLLW",
    // NOAA validates this strictly — accepted values are gmt | lst | lst_ldt.
    time_zone: "lst_ldt",
    units: "english",
    format: "json",
    station: noaaId,
    begin_date: compactDate,
    end_date: compactEndDate || compactDate,
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

// Turn a NOAA hilo response into the top-5 lowest lows (ascending). Returns
// { ok: false, error } on failure so callers can degrade gracefully instead
// of throwing — reused by both the single-station and cross-station modes.
function lowestFromHilo(hiloRes) {
  if (hiloRes.error) return { ok: false, error: hiloRes.error };
  const lowestTides = hiloRes.rows
    .filter((r) => r.type === "L")
    .sort((a, b) => a.height - b.height) // ascending — lowest first
    .slice(0, 5)
    .map(({ time, height }) => ({ time, height }));
  return { ok: true, lowestTides };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  const slug = String(req.query.station || "").trim();
  const date = String(req.query.date || "").trim();
  const mode = String(req.query.mode || "").trim();

  if (!slug) return json(res, 400, { error: "Missing required query param 'station' (a station slug)." });

  // ---- Mode: monthly-lows — top-5 lowest tides for a calendar month ----
  if (mode === "monthly-lows") {
    const MONTH_RE = /^\d{4}-\d{2}$/;
    const month = String(req.query.month || "").trim();
    if (!MONTH_RE.test(month)) {
      return json(res, 400, { error: "Missing or invalid 'month' — expected format YYYY-MM." });
    }

    const station = tideStations.find((s) => s.slug === slug);
    if (!station) return json(res, 404, { error: `Unknown station '${slug}'.` });

    const yearNum = parseInt(month.slice(0, 4), 10);
    const monthNum = parseInt(month.slice(5, 7), 10);
    if (monthNum < 1 || monthNum > 12) {
      return json(res, 400, { error: "Invalid 'month' — expected format YYYY-MM." });
    }

    // Day-0 of the following month = last day of the requested month. Correct
    // for every month including February (leap years included).
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const compactMonth = month.replace(/-/g, "");
    const beginDate = `${compactMonth}01`;
    const endDate = `${compactMonth}${String(lastDay).padStart(2, "0")}`;

    // One NOAA call: hilo events across the whole month.
    const hiloRes = await fetchNoaa(station.noaaId, beginDate, { interval: "hilo" }, endDate);
    const lowRes = lowestFromHilo(hiloRes);
    if (!lowRes.ok) return json(res, 502, { error: lowRes.error });

    res.setHeader("Cache-Control", "public, max-age=3600");
    return json(res, 200, { station, month, lowestTides: lowRes.lowestTides });
  }

  // ---- Cross-station month mode: lowest-5 lows for EVERY station, within a
  // single calendar month (YYYY-MM). Fan-out structure identical to
  // all-station-lows, but each station's data is sliced to that month only —
  // i.e. monthly-lows's single-station logic applied across all 9 stations.
  // Failures degrade gracefully: one bad station's entry has ok:false.
  if (mode === "all-station-lows-month") {
    const MONTH_RE = /^\d{4}-\d{2}$/;
    const month = String(req.query.month || "").trim();
    if (!MONTH_RE.test(month)) {
      return json(res, 400, { error: "Missing or invalid 'month' — expected format YYYY-MM." });
    }

    const yearNum = parseInt(month.slice(0, 4), 10);
    const monthNum = parseInt(month.slice(5, 7), 10);
    if (monthNum < 1 || monthNum > 12) {
      return json(res, 400, { error: "Invalid 'month' — expected format YYYY-MM." });
    }

    // Day-0 of the following month = last day of the requested month. Correct
    // for every month including February (leap years included).
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const compactMonth = month.replace(/-/g, "");
    const beginDate = `${compactMonth}01`;
    const endDate = `${compactMonth}${String(lastDay).padStart(2, "0")}`;

    // Display-friendly month label, e.g. "Sep 2026". Use the 15th so month-end
    // months never roll over (any in-month day is safe).
    const monthLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      year: "numeric",
    }).format(new Date(Date.UTC(yearNum, monthNum - 1, 15)));

    const results = await Promise.all(
      tideStations.map(async (station) => {
        const hiloRes = await fetchNoaa(station.noaaId, beginDate, { interval: "hilo" }, endDate);
        const lowRes = lowestFromHilo(hiloRes);
        if (!lowRes.ok) return { station, ok: false, error: lowRes.error, lowestTides: [] };
        return { station, ok: true, error: null, lowestTides: lowRes.lowestTides };
      })
    );

    res.setHeader("Cache-Control", "public, max-age=3600");
    return json(res, 200, { month, monthLabel, results });
  }

  // ---- Cross-station mode: lowest-5 lows for EVERY station, from the request
  // day (inclusive) through the end of that calendar year ----
  // Decoupled from the selected station — the page shows this as an always-on
  // summary regardless of what station is picked in the dropdown. One NOAA call
  // per station for the (possibly partial) year; failures degrade gracefully so
  // one bad station doesn't sink the whole page. We take the 5 lowest lows from
  // the station's data between today and year-end (not per month).
  //
  // "Today" is evaluated in the stations' own timezone (all stations below are
  // Pacific / America/Los_Angeles), independent of the server's local TZ. If the
  // requested year is NOT the current year (past/future), we fall back to the
  // full year (Jan 1) since "today" only makes sense within the current year.
  if (mode === "all-station-lows") {
    const YEAR_RE = /^\d{4}$/;
    const year = String(req.query.year || "").trim();
    if (!YEAR_RE.test(year)) {
      return json(res, 400, { error: "Missing or invalid 'year' — expected format YYYY." });
    }

    const yearNum = parseInt(year, 10);
    // Evaluate "today" in the stations' own TZ (America/Los_Angeles). All 9
    // stations are Pacific, so this is correct regardless of server TZ.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const todayMonth = parts.find((p) => p.type === "month").value; // "09"
    const todayDay = parts.find((p) => p.type === "day").value; // "12"
    const currentYear = parts.find((p) => p.type === "year").value; // "2026"
    const beginDate = String(yearNum) === currentYear
      ? `${year}${todayMonth}${todayDay}` // this year: start at today (inclusive), YYYYMMDD
      : `${year}0101`; // past/future year: "today" doesn't exist there → full year
    const endDate = `${year}1231`;
    // A display-friendly start date in the stations' own TZ, e.g. "Sep 12, 2026".
    // The start is "today" only within the current year; past/future years
    // begin at Jan 1 (the fallback beginDate). Client renders "from {startLabel}
    // through {year}-12-31" so the range is unambiguous. beginDate is a compact
    // YYYYMMDD, which `new Date()` can't parse, so split it into components and
    // build a UTC date from them.
    const [sy, sm, sd] = [
      parseInt(beginDate.slice(0, 4), 10),
      parseInt(beginDate.slice(4, 6), 10),
      parseInt(beginDate.slice(6, 8), 10),
    ];
    const startLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(Date.UTC(sy, sm - 1, sd, 12)));
    const endDateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(yearNum, 11, 31));

    const results = await Promise.all(
      tideStations.map(async (station) => {
        const hiloRes = await fetchNoaa(station.noaaId, beginDate, { interval: "hilo" }, endDate);
        const lowRes = lowestFromHilo(hiloRes);
        if (!lowRes.ok) return { station, ok: false, error: lowRes.error, lowestTides: [] };
        return { station, ok: true, error: null, lowestTides: lowRes.lowestTides };
      })
    );

    res.setHeader("Cache-Control", "public, max-age=3600");
    return json(res, 200, { year, startLabel, endDateLabel, results });
  }

  // ---- Default mode: single-day tide events + water-level curve (unchanged) ----
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

  // The hilo table is the primary content — if it fails, there's nothing to show.
  if (hiloRes.error) return json(res, 502, { error: hiloRes.error });

  // The 6-minute curve is a nice-to-have. Some NOAA stations are "subordinate"
  // (harmonic offsets from a reference station) and only support hi/lo
  // predictions, not a continuous curve — that's a real NOAA limitation, not
  // a bug. Degrade gracefully: keep the hilo table, drop the chart, and say
  // why instead of failing the whole request.
  const body = {
    station,
    date,
    hilo: hiloRes.rows.map((r) => ({ time: r.time, height: r.height, type: r.type })),
    curve: curveRes.error ? [] : curveRes.rows.map(({ time, height }) => ({ time, height })),
    curveUnavailable: curveRes.error
      ? "This station only publishes high/low tide predictions — a full water-level curve isn't available."
      : null,
  };

  res.setHeader("Cache-Control", "public, max-age=3600");
  return json(res, 200, body);
}
