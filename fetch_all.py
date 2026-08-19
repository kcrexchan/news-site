#!/usr/bin/env python3
"""Consolidated fetch report — 8 Bay-Area fishing areas.
Sources: NWS (air), NOAA T&C datagetter (tides), NDBC realtime2 (water/swell), astral (sun/moon).
Run:  uv run --with astral==3.2 python fetch_all.py
"""
import json, urllib.request
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from astral.moon import Observer, moonrise, moonset, phase
from astral.sun import sunrise, sunset

UA = {"User-Agent": "hermes-research/1.0 (contact: kcrex@example.com)"}
_cache = {}
def get(url, raw=False):
    key = (url, raw)
    if key in _cache:
        return _cache[key]
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        b = r.read()
    out = b.decode(errors="replace") if raw else json.loads(b.decode())
    _cache[key] = out
    return out

TZ = "America/Los_Angeles"
TZI = ZoneInfo(TZ)
NOW = datetime.now(timezone.utc)
D = datetime.now(TZI).date()  # tonight's target date, local
TIDE_START = (D - timedelta(days=1)).strftime("%Y%m%d")
TIDE_END   = (D + timedelta(days=1)).strftime("%Y%m%d")
def _ts(s):
    try: return datetime.fromisoformat(s)
    except Exception: return None
def _c(temp_obj):
    # normalize NWS temperature to Celsius (handles degC and degF)
    if not temp_obj or temp_obj.get("value") is None: return None
    v = temp_obj["value"]
    if temp_obj.get("unitCode","").endswith("degF"):
        v = (v - 32) * 5 / 9
    return round(v, 1)

def phase_name(f):
    # f: 0=new, 0.5=full, 1=cycle complete
    names = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous",
             "Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"]
    return names[int(round(f*8) % 8)]

def moon_illum(f):
    import math
    return round((1 - math.cos(2*math.pi*f)) / 2, 4)

LOCATIONS = [
    ("Half Moon Bay", 37.500, -122.430, "9414523", "46042", True),
    ("Santa Cruz",    36.974, -122.031, "9413450", "46012", True),
    ("Antioch",       38.007, -121.801, "9415144", None,    False),
    ("Brentwood",     37.944, -121.707, "9415144", None,    False),
    ("Tracy",         37.736, -121.446, "9415144", None,    False),
    ("Bethel Island", 37.911, -121.642, "9415144", None,    False),
    ("Oakley",        37.997, -121.695, "9416131", None,    False),
    ("Hogback",       38.137, -121.681, "9416131", None,    False),
]

report = {"date": str(D), "timezone": TZ, "locations": []}
SYNODIC = 29.530588
pf = phase(D) % SYNODIC / SYNODIC  # astral returns moon age in days; normalize to 0–1 cycle
report["moon"] = {"phase_fraction": round(pf, 4),
                  "illumination": moon_illum(pf),
                  "phase_name": phase_name(pf)}

for name, lat, lon, st, buoy, coastal in LOCATIONS:
    row = {"location": name, "coastal": coastal}
    # per-location sun/moon
    obs = Observer(lat, lon)
    row["sunrise"] = sunrise(obs, D, tzinfo=TZ).strftime("%H:%M")
    row["sunset"]  = sunset(obs, D, tzinfo=TZ).strftime("%H:%M")
    try:
        mr = moonrise(obs, D, tzinfo=TZ); row["moonrise"] = mr.strftime("%H:%M")
    except Exception: row["moonrise"] = None
    try:
        ms = moonset(obs, D, tzinfo=TZ); row["moonset"] = ms.strftime("%H:%M")
    except Exception: row["moonset"] = None
    # NWS air — pick the nearby station with valid readings, preferring fresh + complete
    try:
        pts = get(f"https://api.weather.gov/points/{lat},{lon}")
        st_url = pts["properties"]["observationStations"]
        cands = get(st_url)["features"][:4]  # NWS order = distance
        best = None  # (score, sid, p, ts)
        for rank, f in enumerate(cands):
            sid = f["id"]
            try:
                feats = get(sid + "/observations")["features"]
            except Exception:
                continue
            # scan recent rows, keep the most complete one (all-3 fields)
            p = None
            best_complete = -1
            for ff in feats[:12]:
                q = ff["properties"]
                if (q.get("temperature") or {}).get("value") is None:
                    continue
                g2 = lambda k: (q.get(k) or {}).get("value")
                comp = sum([g2("temperature") is not None,
                            g2("relativeHumidity") is not None,
                            g2("barometricPressure") is not None])
                if comp > best_complete:
                    best_complete = comp
                    p = q
            if p is None:
                continue
            ts = _ts(p.get("timestamp"))
            age_h = (NOW - ts).total_seconds()/3600 if ts else 9999
            fresh = age_h <= 26
            g = lambda k: (p.get(k) or {}).get("value")
            complete = sum([g("temperature") is not None,
                            g("relativeHumidity") is not None,
                            g("barometricPressure") is not None])
            # score: completeness dominates, then freshness, then distance
            score = 1000*complete + (100 if fresh else 0) - rank
            if best is None or score > best[0]:
                best = (score, sid, p, ts)
        if best is None:
            row["air_error"] = "no valid obs at any nearby station"
        else:
            _, sid, p, ts = best
            row["nws_station"] = sid.split("/")[-1]
            g = lambda k: (p.get(k) or {}).get("value")
            row["air"] = {
                "time_utc": p.get("timestamp"),
                "temp_C": _c(p.get("temperature")),
                "humidity_pct": round(g("relativeHumidity"), 1) if g("relativeHumidity") is not None else None,
                "pressure_hPa": round(g("barometricPressure")/100, 1) if g("barometricPressure") is not None else None,
                "wind_ms": g("windSpeed"),
            }
    except Exception as e:
        row["air_error"] = f"{type(e).__name__}: {e}"
    # tides (6-min predictions, compute local highs/lows)
    try:
        tj = get(f"https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&station={st}&format=json&begin_date={TIDE_START}&end_date={TIDE_END}&datum=MLLW&units=metric&time_zone=lst_ldt")
        preds = tj.get("predictions", [])
        day = D.strftime("%Y-%m-%d")
        if len(preds) >= 3:
            vs = [float(p["v"]) for p in preds]
            n = len(vs)
            # sign-change extrema over the wider window, then keep only the target day
            # (wider window => every target-day tide is an interior extremum, no boundary artifacts)
            highs, lows = [], []
            i = 0
            while i < n-1:
                d = vs[i+1]-vs[i]
                if d == 0:
                    i += 1
                    continue
                j = i
                while j < n-1 and (vs[j+1]-vs[j])*d > 0:
                    j += 1
                seg = list(range(i, j+1))
                if d > 0:
                    k = max(seg, key=lambda x: vs[x]); highs.append({"time": preds[k]["t"], "m": round(vs[k],3)})
                else:
                    k = min(seg, key=lambda x: vs[x]); lows.append({"time": preds[k]["t"], "m": round(vs[k],3)})
                i = j
            highs = [h for h in highs if h["time"].startswith(day)]
            lows  = [l for l in lows  if l["time"].startswith(day)]
            row["tides"] = {"station": st, "highs": highs, "lows": lows}
        else:
            row["tide_error"] = "no prediction rows"
    except Exception as e:
        row["tide_error"] = f"{type(e).__name__}: {e}"
    # water + swell
    if coastal and buoy:
        try:
            line = [l for l in get(f"https://www.ndbc.noaa.gov/data/realtime2/{buoy}.txt", raw=True).splitlines()
                    if l and not l.startswith("#")][0]
            f = line.split()
            # 0-4 time  5 WDIR 6 WSPD 7 GST 8 WVHT 9 DPD 10 APD 11 MWD 12 PRES 13 ATMP 14 WTMP
            row["water"] = {"buoy": buoy, "time": " ".join(f[:5]),
                            "wvht_m": f[8], "dpd_s": f[9], "mwd": f[11],
                            "pres_hPa": f[12], "atmp_C": f[13], "wtmp_C": f[14]}
        except Exception as e:
            row["water_error"] = f"{type(e).__name__}: {e}"
    report["locations"].append(row)
    print(json.dumps(row))

with open("fishing_report.json", "w") as fh:
    json.dump(report, fh, indent=2)
print("\nSAVED -> fishing_report.json")
