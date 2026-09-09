from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
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
from app.core.command import router as CommandRouter, resolve_write
from app.core.agent_registry import AgentRegistry, handle_agent_connection
import json
from fastapi.responses import FileResponse, StreamingResponse
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
    # database lives in the project's data/ folder (src/data when running the
    # backend from src/backend); docker-compose overrides this to /app/data
    db_path = os.getenv("TOTO_DB_PATH", "../data/toto.db")
    db_manager = DBManager(db_path)
    core = Core(event_bus, bg_worker, scheduler, db_manager, state)

    await ws_manager.forward("dashboard.changed")
    await ws_manager.forward("pages.changed")
    dashboard = DashboardService(core)
    pages = PageService(core)

    plugin_manager = PluginManager(core, app, ws_manager)
    await plugin_manager.register_plugins()

    # Agent registry for device-agent coordination
    agent_registry = AgentRegistry()
    CommandRouter.set_agent_registry(agent_registry)

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse("../frontend/dist/index.html")

    bg_task = asyncio.create_task(bg_worker.start())

    app.state.core = core
    app.state.state = state
    app.state.ws_manager = ws_manager
    app.state.dashboard_service = dashboard
    app.state.pages_service = pages
    app.state.agent_registry = agent_registry

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
    if result:
        return {
            "success": result.success,
            "action": result.action,
            "response": result.response_text,
            "data": result.data
        }

@app.post("/command/stream")
async def stream_command(req: dict):
    """
    req = { input: str, mode?: "normal" | "llm" }

    streams command-processing events as SSE (text/event-stream). event types:
      - {"type": "text", "content": ...}        streamed LLM answer fragment
      - {"type": "tool_start", "tool", "status"} tool about to execute
      - {"type": "tool_end", "tool", "result"}   tool finished
      - {"type": "result", "result": {success, action, response, data}}  terminal

    mode: "normal" (default) classifies and routes as usual; "llm" skips the
    classifier and sends the input straight to the general LLM (with tools).
    """
    mode = req.get("mode", "normal")
    async def event_source():
        async for event in CommandRouter.process_stream(req["input"], mode=mode):
            if event["type"] == "result":
                r = event["result"]
                # flatten CommandResult dataclass into the JSON shape the
                # frontend already expects ({success, action, response, data})
                event = {
                    "type": "result",
                    "result": {
                        "success": r.success,
                        "action": r.action,
                        "response": r.response_text,
                        "data": r.data,
                    },
                }
            # jsonable_encoder so pydantic models in event data (e.g. task
            # objects) serialize like they do on the non-streaming endpoints
            yield f"data: {json.dumps(jsonable_encoder(event))}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")

@app.post("/command/confirm")
async def confirm_command(req: dict):
    """
    req = { intent: str, plugin: str, raw: str }
    """
    result = await CommandRouter.confirm(req["intent"], req["plugin"], req["raw"])
    if result:
        return {
            "success": result.success,
            "action": result.action,
            "response": result.response_text,
            "data": result.data
        }

@app.post("/command/confirm-write")
async def confirm_write_endpoint(req: dict):
    """
    req = { token: str, confirmed: bool }

    Resolves a write confirmation that the LLM stream is awaiting.
    The token was yielded to the frontend as part of a confirm_write
    event; the frontend echoes it back once the user decides.
    """
    ok = resolve_write(req.get("token"), bool(req.get("confirmed", False)))
    return {"ok": ok}

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
                pass
    except WebSocketDisconnect:
        await app.state.ws_manager.disconnect(websocket)

@app.websocket("/agent/ws")
async def agent_websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for device-agent connections.

    Devices connect here to register their capabilities and receive
    dispatch requests from the LLM tool-calling loop.
    """
    await websocket.accept()
    await handle_agent_connection(
        websocket, app.state.agent_registry,
        os.getenv("AGENT_SHARED_SECRET", "")
    )


# GET /agents - List connected agents and their capabilities
@app.get("/agents")
async def get_agents():
    registry = app.state.agent_registry
    return {
        "agents": [
            {
                "device_id": device_id,
                "display_name": device.display_name,
                "icon": device.icon,
                "connected_at": device.connected_at.isoformat(),
                "capabilities": [
                    {
                        "name": cap.name,
                        "description": cap.description,
                        "parameters": cap.parameters,
                        "write": cap.write,
                        "icon": cap.icon,
                        "group": cap.group,
                    }
                    for cap in device.capabilities
                ]
            }
            for device_id, device in registry._devices.items()
        ]
    }

# POST /agents/{device_id}/{action} - Execute agent tool directly
@app.post("/agents/{device_id}/{action}")
async def execute_agent_tool(device_id: str, action: str, req: dict):
    registry = app.state.agent_registry
    payload = req.get("payload", {})
    try:
        result = await registry.dispatch(device_id, action, payload)
        return {"success": True, "result": result}
    except DeviceNotConnectedError:
        raise HTTPException(404, f"Device '{device_id}' not connected")
    except DeviceTimeoutError:
        raise HTTPException(504, f"Device '{device_id}' timeout")
    except DeviceDisconnectedError:
        raise HTTPException(503, f"Device '{device_id}' disconnected")


# Static files - order matters, all before the catch-all
@app.get("/manifest.json")
async def manifest():
    return FileResponse("../frontend/dist/manifest.json")

@app.get("/sw.js")
async def service_worker():
    return FileResponse("../frontend/dist/sw.js")

app.mount("/icons", StaticFiles(directory="../frontend/dist/icons"), name="icons")
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")