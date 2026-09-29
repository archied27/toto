from dataclasses import dataclass, field
from typing import Optional

@dataclass
class WeatherAtTime:
    time: str # iso8601 format
    temp: float
    precip_mm: float
    precip_prob: float
    uv: float
    grass_pollen: float
    code: int # weather code for icon and description
    is_day: bool # for icon

@dataclass
class WeatherDaily:
    time: str # iso8601 format
    avg_temp: float
    max_temp: float
    min_temp: float
    max_uv: float
    precip: float
    code: int # weather code for icon and description

@dataclass
class WeatherState:
    dashboard_priority: int = 0
    page_priority: int = 5
    base_priority: int = 0
    current_weather: Optional[WeatherAtTime] = None
    two_week_overview: list[WeatherDaily] = field(default_factory=list)
    two_week_hourly: list[WeatherAtTime] = field(default_factory=list)
