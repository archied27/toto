"""
handles all database connections with mpv
"""

from app.db.manager import DBManager
from datetime import datetime

class MPVDb:
    def __init__(self, db_manager: DBManager):
        self.db = db_manager

    async def initialise_db(self):
        """
        creates all tables for mpv
        """
        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS mpv_movies(
            id INTEGER PRIMARY KEY,
            title TEXT,
            poster_path TEXT,
            backdrop_path TEXT,
            logo_path TEXT,
            description TEXT,
            release_date DATETIME,
            file_path TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            progress_seconds INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            last_watched DATETIME DEFAULT NULL
            )
            """)

        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS mpv_series(
            id INTEGER PRIMARY KEY,
            title TEXT,
            poster_path TEXT,
            logo_path TEXT
            )
            """
        )

        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS mpv_seasons(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season_number INTEGER NOT NULL,
            series_id INTEGER NOT NULL,
            title TEXT,
            air_date DATETIME,
            poster_path TEXT,
            FOREIGN KEY (series_id) REFERENCES mpv_series(id) ON DELETE CASCADE
            )
            """
        )

        await self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS  mpv_episodes(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            episode_number INTEGER NOT NULL,
            season_id INTEGER NOT NULL,
            title TEXT,
            description TEXT,
            still_path TEXT,
            file_path TEXT,
            duration_seconds INTEGER,
            progress_seconds INTEGER NOT NULL DEFAULT 0,
            last_watched DATETIME DEFAULT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY (season_id) REFERENCES mpv_seasons(id) ON DELETE CASCADE
            )
            """
        )

    async def get_movies(self):
        """
        fetches all mpv_movies with simple details
        """
        mpv_movies = await self.db.fetch_all(
            """
            SELECT id, title, poster_path, release_date, 
            duration_seconds, progress_seconds, completed, file_path
            FROM mpv_movies
            """
        )

        return mpv_movies

    async def get_movie(self, id: int):
        """
        fetches all the details about a movie with id
        """
        movie = await self.db.fetch_one(
            """
            SELECT *
            FROM mpv_movies
            WHERE id = ?
            """
        , [id,])
        return movie
    
    async def add_movie(self, movie: dict):
        """
        adds dict containing movie details to db
        """
        await self.db.execute(
            """
            INSERT OR IGNORE INTO mpv_movies (id, title, poster_path, backdrop_path, 
            logo_path, description, release_date, file_path, duration_seconds)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
        , [ movie["id"], movie["title"], movie["poster_path"], movie["backdrop_path"],
        movie["logo_path"], movie["description"], movie["release_date"], movie["file_path"],
        movie["duration_seconds"] ])

    async def add_movies_bulk(self, movies: [dict]):
        """
        adds mpv_movies in bulk
        takes in an array of movie dicts
        """
        for movie in movies:
            await self.add_movie(movie)

    async def update_movie_progress(self, id: int, progress: int, last_watched: datetime, completed: bool = None):
        """
        updates a movie with id with progress and (optionally) completed
        """
        if completed != None:
            await self.db.execute(
                """
                UPDATE mpv_movies
                SET progress_seconds = ?, completed = ?, last_watched = ?
                WHERE id = ?
                """
            , [progress, int(completed), last_watched, id])
        else:
            await self.db.execute(
                """
                UPDATE mpv_movies
                SET progress_seconds = ?, last_watched = ?
                WHERE id = ?
                """
            , [progress, last_watched, id])

    async def delete_movie(self, id: int):
        """
        deletes movie with id
        """
        await self.db.execute(
            """
            DELETE FROM mpv_movies 
            WHERE id = ? 
            """
        , [id,])

    async def delete_mpv_movies_bulk(self, ids: [int]):
        """
        deletes all movies in list of id's
        """
        await self.db.execute(
            """
            DELETE FROM mpv_movies 
            WHERE id IN ?
            """
        , [ids,])

    async def get_mpv_series(self):
        """
        fetches all series with simple details
        (including next/current episode details) 
        """
        mpv_series = await self.db.fetch_all(
            """
            SELECT mpv_series.id, mpv_series.title, mpv_series.poster_path,
            COUNT(DISTINCT mpv_seasons.id),
            mpv_episodes.id AS current_episode_id,
            mpv_episodes.duration_seconds,
            mpv_episodes.progress_seconds,
            mpv_seasons.season_num,
            mpv_seasons.id

            FROM mpv_series
            LEFT JOIN mpv_seasons ON mpv_seasons.series_id = mpv_series.id
            LEFT JOIN mpv_episodes ON mpv_episodes.season_id = mpv_seasons.id

            WHERE mpv_episodes.id = (
                SELECT e2.id
                    FROM mpv_episodes e2
                    JOIN mpv_seasons se2 ON se2.id = e2.season_id
                    WHERE se2.series_id = s.id
                    ORDER BY
                        CASE WHEN e2.completed = 0 THEN 0 ELSE 1 END ASC,
                        se2.season_number ASC,
                        e2.episode_number ASC
                    LIMIT 1
            )

            GROUP BY mpv_series.id
            """
        )

        return mpv_series
    
    async def get_full_mpv_series(self, series_id: int, season_id: int):
        """
        fetches a full mpv_series in context of the season
        i.e mpv_series details and full season and other season
        """
        series = await self.db.fetch_all(
            """
            SELECT mpv_series.title,
            mpv_seasons.title, mpv_seasons.air_date, mpv_seasons.poster_path,
            mpv_episodes.id, mpv_episodes.episode_number, mpv_episodes.title,
            mpv_episodes.description, mpv_episodes.still_path, mpv_episodes.duration_seconds,
            mpv_episodes.progress_seconds, mpv_episodes.completed

            FROM mpv_series
            JOIN mpv_seasons ON mpv_seasons.series_id = mpv_series.id
            JOIN mpv_episodes ON mpv_episodes.season_id = mpv_seasons.id

            WHERE mpv_series.id = ?
            AND mpv_seasons.id = ?
            """
        , [series_id, season_id])

        other_seasons = await self.db.fetchall(
            """
            SELECT id, season_number
            FROM mpv_seasonst/{id
            WHERE series_id = ?
            AND id != ?
            ORDER BY season_number ASC
            """
        , [series_id, season_id])

        if not series:
            return None

        return {
            "mpv_series_title": series[0]["mpv_series_title"],
            "season_title": series[0]["season_title"],
            "air_date": series[0]["air_date"],
            "poster_path": series[0]["poster_path"],
            "mpv_episodes": [
                {
                    "id": row["id"],
                    "episode_number": row["episode_number"],
                    "title": row["title"],
                    "description": row["description"],
                    "still_path": row["still_path"],
                    "duration_seconds": row["duration_seconds"],
                    "progress_seconds": row["progress_seconds"],
                    "completed": row["completed"]
                }
                for row in series
            ],
            "other_mpv_seasons": [
                {
                    "id": row["id"],
                    "season_number": row["season_number"]
                }
                for row in other_seasons
            ]
        }

    async def add_episode(self, season_id: int, episode: dict):
        """
        adds an episode to the database
        episode is {episode_num, title, description, still_path,
        file_path, duration_seconds}
        """
        await self.db.execute(
            """
            INSERT OR IGNORE INTO mpv_episodes (episode_number, season_id,
            title, description, still_path, file_path, duration_seconds)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """
        , [episode["episode_num"], season_id, episode["title"], 
        episode["description"], episode["still_path"], episode["file_path"],
        episode["duration_seconds"]])

    async def add_season(self, series_id: int, season: dict):
        """
        adds a season to the database
        season is {season_number, title, air_date, poster_path,
        [episodes]} where episodes is the same as add_episode
        """
        season_id = await self.db.execute(
            """
            INSERT OR IGNORE INTO mpv_seasons (season_number, series_id,
            title, air_date, poster_path)
            VALUES (?, ?, ?, ?, ?)
            """
        , [season["season_number"], series_id, season["title"],
        season["air_date"], season["poster_path"]])

        if season_id and season["episodes"]:
            for ep in season["episodes"]:
                await self.add_episode(season_id, ep)

    async def add_series(self, series: dict):
        """
        adds a series to the database
        series is {id, title, poster_path, logo_path, [seasons]}
        where seasons is the same as add_season
        """
        await self.db.execute(
            """
            INSERT OR IGNORE INTO mpv_series (id, title, poster_path, logo_path)
            VALUES (?, ?, ?, ?)
            """
        , [series["id"], series["title"], series["poster_path"],
        series["logo_path"]])

        if series["seasons"]:
            for season in series["seasons"]:
                await self.add_season(series["id"], season)

    async def add_series_bulk(self, series: [dict]):
        """
        adds array of series
        """
        for s in series:
            await self.add_series(s)

    async def get_continue_watching_movies(self):
        """
        returns in order of last watched all simple mpv_movies which are 
        not completed and progress > 0
        """
        mpv_movies = await self.db.fetch_all(
            """
            SELECT id, title, poster_path, release_date,
            duration_seconds, progress_seconds, completed
            FROM mpv_movies
            WHERE (progress_seconds > 0) AND (completed = 0)
            ORDER BY last_watched DESC
            """
        )

        return mpv_movies

    async def get_continue_watching_series(self):
        """
        returns in order of last watched all mpv_series which are 
        not completed and progress > 0
        """
        mpv_series = await self.db.fetch_all(
            """
            SELECT mpv_series.id, mpv_series.title, mpv_series.poster_path,
            COUNT(DISTINCT mpv_seasons.id),
            mpv_episodes.id AS current_episode_id,
            mpv_episodes.duration_seconds,
            mpv_episodes.progress_seconds,
            mpv_seasons.season_num,
            mpv_seasons.id

            FROM mpv_series
            LEFT JOIN mpv_seasons ON mpv_seasons.series_id = mpv_series.id
            LEFT JOIN mpv_episodes ON mpv_episodes.season_id = mpv_seasons.id

            WHERE (mpv_episodes.id = (
                SELECT e2.id
                    FROM mpv_episodes e2
                    JOIN mpv_seasons se2 ON se2.id = e2.season_id
                    WHERE se2.series_id = s.id
                    ORDER BY
                        CASE WHEN e2.completed = 0 THEN 0 ELSE 1 END ASC,
                        se2.season_number ASC,
                        e2.episode_number ASC
                    LIMIT 1
            ))
            AND ((mpv_episodes.episode_number > 1) OR (mpv_seasons.season_num > 1))

            ORDER BY mpv_episodes.last_watched
            GROUP BY mpv_series.id
            """
        )

        return mpv_series

    async def get_details_from_path(self, file_path: str):
        """
        returns id and media type which matches the file path
        (or none)
        """
        movie = await self.db.fetch_one(
            """
            SELECT id FROM mpv_movies
            WHERE file_path = ?
            """
        , [file_path,])
        if movie:
            return {"id": movie["id"], "type": "movie"}

        episode = await self.db.fetch_one(
            """
            SELECT mpv_series.id AS id, mpv_seasons.season_number AS season_number,
            mpv_episodes.episode_number AS episode_number
            FROM mpv_series JOIN mpv_seasons ON (mpv_series.id  = mpv_seasons.series_id)
            JOIN mpv_episodes ON (mpv_seasons.id = mpv_episodes.season_id)
            WHERE file_path = ?
            """
        , [file_path,])
        if episode:
            return {"type": "episode", "series_id": episode["id"], "season_number": episode["season_number"],
            "episode_number": episode["episode_number"]}

        return None

    async def get_episode_details(self, series_id: int, season_num: int, episode_num: int):
        """
        returns episode details
        """
        episode = await self.db.fetch_one(
            """
            SELECT mpv_series.title AS title, mpv_episodes.episode_number AS episode_num,
            mpv_seasons.season_number AS season_num, mpv_episodes.duration AS duration,
            mpv_seasons.poster_path AS poster_path
            FROM mpv_episodes JOIN mpv_seasons ON (mpv_episodes.season_id = mpv_seasons.id)
            JOIN mpv_series ON (mpv_seasons.series_id = mpv_series.id)
            """
        )

        return episode

    async def get_episodes(self):
        """
        returns a list of all episodes
        """
        episodes = await self.db.fetch_all(
            """
            SELECT mpv_episodes.id AS id, mpv_episodes.file_path AS file_path,
            mpv_episodes.season_id AS season_id, mpv_seasons.series_id AS series_id
            FROM mpv_episodes JOIN mpv_seasons ON (mpv_episodes.season_id = 
            mpv_seasons.id)
            GROUP BY mpv_episodes.id
            """
        )
        return episodes

    async def delete_episode(self, id: int):
        """
        deletes an episode from db
        """
        await self.db.execute(
            """
            DELETE FROM mpv_episodes
            WHERE id = ?
            """
        , [id,])

    async def get_seasons_episodes(self, id: int):
        """
        returns a seasons episodes
        """
        episodes = await self.db.fetch_all(
            """
            SELECT mpv_episodes.id
            FROM mpv_seasons JOIN mpv_episodes ON 
            (mpv_seasons.id = mpv_episodes.season_id)
            WHERE mpv_seasons.id = ?
            """
        , [id,])
        return episodes

    async def delete_season(self, id: int):
        """
        deletes a season from db
        """
        await self.db.execute(
            """
            DELETE FROM mpv_seasons
            WHERE id = ?
            """
        , [id,])

    async def get_series_seasons(self, id: int):
        """
        returns a series seasons
        """
        seasons = await self.db.fetch_all(
            """
            SELECT mpv_seasons.id
            FROM mpv_series JOIN mpv_seasons ON
            (mpv_seasons.series_id = mpv_series.id)
            WHERE mpv_series.id = ?
            """
        , [id,])
        return seasons

    async def delete_series(self, id: int):
        """
        deletes series from db
        """
        await self.db.execute(
            """
            DELETE FROM mpv_series
            WHERE id = ?
            """
        , [id,])