"""Weather tool: current conditions via Open-Meteo (no API key required)."""
from __future__ import annotations

import httpx

from .base import Tool

_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather interpretation codes -> short description.
_WMO: dict[int, str] = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "depositing rime fog",
    51: "light drizzle", 53: "drizzle", 55: "dense drizzle",
    61: "slight rain", 63: "rain", 65: "heavy rain",
    71: "slight snow", 73: "snow", 75: "heavy snow",
    80: "rain showers", 81: "rain showers", 82: "violent rain showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail",
}


def _describe(code: int) -> str:
    return _WMO.get(code, f"weather code {code}")


class WeatherTool(Tool):
    name = "get_weather"
    description = (
        "Get the current weather for a city (e.g. 'London' or 'Tokyo'). "
        "No API key required. Use when the user asks about the weather."
    )
    parameters = {
        "city": {
            "type": "string",
            "description": "City name to look up, e.g. 'San Francisco'.",
        },
        "location": {
            "type": "string",
            "description": "Alias for city (some models pass 'location').",
        },
    }
    required = ["city"]

    def run(self, city: str = "", location: str = "") -> str:
        city = (city or location or "").strip()
        if not city:
            return "No city or location provided."
        try:
            geo = httpx.get(
                _GEOCODE_URL, params={"name": city, "count": 1}, timeout=15
            ).json()
            results = geo.get("results")
            if not results:
                return f"Could not find a city named '{city}'."
            loc = results[0]
            lat, lon = loc["latitude"], loc["longitude"]
            display = loc.get("name", city)

            fc = httpx.get(
                _FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                },
                timeout=15,
            ).json()
            cur = fc.get("current", {})
            if not cur:
                return f"Got the location for {display} but no forecast data."
            temp = cur.get("temperature_2m")
            code = cur.get("weather_code")
            humidity = cur.get("relative_humidity_2m")
            wind = cur.get("wind_speed_10m")
            return (
                f"Weather in {display}: {_describe(code)}, "
                f"{temp}°C, humidity {humidity}%, wind {wind} km/h."
            )
        except httpx.HTTPError as exc:
            return f"Could not fetch weather (network error): {exc}"
        except Exception as exc:  # noqa: BLE001 - never crash the assistant
            return f"Could not fetch weather: {exc}"


weather_tool = WeatherTool()
