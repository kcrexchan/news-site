# Bay Area Fishing Data Fetch — Overnight Run Plan (12:00 AM, Aug 16 → 17)

## Goal
Produce a consolidated, real-values report for all 8 fishing areas and deliver it
automatically at midnight. No frontend, no dashboard — data only.

## Scope — 8 locations
| Location      | Tide station | NDBC buoy | Coastal |
|---------------|--------------|-----------|---------|
| Half Moon Bay | 9414523      | 46042     | yes     |
| Santa Cruz    | 9413450      | 46012     | yes     |
| Antioch       | 9415144      | —         | no      |
| Brentwood     | 9415144      | —         | no      |
| Tracy         | 9415144      | —         | no      |
| Bethel Island | 9415144      | —         | no      |
| Oakley        | 9416131      | —         | no      |
| Hogback       | 9416131      | —         | no      |

## Metrics & sources (all verified working as of this run)
1. **Air temp / humidity / pressure** — NWS `api.weather.gov` station observations.
   - Station picked per location: candidates capped at 4, scored by
     completeness (temp+RH+pressure all present) > freshness (≤26 h) > distance.
   - Rows with `qualityControl="Z"` or null values are skipped.
   - Unit normalization: NWS labels all `degC`; inland ASOS values verified
     against raw METAR (always °C) — KLVK 30 °C, KSCK 33 °C, KCCR 31 °C are
     genuine Central Valley heat, NOT °F mislabels. `_c()` helper kept as a
     safety net for real `degF` codes.
   - Known gap: **Santa Cruz has no nearby NWS station reporting barometric
     pressure** (C9585 is the freshest; it carries no pressure field).
2. **Water temp + swell (WVHT / DPD / MWD) + air pressure + ATMP** — NDBC
   `realtime2/<buoy>.txt` (buoy 46042 HMB, 46012 Santa Cruz).
   - Column map (after 5 time fields): 5=WDIR 6=WSPD 7=GST 8=WVHT 9=DPD
     10=APD 11=MWD 12=PRES 13=ATMP 14=WTMP.
   - `MM` = missing (HMB buoy occasionally drops swell fields).
3. **High/low tide (time + height)** — NOAA Tides & Currents `datagetter`,
   `product=predictions`, `datum=MLLW`, `units=metric`, `time_zone=lst_ldt`.
   - Wider window (D-1 → D+1) fetched, filtered to target day → every tide is
     an interior extremum, no boundary artifacts.
   - Extrema: sign-change detector over the 6-minute series (robust to flat
     plateaus like Port Chicago's 11:12–11:30 low).
   - `product=high_low` confirmed unsupported at all 8 stations (tested).
4. **Moon phase + Sun rise/set + Moon rise/set** — `astral==3.2`
   (Observer/sunrise/sunset/moonrise/moonset/phase), tz `America/Los_Angeles`.

## Execution (12:00 AM, local) — DONE
- **Script**: `C:/Users/kcrex/news-site/fetch_all.py` — date is dynamic
  (`datetime.now(America/Los_Angeles)`), tide window D-1→D+1 computed at run
  time, HTTP responses cached to avoid timeouts.
- **Runner**: `C:/Users/kcrex/AppData/Local/hermes/scripts/bay_area_fishing_report.sh`
  → `cd` into news-site, `uv run --with astral==3.2 python fetch_all.py`,
  then print a compact human-readable digest from `fishing_report.json`.
  Exit non-zero on script failure so the cron error path alerts.
- **Cron**: job `7394a1b4fe22` "Bay Area Fishing Report (midnight)",
  schedule `0 0 * * *` (midnight Pacific, host-local), `no_agent=True`
  (script-only, zero tokens), deliver → `telegram:8914993039`.
  Next run: **2026-08-17T00:00:00-07:00**.
- **Output**: `fishing_report.json` (full structured data) + a plain-text
  digest (8 locations × all metrics, gaps flagged).
- **Moon phase note**: astral `phase()` returns moon AGE IN DAYS (0–29.53),
  not a 0–1 fraction. Normalize by the synodic month (29.530588 d);
  illumination = (1 − cos(2πf))/2. Cross-checked Aug 16 2026 → Waxing
  Crescent ~15–20% (matches customcalendarmaker/moongiant/phase moon).

## Verified baseline (this evening's run, exit 0)
- HMB: 16 °C, RH 93.8 %, 1018.0 hPa | tides 2H (03:24, 16:00) 2L (09:36, 22:24)
  | buoy WTMP 16.5 °C
- Santa Cruz: 20.6 °C, RH 73.4 %, pressure n/a | tides 2H 2L | WTMP 15.8 °C,
  WVHT 0.9 m, DPD 12 s
- Antioch/KCCR: 31 °C, RH 31.2 %, 1015.2 hPa | Brentwood/KLVK: 29 °C, RH 35 %
- Tracy/KSCK: 33 °C, RH 31.8 %, 1014.2 hPa | Oakley: 31 °C | Hogback/KSUU:
  32.5 °C, RH 24.9 %, 1014.2 hPa
- Sun/moon: sunrise 06:22–06:26, sunset 19:56–20:00 PDT; moonrise ~10:45–10:49,
  moonset ~21:56–22:00; phase ~0.77 Waning Gibbous
- Tides: 2 highs + 2 lows each station (Antioch-family shows 1 low on Aug 16 —
  the evening low falls at 00:12 Aug 17, i.e. belongs to the next day)

## Known gaps (accepted, flagged in report)
- Santa Cruz: no barometric pressure from any nearby NWS station.
- HMB buoy 46042: swell fields (`MM`) intermittently missing.
- Inland locations: no water temp / swell (no buoys) — by design.
