from dataclasses import dataclass
from pydantic import BaseModel
from typing import Literal, Optional

@dataclass
class MPVState:
    dashboard_priority: int = 0
    page_priority: int = 50
    base_priority: int = 50

class HomePageResult(BaseModel):
    id: int
    title: str
    poster_path: Optional[str]
    media_type: Literal["movie", "show"]
    release_date: str
    release_type: int

class MovieDetails(BaseModel):
    title: str
    poster_path: Optional[str]
    backdrop_path: Optional[str]
    description: str
    release_date: str
    logo_path: Optional[str]
    duration_seconds: int
    release_type: int

class EpisodeDetails(BaseModel):
    episode_num: int
    title: str
    description: str
    still_path: Optional[str]
    air_date: str
    duration_seconds: Optional[int]

class SeasonDetails(BaseModel):
    title: str
    air_date: str
    poster_path: Optional[str]
    episodes: list[EpisodeDetails]

class SeriesDetails(BaseModel):
    title: str
    poster_path: Optional[str]
    logo_path: Optional[str]
    id: int
    backdrop_path: Optional[str]
    number_of_seasons: int

class FullSeriesDetails(BaseModel):
    title: str
    poster_path: Optional[str]
    logo_path: Optional[str]
    backdrop_path: Optional[str]
    id: int
    number_of_seasons: int
    seasons: list[SeasonDetails]

class CurrentlyPlaying(BaseModel):
    media_type: Literal["movie", "episode"]
    title: str
    poster_path: Optional[str]
    release_year: Optional[int] = None
    progress_seconds: Optional[int] = None
    episode_num: Optional[int] = None
    season_num: Optional[int] = None
    duration_seconds: Optional[int] = None