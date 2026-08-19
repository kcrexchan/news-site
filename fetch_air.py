#!/usr/bin/env python3
"""Resolve NWS station + latest observation (temp/humidity/pressure) for all 8 areas."""
import json, urllib.request, sys

UA = {"User-Agent": "hermes-research/1.0 (contact: kcrex@example.com)"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())

LOCATIONS = [
    ("Half Moon Bay",  37.500, -122.430),
    ("Santa Cruz",     36.974, -122.031),
    ("Antioch",        38.007, -121.801),
    ("Brentwood",      37.944, -121.707),
    ("Tracy",          37.736, -121.446),
    ("Bethel Island",  37.911, -121.642),
    ("Oakley",         37.997, -121.695),
    ("Hogback",        38.137, -121.681),
]

out = []
for name, lat, lng in LOCATIONS:
    row = {"location": name, "lat": lat, "lng": lng}
    try:
        pts = get(f"https://api.weather.gov/points/{lat},{lng}")
        stations_url = pts["properties"]["observationStations"]
        st = get(stations_url)["features"][0]["id"]
        row["nws_station"] = st
        obs = get(st + "/observations")["features"][0]["properties"]
        row["obs_time"] = obs.get("timestamp")
        row["temp_F"] = obs.get("temperature")
        row["dewpoint_F"] = obs.get("dewpoint")
        rh = obs.get("relativeHumidity")
        row["humidity_pct"] = round(rh, 1) if isinstance(rh, (int, float)) else rh
        pa = obs.get("barometricPressure")
        row["pressure_hPa"] = round(pa / 100, 1) if isinstance(pa, (int, float)) else pa
        row["wind_mph"] = (obs.get("windSpeed") or {}).get("value")
    except Exception as e:
        row["error"] = f"{type(e).__name__}: {e}"
    out.append(row)
    print(json.dumps(row))
