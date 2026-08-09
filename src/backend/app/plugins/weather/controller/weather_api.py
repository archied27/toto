"""
handles communication with open meteo api
"""

import aiohttp
import asyncio
from app.plugins.weather.schemas import WeatherAtTime, WeatherDaily, WeatherState

class WeatherAPI:
    def __init__(self, longitude: float, latitude: float) -> None:
        self.longitude = longitude
        self.latitude = latitude
        self.base_url = "https://api.open-meteo.com/v1"
        self.air_quality_base_url = "https://air-quality-api.open-meteo.com/v1"
        self.forecast_days = 14

    async def get_details(self):
        """
        fetches current weather and 14 day forecast
        returns None if error occurs
        """

        params = {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,uv_index_max,precipitation_sum",
            "hourly": "temperature_2m,precipitation_probability,precipitation,weather_code,uv_index,is_day",
            "current": "temperature_2m,precipitation,weather_code,is_day,uv_index",
            "forecast_days": self.forecast_days,
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/forecast", params=params) as response:
                    response.raise_for_status()
                    if response.status == 200:
                        data = await response.json()

            if data is None:
                return None

            pollen_data = await self.get_pollen_details()
            return self.parse_response(data, pollen_data)

        except Exception:
            return None

    @staticmethod
    def parse_response(weather_data: dict, pollen_data: dict) -> dict:
        """
        parses response from get_details
        """
        parsed = {}
        parsed["current_weather"] = WeatherAtTime(
            time = weather_data["current"]["time"],
            temp = weather_data["current"]["temperature_2m"],
            precip_mm = weather_data["current"]["precipitation"],
            precip_prob = 100,
            uv = weather_data["current"]["uv_index"],
            grass_pollen = pollen_data["current"]["grass_pollen"] if pollen_data["current"]["grass_pollen"] else None,
            code = weather_data["current"]["weather_code"],
            is_day = bool(weather_data["current"]["is_day"])
        )
        
        parsed["two_week_hourly"] = []
        # loops through every hour within forecast
        for i in range(len(weather_data["hourly"]["time"])):
            parsed["two_week_hourly"].append(WeatherAtTime(
                time = weather_data["hourly"]["time"][i],
                temp = weather_data["hourly"]["temperature_2m"][i],
                precip_mm = weather_data["hourly"]["precipitation"][i],
                precip_prob = weather_data["hourly"]["precipitation_probability"][i],
                uv = weather_data["hourly"]["uv_index"][i],
                grass_pollen = pollen_data["hourly"]["grass_pollen"][i] if i<(7*24) else None,
                code = weather_data["hourly"]["weather_code"][i],
                is_day = bool(weather_data["hourly"]["is_day"][i])
            ))

        parsed["two_week_overview"] = []
        # loops through every day within forecast
        for i in range(len(weather_data["daily"]["time"])):
            parsed["two_week_overview"].append(WeatherDaily(
                time = weather_data["daily"]["time"][i],
                max_temp = weather_data["daily"]["temperature_2m_max"][i],
                min_temp = weather_data["daily"]["temperature_2m_min"][i],
                max_uv = weather_data["daily"]["uv_index_max"][i],
                precip = weather_data["daily"]["precipitation_sum"][i],
                code = weather_data["daily"]["weather_code"][i],
                avg_temp=weather_data["daily"]["temperature_2m_mean"][i]
            ))

        return parsed

    async def get_pollen_details(self):
        """
        fetches current pollen levels and 14 day forecast
        """
        params = {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "hourly": "grass_pollen",
            "current": "grass_pollen",
            "forecast_days": min(self.forecast_days, 7),
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.air_quality_base_url}/air-quality", params=params) as response:
                    response.raise_for_status()
                    if response.status == 200:
                        data = await response.json()

            if data is None:
                return None

            return data

        except Exception:
            return None