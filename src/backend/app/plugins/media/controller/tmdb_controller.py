"""
handles communication with tmdb api
"""

import asyncio
import aiohttp

class TMDBApiController:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.themoviedb.org/3'

    async def search_tmdb(self, query: str, media_type: str = "all", page: int = 1):
        """
        searches tmdb for movies and/or series matching the query
        media_type can be "all", "movie" or "tv"
        """
        endpoint = "search/movie" if media_type == "movie" else "search/tv" if media_type == "tv" else "search/multi"

        url = f"{self.base_url}/{endpoint}"
        params = {"api_key": self.api_key, "query": query, "page": page}

        data = None

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    data = await response.json()

        if data == None:
            return None

        results = []
        for result in data["results"]:
            # /search/multi includes a media_type field; the type-specific endpoints imply it
            result_type = result.get("media_type") or endpoint.replace("search/", "")

            if result_type == "movie":
                release_type = await self.get_movie_release_details(result["id"])

                results.append({"id": result["id"], "title": result["title"], "poster_path": result["poster_path"],
                "media_type": "movie", "release_date": result["release_date"], "release_type": release_type})


            elif result_type == "tv":
                results.append({"id": result["id"], "title": result["name"], "poster_path": result["poster_path"],
                "media_type": "show", "release_date": result["first_air_date"], "release_type": 6})
        return results

    async def get_movie_details(self, id: int):
        """
        fetches and returns movie details
        """
        data = None
        logo_path = None

        url = f"{self.base_url}/movie/{id}"
        params = {"api_key": self.api_key}

        image_url = url + "/images"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    data = await response.json()

            async with session.get(image_url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    img_data = await response.json()

                    best = -1.0
                    for logo in img_data["logos"]:
                        if (logo["iso_639_1"] == "en") and (logo["vote_average"] > best):
                            best = logo["vote_average"]
                            logo_path = logo["file_path"]

        release_type = await self.get_movie_release_details(id)

        if data == None:
            return None

        return {"title": data["title"], "poster_path": data["poster_path"], 
        "backdrop_path": data["backdrop_path"], "description": data["overview"],
        "release_date": data["release_date"], "logo_path": logo_path, "duration_seconds": data["runtime"]*60, 
        "release_type": release_type}

    async def get_series_details(self, id: int):
        """
        fetches and returns series details
        """
        data = None
        logo_path = None

        url = f"{self.base_url}/tv/{id}"
        params = {"api_key": self.api_key}

        image_url = url + "/images"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    data = await response.json()

            async with session.get(image_url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    img_data = await response.json()

                    best = -1.0
                    for logo in img_data["logos"]:
                        if (logo["iso_639_1"] == "en") and (logo["vote_average"] > best):
                            best = logo["vote_average"]
                            logo_path = logo["file_path"]

        if data == None:
            return None

        return {"title": data["name"], "poster_path": data["poster_path"],
        "logo_path": logo_path, "id": id, "backdrop_path": data["backdrop_path"], "number_of_seasons": data["number_of_seasons"]}

    async def get_season_details(self, series_id: int, season_num: int = 1):
        """
        fetches and returns season details
        """
        data = None

        url = f"{self.base_url}/tv/{series_id}/season/{season_num}"
        params = {"api_key": self.api_key}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    data = await response.json()

        if data == None:
            return None

        episodes = []
        for episode in data["episodes"]:
            episodes.append({"episode_num": episode["episode_number"], "title": episode["name"],
            "description": episode["overview"], "still_path": episode["still_path"], "air_date": episode["air_date"], "duration_seconds": episode["runtime"]*60 if episode["runtime"] else None})
        return ({"title": data["name"], "air_date": data["air_date"], "poster_path": data["poster_path"], "episodes": episodes})

    async def get_movie_release_details(self, id: int):
        """
        fetches and returns movie release details
        returns 0 if no release details are found,
        1 if premiere, 2 if theatrical limited, 3 if theatrical, 
        4 if digital, 5 if physical, 6 if tv
        """
        data = None
        type = 0

        url = f"{self.base_url}/movie/{id}/release_dates"
        params = {"api_key": self.api_key}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                response.raise_for_status()
                if response.status == 200:
                    data = await response.json()

        if data == None:
            return 0

        for result in data["results"]:
            for release in result["release_dates"]:
                if release["type"] > type:
                    type = release["type"]

        return type if type != 0 else 6