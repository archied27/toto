from dataclasses import asdict
from time import monotonic

from app.plugins.spotify.client import SpotifyClient, SpotifyNotConfigured
from app.plugins.spotify.clustering import cluster_albums, grouped_albums
from app.plugins.spotify.command import SpotifyCommand
from app.plugins.spotify.routes import SpotifyRouter
from app.plugins.spotify.state import SpotifyState
from app.schemas.base_plugin import BasePlugin


class SpotifyPlugin(BasePlugin):
    async def setup(self, core):
        self.core = core
        self.client = SpotifyClient(core.db_manager)
        self.command = SpotifyCommand(self)
        self.state = SpotifyState()
        self._paused_track_id = None
        self._paused_since = None
        self.oauth_state = None
        self.router = SpotifyRouter(self.client, self)
        await core.db_manager.execute(
            "CREATE TABLE IF NOT EXISTS spotify_account (id INTEGER PRIMARY KEY CHECK (id = 1), access_token TEXT, refresh_token TEXT, expires_at TEXT)"
        )
        await core.db_manager.execute(
            "CREATE TABLE IF NOT EXISTS spotify_albums (id TEXT PRIMARY KEY, name TEXT NOT NULL, artist TEXT NOT NULL, release_date TEXT, popularity INTEGER, avg_duration REAL, genres TEXT NOT NULL, cover_image TEXT, cluster INTEGER NOT NULL DEFAULT -1)"
        )
        await core.db_manager.execute(
            "CREATE TABLE IF NOT EXISTS spotify_cluster_names (cluster INTEGER PRIMARY KEY, name TEXT NOT NULL)"
        )
        core.bus.on("spotify.refresh", self.refresh)
        core.scheduler.add_recurring("spotify.refresh", second="*/15")

    def get_router(self):
        return self.router.router

    def get_ws_events(self):
        return []

    def get_command(self):
        return self.command

    async def load_state(self):
        await self.refresh()

    async def save_state(self):
        pass

    def get_name(self):
        return "spotify"

    async def sync_albums(self):
        saved = await self.client.saved_albums()
        artist_genres = {}
        albums = []
        for album in saved:
            genres = set()
            for artist in album.get("artists", []):
                artist_id = artist.get("id")
                if artist_id not in artist_genres:
                    artist_genres[artist_id] = (await self.client.artist(artist_id)).get("genres", [])
                genres.update(artist_genres[artist_id])
            tracks = album.get("tracks", {}).get("items", [])
            albums.append({
                "id": album["id"],
                "name": album.get("name", "Unknown album"),
                "artist": ", ".join(artist.get("name", "") for artist in album.get("artists", [])),
                "release_date": album.get("release_date"),
                "popularity": album.get("popularity", 0),
                "avg_duration": sum(track.get("duration_ms", 0) for track in tracks) / len(tracks) if tracks else 0,
                "genres": sorted(genres),
                "cover_image": (album.get("images") or [{}])[0].get("url"),
            })
        labels = cluster_albums(albums)
        for album in albums:
            album["cluster"] = labels[album["id"]]
            await self.core.db_manager.execute(
                "INSERT OR REPLACE INTO spotify_albums (id, name, artist, release_date, popularity, avg_duration, genres, cover_image, cluster) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [album["id"], album["name"], album["artist"], album["release_date"], album["popularity"], album["avg_duration"], ",".join(album["genres"]), album["cover_image"], album["cluster"]],
            )
        return {"count": len(albums), "clusters": grouped_albums(albums, await self.cluster_names())}

    async def cluster_names(self):
        rows = await self.core.db_manager.fetch_all("SELECT cluster, name FROM spotify_cluster_names")
        return {row["cluster"]: row["name"] for row in rows}

    async def clusters(self):
        rows = [dict(row) for row in await self.core.db_manager.fetch_all("SELECT * FROM spotify_albums ORDER BY cluster, artist, name")]
        for row in rows:
            row["genres"] = [genre for genre in row["genres"].split(",") if genre]
        return grouped_albums(rows, await self.cluster_names())

    async def rename_cluster(self, cluster_id: int, name: str):
        name = name.strip()
        if not name:
            raise ValueError("Cluster name cannot be empty")
        cluster = await self.core.db_manager.fetch_one("SELECT 1 FROM spotify_albums WHERE cluster = ? LIMIT 1", [cluster_id])
        if not cluster:
            raise ValueError("Cluster not found")
        await self.core.db_manager.execute(
            "INSERT OR REPLACE INTO spotify_cluster_names (cluster, name) VALUES (?, ?)",
            [cluster_id, name],
        )
        return {"id": cluster_id, "name": name}

    async def cluster(self, cluster_id: int):
        rows = [dict(row) for row in await self.core.db_manager.fetch_all("SELECT * FROM spotify_albums WHERE cluster = ? ORDER BY artist, name", [cluster_id])]
        for row in rows:
            row["genres"] = [genre for genre in row["genres"].split(",") if genre]
        return rows

    async def refresh(self):
        connected = await self.client.is_connected()
        try:
            playback = await self.client.current_playback() if connected else None
        except (ValueError, SpotifyNotConfigured):
            playback = None

        current = None
        if playback and playback.get("item"):
            item = playback["item"]
            track_id = item.get("id") or item.get("uri")
            current = {
                "track_id": track_id,
                "is_playing": bool(playback.get("is_playing")),
                "progress_ms": playback.get("progress_ms", 0),
                "duration_ms": item.get("duration_ms", 0),
                "track": item.get("name"),
                "artists": ", ".join(artist.get("name", "") for artist in item.get("artists", [])),
                "album": item.get("album", {}).get("name"),
                "album_image": (item.get("album", {}).get("images") or [{}])[0].get("url"),
                "device": playback.get("device", {}).get("name"),
                "device_type": playback.get("device", {}).get("type"),
                "volume_percent": playback.get("device", {}).get("volume_percent"),
            }

        dashboard_priority = 0
        if current:
            if current["is_playing"]:
                self._paused_track_id = None
                self._paused_since = None
                dashboard_priority = 95
            else:
                if self._paused_track_id != current["track_id"]:
                    self._paused_track_id = current["track_id"]
                    self._paused_since = monotonic()
                if self._paused_since is not None and monotonic() - self._paused_since <= 30:
                    dashboard_priority = 95

        self.state = SpotifyState(
            connected=connected,
            current=current,
            page_priority=max(20, dashboard_priority),
            dashboard_priority=dashboard_priority,
        )
        await self.core.state.set("spotify", self.state)
        self.core.bus.emit_no_wait("dashboard.rerank")
        self.core.bus.emit_no_wait("pages.rerank")
        return asdict(self.state)