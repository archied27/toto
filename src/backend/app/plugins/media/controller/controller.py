"""
handles logic for media plugin
"""

from app.plugins.media.controller.db import MPVDb
from app.plugins.media.controller.mpv_socket_controller import MPVSocket
from app.plugins.media.controller.tmdb_controller import TMDBApiController
from app.plugins.media.schemas import MPVState
from app.core.core import Core
from app.core.background_worker import Task
import subprocess
import json
import os

class MPVController:
    def __init__(self, core: Core):
        self.core = core
        self.db = MPVDb(self.core.db_manager)
        self.socket_manager = MPVSocket("/tmp/mpvsocket")

    async def update_state(self):
        new_state = MPVState()
        await self.core.state.set("media", new_state)
        self.core.bus.emit_no_wait("pages.rerank")

    async def setup(self):
        with open("app/plugins/media/config.json", "r") as json_f:
            data = json.load(json_f)

        self.tmdb = TMDBApiController(data["tmdb-api-key"])
        self.movie_dirs = data["movie-dirs"]
        self.series_dirs = data["series-dirs"]

        self.core.bg_worker.register_handler("mpv.add_movies", self.add_movies)
        self.core.bg_worker.register_handler("mpv.add_series", self.add_series)
        self.core.bg_worker.register_handler("mpv.cleanup_db", self.cleanup_db)

        await self.db.initialise_db()
        await self.update_state()

    async def search_tmdb(self, query: str, media_type: str = "all"):
        """
        searches tmdb for movies and/or series matching the query
        """
        return await self.tmdb.search_tmdb(query, media_type)

    async def get_movie_details(self, id: int):
        """
        fetches and returns movie details
        """
        return await self.tmdb.get_movie_details(id)

    async def get_series_details(self, id: int):
        """
        fetches and returns series details
        """
        return await self.tmdb.get_series_details(id)

    async def get_full_series_details(self, id: int):
        """
        fetches and returns series details with all seasons and episodes
        """
        series_details = await self.tmdb.get_series_details(id)
        seasons = []
        for season in range(1, series_details["number_of_seasons"] + 1):
            season_details = await self.tmdb.get_season_details(id, season)
            seasons.append(season_details)

        series_details["seasons"] = seasons
        return series_details

    async def update_db(self):
        """
        syncs the database with files on computer
        background task
        """
        await self.core.bg_worker.add_task("mpv.cleanup_db")

        await self.core.bg_worker.add_task("mpv.add_series")
        await self.core.bg_worker.add_task("mpv.add_movies")
    
    async def cleanup_db(self, task: Task):
        """
        removes all db entries where file no longer exists
        """
        await task.update(0.0, "Cleaning Up Movies...")
        await self.cleanup_movies()
        await task.update(0.5, "Cleaning Up Series...")
        await self.cleanup_series()

    def toggle_pause(self):
        """
        toggles pause status and does nothing if nothing being played
        """
        current = self.socket_manager.get_pause_status()
        if current != None:
            self.socket_manager.set_pause(not current)

    def play(self, file_path: str, duration: int):
        subprocess.Popen(["mpv", f"--start={duration}", file_path, "-fs", f"--input-ipc-server={self.socket_manager.socket}"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)

    async def get_being_played(self):
        """
        returns details about currently playing
        """
        file = self.socket_manager.get_current_file()
        if file != None:
            details = await self.db.get_details_from_path(file)
            if details["type"] == "movie":
                data = await self.db.get_movie(details["id"])

                return {"media_type": "movie",
                "title": data["title"], "release_year": data["release_date"].year,
                "progress_seconds": data["progress_seconds"], "poster_path": data["poster_path"]}

            elif details["type"] == "episode":
                data = await self.db.get_episode_details(details["id"], details["season_number"],
                details["episode_number"])

                return {"media_type": "episode",
                "title": data["title"], "episode_num": data["episode_num"], 
                "season_num": data["season_num"], "duration_seconds": data["duration"],
                "poster_path": data["poster_path"]}

            else:
                return None

    async def cleanup_movies(self):
        """
        removes all movies from db if file not present
        """
        db_movies = await self.db.get_movies()
        for movie in db_movies:
            if not os.path.isfile(movie["file_path"]):
                await self.db.delete_movie(movie["id"])

    async def cleanup_series(self):
        """
        removes all episodes from db if file not present
        if a season has no episodes, removes from db
        if a series has no seasons, removes from db
        """
        db_episodes = await self.db.get_episodes()
        for episode in db_episodes:
            if not os.path.isfile(episode["file_path"]):
                await self.db.delete_episode(episode["id"])
                # if season has no episodes
                # if len(await self.db.get_seasons_episodes(episode["season_id"])) == 0:
                #     await self.db.delete_season(episode["season_id"])
                #     # if series has no seasons
                #     if len(await self.db.get_series_seasons(episode["series_id"])) == 0:
                #         await self.db.delete_series()

    async def get_all_movies(self):
        """
        returns array of all movies, sorted
        """


    async def add_movies(self, task: Task):
        """
        adds an array of all movies found to db
        """
        movies = []

        for path in self.movie_dirs:
            if os.path.isdir(path):
                total_files = len([name for name in os.listdir(path) if ".mkv" in name])
                count = 0
                for f in os.listdir(path):
                    if ".mkv" in f:
                        if not (await self.db.get_movie(int(f[:-4]))):
                            file = str(os.path.join(path, f))
                            data = await self.tmdb.get_movie_details(int(f[:-4]))
                            data["id"] = f[:-4]
                            data["file_path"] = file
                            data["duration_seconds"] = self.get_duration(file)
                            movies.append(data)

                            count+=1
                            await task.update((count/total_files)*100, f"Found {data["title"]}")
                        else:
                            count+=1
                            
        await self.db.add_movies_bulk(movies)

    async def add_series(self, task: Task):
        """
        adds all series to db
        """
        series = []

        for path in self.series_dirs:
            if os.path.isdir(path):

                total_series = len([name for name in os.listdir(path) if os.path.isdir(os.path.join(path, name))])
                count = 0

                for subpath in os.listdir(path):
                    if os.path.isdir(os.path.join(path, subpath)):
                        current_series = await self.tmdb.get_series_details(int(subpath))
                        current_series["seasons"] = await self.get_seasons(str(os.path.join(path, subpath)), subpath)

                        count+=1

                        await task.update((count/total_series)*100, f"Found {current_series["title"]}")

                        series.append(current_series)
        
        await self.db.add_series_bulk(series)

    async def get_seasons(self, series_path: str, series_id: int):
        """
        returns array of seasons dicts
        """
        seasons = []
        for subpath in os.listdir(series_path):
            season, episodes = await self.tmdb.get_season_details(series_id, int(subpath))
            season["season_number"] = int(subpath)
            season["series_id"] = series_id
            season["episodes"] = []

            for ep in os.listdir(os.path.join(series_path, subpath)):
                if os.path.isfile(os.path.join(series_path, subpath, ep)):
                    episode = next((e for e in episodes if e["episode_num"] == int(ep[:-4])), None)

                    if episode:
                        episode["file_path"] = str(os.path.join(series_path, subpath, ep))
                        episode["duration_seconds"] = self.get_duration(str(os.path.join(series_path, subpath, ep)))
                        season["episodes"].append(episode)

            seasons.append(season)
        return seasons


    def get_duration(self, filepath: str):
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "json",
                filepath
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        data = json.loads(result.stdout)
        duration = float(data["format"]["duration"])
        return int(duration)