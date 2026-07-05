from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import os
import dotenv
from app.core.event_bus import EventBus
from app.core.state import AppState
from app.core.plugin_manager import PluginManager
from app.core.scheduler import Scheduler
from app.core.background_worker import BackgroundWorker
from app.core.websocket_manager import WebSocketManager
from app.services.dashboard.dashboard_service import DashboardService
from app.services.pages.pages_service import PageService
from app.db.manager import DBManager
from app.core.core import Core
from app.core.command import router as CommandRouter
import json
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

dotenv.load_dotenv()

ip_addr = os.getenv("IP_ADDR", "")
extra_origins = [addr.strip() for addr in ip_addr.split(",") if addr.strip()]

@asynccontextmanager
async def lifespan(app: FastAPI):
    event_bus = EventBus()
    state = AppState()
    scheduler = Scheduler(event_bus)
    bg_worker = BackgroundWorker(event_bus)
    ws_manager = WebSocketManager(event_bus)
    db_manager = DBManager("app/db/toto.db")
    core = Core(event_bus, bg_worker, scheduler, db_manager, state)

    await ws_manager.forward("dashboard.changed")
    await ws_manager.forward("pages.changed")
    dashboard = DashboardService(core)
    pages = PageService(core)

    plugin_manager = PluginManager(core, app, ws_manager)
    await plugin_manager.register_plugins()

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse("../frontend/dist/index.html")

    bg_task = asyncio.create_task(bg_worker.start())

    app.state.core = core
    app.state.state = state
    app.state.ws_manager = ws_manager
    app.state.dashboard_service = dashboard
    app.state.pages_service = pages

    # load initial state for dashboard and pages
    await pages.update_pages()
    await dashboard.rerank()

    yield

    await plugin_manager.save_all_states()
    bg_worker.stop()
    bg_task.cancel()

    try:
        await bg_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="Toto Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ] + extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/command")
async def handle_command(req: dict):
    """
    req = { input: str }
    """
    result = await CommandRouter.process(req["input"])
    print({
            "success": result.success,
            "action": result.action,
            "response": result.response_text,
            "data": result.data
        })
    if result:
        return {
            "success": result.success,
            "action": result.action,
            "response": result.response_text,
            "data": result.data
        }

@app.get("/dashboard")
async def get_dashboard_state():
    return app.state.dashboard_service.get_state()

@app.get("/pages")
async def get_pages_state():
    return app.state.pages_service.get_state()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await app.state.ws_manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                event_type = data.get("type")
                event_data = data.get("data")
                if event_type:
                    await app.state.core.bus.emit(event_type, event_data)
            except json.JSONDecodeError:
                print("Invalid JSON received on WebSocket")
    except WebSocketDisconnect:
        await app.state.ws_manager.disconnect(websocket)

# Static files - order matters, all before the catch-all
@app.get("/manifest.json")
async def manifest():
    return FileResponse("../frontend/dist/manifest.json")

@app.get("/sw.js")
async def service_worker():
    return FileResponse("../frontend/dist/sw.js")

app.mount("/icons", StaticFiles(directory="../frontend/dist/icons"), name="icons")
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")