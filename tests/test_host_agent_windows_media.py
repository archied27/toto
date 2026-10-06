import asyncio
import importlib.util
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "src" / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if "aiosqlite" not in sys.modules:
    sys.modules["aiosqlite"] = types.ModuleType("aiosqlite")
if "aiohttp" not in sys.modules:
    aiohttp_stub = types.ModuleType("aiohttp")
    aiohttp_stub.ClientSession = object
    sys.modules["aiohttp"] = aiohttp_stub
if "pydantic" not in sys.modules:
    pydantic_stub = types.ModuleType("pydantic")
    class BaseModel:  # minimal stub for media schema imports
        pass
    pydantic_stub.BaseModel = BaseModel
    sys.modules["pydantic"] = pydantic_stub


def load_module():
    module_path = Path(__file__).resolve().parents[1] / "src" / "agents" / "host-agent-windows.py"
    spec = importlib.util.spec_from_file_location("host_agent_windows", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None and spec.loader is not None
    spec.loader.exec_module(module)
    return module


class HostAgentWindowsMediaTests(unittest.TestCase):
    def test_media_agent_exposes_typed_capability(self):
        module = load_module()

        with patch.object(module, "_firefox_tabs", return_value=[]), tempfile.TemporaryDirectory() as tmpdir:
            movie_dir = Path(tmpdir) / "movies"
            movie_dir.mkdir()
            (movie_dir / "550 - Fight Club.mkv").write_bytes(b"movie")

            agent = module.MediaAgent([str(movie_dir)])
            items = agent.list_library(media_type="movie", tmdb_id=550)

            self.assertEqual(module.MEDIA_CAPABILITY["name"], "media")
            self.assertTrue(items)
            self.assertEqual(items[0]["tmdb_id"], 550)
            self.assertTrue(items[0]["source_id"])

            state = agent.get_state()
            self.assertIn(state["status"], {"stopped", "idle"})

            play_result = agent.play({"source_id": items[0]["source_id"]})
            self.assertEqual(play_result["status"], "success")
            self.assertEqual(agent.get_state()["source_id"], items[0]["source_id"])

    def test_media_controller_stream_dispatches_browser_url_to_agent(self):
        from app.plugins.media.controller.controller import MediaController

        class FakeAgents:
            def __init__(self):
                self.calls = []

            def list_media_agents(self):
                return [types.SimpleNamespace(
                    device_id="host-windows",
                    capabilities=[types.SimpleNamespace(name="open_url")],
                )]

            async def dispatch(self, agent_id, *args, **kwargs):
                if len(args) == 2:
                    action, payload = args
                    capability = "media"
                elif len(args) == 3:
                    capability, action, payload = args
                else:
                    raise TypeError("dispatch() expects (agent_id, action, payload) or (agent_id, capability, action, payload)")
                self.calls.append({
                    "agent_id": agent_id,
                    "capability": capability,
                    "action": action,
                    "payload": payload,
                })
                return {"status": "success", "agent_id": agent_id}

        fake_core = types.SimpleNamespace(
            agents=FakeAgents(),
            db_manager=None,
            state=None,
            bg_worker=None,
            bus=None,
        )
        controller = MediaController(fake_core)

        async def run_movie():
            return await controller.stream("movie", 278)

        async def run_series():
            return await controller.stream("series", 1413, season_number=1, episode_number=2)

        movie_response = asyncio.run(run_movie())
        series_response = asyncio.run(run_series())

        self.assertEqual(movie_response["status"], "success")
        self.assertEqual(movie_response["url"], "https://www.movy.sx/movie/278?play=true")
        self.assertEqual(series_response["status"], "success")
        self.assertEqual(series_response["url"], "https://www.movy.sx/tv/1413/1/2?play=true")
        self.assertEqual(fake_core.agents.calls[-1]["payload"]["url"], "https://www.movy.sx/tv/1413/1/2?play=true")

    def test_media_controller_get_item_routes_to_tmdb_details(self):
        from app.plugins.media.controller.controller import MediaController

        controller = MediaController(types.SimpleNamespace(db_manager=None))

        async def get_movie_details(tmdb_id):
            return {"kind": "movie", "id": tmdb_id}

        async def get_series_details(tmdb_id):
            return {"kind": "series", "id": tmdb_id}

        controller.get_movie_details = get_movie_details
        controller.get_series_details = get_series_details

        async def run():
            movie = await controller.get_item("movie", 278)
            series = await controller.get_item("series", 318325)
            return movie, series

        movie, series = asyncio.run(run())
        self.assertEqual(movie, {"kind": "movie", "id": 278})
        self.assertEqual(series, {"kind": "series", "id": 318325})


if __name__ == "__main__":
    unittest.main()
