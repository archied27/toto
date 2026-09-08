# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Toto is a local-first personal assistant / media dashboard with a plugin architecture. Backend is FastAPI (Python), frontend is React + TypeScript + Vite with Tailwind CSS and shadcn/ui components.

## Development Commands

### Frontend (src/frontend/)
```bash
cd src/frontend
npm run dev       # Start dev server (HTTPS on 0.0.0.0:5173)
npm run build     # Type-check + production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (src/backend/)
```bash
cd src/backend
source .venv/bin/activate  # Uses existing venv (no uv.lock; pip install -r requirements.txt)
uvicorn main:app --host 0.0.0.0 --port 8000 \
  --ssl-keyfile ../certs/archlinux.tail802449.ts.net.key \
  --ssl-certfile ../certs/archlinux.tail802449.ts.net.crt
```

### Full Stack (uses tmux)
```bash
./start.sh  # Starts frontend + backend in side-by-side tmux panes
```

### Docker
```bash
docker-compose up --build  # Multi-stage build: frontend → python runtime with torch + requirements
```

### Certificates
Dev uses Tailscale certs at `certs/archlinux.tail802449.ts.net.{crt,key}` (gitignored except the files themselves). Both frontend (Vite) and backend (uvicorn) use these for HTTPS/WSS.

## Architecture

```
src/
├── backend/
│   ├── main.py                 # FastAPI app, lifespan, routes, WS endpoints
│   ├── app/
│   │   ├── core/               # Core infrastructure (see below)
│   │   ├── plugins/            # Each plugin is a self-contained folder
│   │   │   ├── weather/        # 14-day forecast, pollen, UV
│   │   │   ├── tasks/          # Todo lists with due/to-do dates, labels
│   │   │   ├── media/          # mpv-controlled media, TMDB search
│   │   │   └── web/            # Web search (ddgs)
│   │   ├── services/           # Dashboard & Pages services (priority-based ordering)
│   │   ├── db/                 # SQLite manager (single toto.db, per-plugin tables)
│   │   ├── ai/                 # LLM stack: local extractor + cloud general LLM
│   │   └── schemas/            # BasePlugin, BaseCommand, IntentSpec
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── plugins/            # Frontend plugin manifests + components
│   │   │   ├── weather/, tasks/, media/, web/
│   │   │   ├── types.ts        # PluginManifest, CommandResult
│   │   │   └── index.ts        # Exports [tasks, weather, media, web]
│   │   ├── components/         # Shared UI (CommandBar, widgets, dialogs)
│   │   ├── dashboard/          # DashboardPage, WidgetSlots, StatusBar
│   │   ├── hooks/              # WebSocket, command registry, navigation, etc.
│   │   └── lib/utils.ts
│   └── package.json, vite.config.ts, tailwind.config
└── agents/                     # Device agent (laptop-agent.py) - planned
```

### Core Backend Services (`src/backend/app/core/`)

| Module | Responsibility |
|--------|----------------|
| `event_bus.py` | Pub/sub for plugin communication (`task.created`, `weather.updated`, etc.) |
| `state.py` | `AppState` — per-plugin state slices with dashboard/page priority |
| `plugin_manager.py` | Discovers `app/plugins/*/plugin.py`, calls `setup(core)`, mounts routers, forwards WS events, registers commands |
| `scheduler.py` | APScheduler wrapper for cron/one-off tasks |
| `background_worker.py` | Offloads long-running work (ML, etc.) |
| `websocket_manager.py` | Broadcasts subscribed event_bus events to all WS clients |
| `command.py` | `CommandRouter` — classifier → extractor → plugin OR LLM-with-tools (see LLM Architecture) |
| `agent_registry.py` | Device agent coordination (planned, WS at `/agent/ws`) |
| `dates.py` | Deterministic date parsing (LLM never does calendar math) |
| `core.py` | `Core` — dependency bundle passed to plugins |

### Plugin Contract (Backend)

Each plugin in `app/plugins/<name>/` must have `plugin.py` with a class implementing `BasePlugin`:

```python
class BasePlugin(ABC):
    def setup(self, core: Core) -> None           # Initialize controllers, routers, commands
    def get_router(self) -> APIRouter              # FastAPI routes mounted at /<name>
    def get_ws_events(self) -> list[str]           # Event bus topics to forward via WS
    def get_name(self) -> str                      # Plugin id (folder name)
    def get_command(self) -> BaseCommand           # Command intents + handlers
    async def load_state(self) -> None             # Called at startup
    async def save_state(self) -> None             # Called at shutdown
```

Plugins own their DB tables (`<plugin>_<table>`), controllers, and routes.

### Frontend Plugin Manifest (`src/frontend/src/plugins/types.ts`)

```ts
interface PluginManifest {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  page: ComponentType;                    // Full page route
  widgets: { hero: ComponentType|null; small: ComponentType|null; wide?: ComponentType|null };
  commandRenderers?: Partial<Record<string, ComponentType<{ data: any }>>>; // Maps intent name → React component
}
```

Exported from `src/frontend/src/plugins/index.ts` as `plugins` array.

### LLM Architecture (see `docs/llm-architecture.md`)

**Two LLMs, separate roles:**

| | Extractor (local) | GeneralLLM (cloud) |
|---|---|---|
| Model | `qwen2.5-1.5b-instruct-q4_k_m.gguf` via llama-cpp | `openai/gpt-oss-120b` via OmniRoute |
| Job | Slot extraction: input + pydantic schema → JSON | Reasoning, Q&A, tool calling |
| Temp | 0 | 0.3 |
| Trigger | Classifier confidence ≥ 0.7 | Fallback (<0.7) or explicit `llm` mode |

**Routing (`CommandRouter.process_stream`):**
1. `mode=="llm"` → skip classifier, go straight to GeneralLLM with tools
2. `mode=="normal"` → IntentClassifier (sentence embeddings + cosine similarity)
   - ≥ 0.7 → Extractor fills intent's `slots` schema → `plugin.handle()` → result
   - < 0.7 → GeneralLLM with tools (tool defs built from `IntentSpec`)

**IntentSpec is the single contract** — feeds classifier examples, extractor schema, OpenAI tool defs, status text, write-gate (`type: "write"`).

**Tool loop:** System prompt → stream → accumulate tool calls → execute reads immediately, **writes pause for user confirmation** via SSE `confirm_write` event + `/command/confirm-write` → loop (max 10 rounds).

**SSE events:** `text`, `tool_start`, `tool_end`, `confirm_write`, `result`.

**Date rule:** LLMs never parse dates. Slots accept verbatim phrases ("Friday", "tomorrow"); `app/core/dates.py::parse_date()` converts deterministically.

## Key Conventions

- **No global state libraries** — frontend receives state via WebSocket; backend `AppState` is the source of truth.
- **Backend plugins own tables** — naming: `<plugin>_<table>` (e.g., `tasks_labels`).
- **Per-plugin controllers** — business logic lives in `controller/` subfolder.
- **TypeScript strict** — no `any`; prefer existing components/utils over duplicates.
- **Don't install deps without asking** — check `package.json` / `requirements.txt` first.
- **Don't modify unrelated files** — stay scoped to the task.
- **Don't commit changes** — user handles git.

## Adding a Plugin

1. Create `src/backend/app/plugins/<name>/` with `plugin.py`, `command.py`, `routes.py`, `schemas.py`, `controller/`
2. Implement `BasePlugin` + `BaseCommand` (define `IntentSpec[]` with `slots` as Pydantic models)
3. Create frontend manifest in `src/frontend/src/plugins/<name>/index.tsx`
4. Add to `src/frontend/src/plugins/index.ts` export array
5. Restart backend — `PluginManager` auto-discovers

## Environment

- `.env` in `src/backend/` (gitignored) for `IP_ADDR`, `TOTO_DB_PATH`, `AGENT_SHARED_SECRET`, OmniRoute API key
- Database: `data/toto.db` (SQLite, created on first run)
- Tailscale for remote access (certs + `IP_ADDR` for CORS)

## Useful References

- `docs/llm-architecture.md` — detailed LLM/tool-calling design
- `docs/plugins/tasks/overview.md` — tasks plugin data model
- `src/backend/app/schemas/base_command.py` — `IntentSpec`, `CommandResult`, `MatchResult`
- `src/backend/app/schemas/base_plugin.py` — `BasePlugin` abstract class