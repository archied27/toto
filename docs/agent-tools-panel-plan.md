# Agent Tools Panel - Implementation Plan

## Context

The user has a laptop agent connected to the Toto backend that exposes tools (currently `open_toto_dev_environment`). Currently, these tools are only accessible via the LLM (which calls them with the `device__laptop__open_toto_dev_environment` tool name). The user wants a direct UI to call agent tools manually - swipe up on the dot indicator to bring up a panel showing connected agents and their tools, organized by agent with icons.

## Design Principles

- **Agents describe themselves** — each agent provides the Lucide icon name for itself and for each of its tools at registration time. The frontend resolves these names dynamically; there is **no hardcoded per-device icon map** (no "laptop → Laptop" mapping in the frontend). The frontend only validates the name and falls back to a default when the name is missing/unknown.
- **Agents organize their tools** — each capability optionally declares a `group` (e.g. "Development", "Media", "System"). The panel renders tools inside collapsible folder sections per group; ungrouped tools sit at the top level of the agent's card.

## Current Architecture

### Backend
- **AgentRegistry** (`src/backend/app/core/agent_registry.py`): Manages connected devices, their capabilities, and dispatches tool calls
- **Agent WebSocket** (`/agent/ws`): Devices connect here and register capabilities
- **CommandRouter** (`src/backend/app/core/command.py`): Builds OpenAI tool definitions from agent capabilities (`device__{device_id}__{action}`) and routes calls via `AgentRegistry.dispatch()`
- **Laptop Agent** (`src/agents/laptop-agent.py`): Connects to backend, registers `open_toto_dev_environment` capability with `write: true`, plus its own icon and per-tool icons/groups (see Schema Changes)

### Frontend
- **DotsIndicator** (`src/frontend/src/components/DotsIndicator.tsx`): Bottom navigation dots; click toggles CommandBar
- **CommandBar** (`src/frontend/src/components/CommandBar.tsx`): LLM command interface with streaming SSE
- **App.tsx**: Main layout with SwipeNavigator, DotsIndicator, CommandBar
- **WebSocketContext**: Handles backend WebSocket events

## Required Changes

### 0. Schema Changes (Agent-Provided Icons & Tool Grouping)

Extend the registration payload so agents describe themselves and organize their own tools.

**`ConnectedDevice`** gains an optional display name and icon:

```python
class ConnectedDevice(BaseModel):
    device_id: str
    websocket: Any = Field(exclude=True)
    display_name: Optional[str] = None   # e.g. "Archie's Laptop"; falls back to device_id
    icon: Optional[str] = None           # Lucide icon name, e.g. "laptop"; fallback: "cpu"
    capabilities: list[DeviceCapability] = Field(default_factory=list)
    connected_at: datetime = Field(default_factory=datetime.utcnow)
```

**`DeviceCapability`** gains an optional per-tool icon and group:

```python
class DeviceCapability(BaseModel):
    name: str
    description: str
    parameters: dict = Field(default_factory=dict)
    write: bool = False
    icon: Optional[str] = None           # Lucide icon name, e.g. "terminal"; fallback: "zap"
    group: Optional[str] = None          # e.g. "Development"; None = ungrouped (top level)
```

**Registration message** (`/agent/ws` first message) becomes:

```json
{
  "type": "register",
  "device": "laptop",
  "token": "...",
  "display_name": "Archie's Laptop",
  "icon": "laptop",
  "capabilities": [
    {
      "name": "open_toto_dev_environment",
      "description": "Open the Toto dev environment",
      "parameters": {},
      "write": true,
      "icon": "rocket",
      "group": "Development"
    }
  ]
}
```

Rules:
- Icon values are **kebab-case Lucide icon names** (e.g. `"laptop"`, `"rocket-minor"`, `"folder-git-2"`). The frontend keeps a dynamic registry of the icons it bundles and resolves the name at render time; unknown or missing names fall back to `Cpu` (agent) / `Zap` (tool).
- Icons are presentation-only: never sent to the LLM, never included in `build_tools()` output.
- `group` is a free-text label; the panel groups by exact string. Tools with `group: null` render above the group folders in the agent's card.
- Everything is optional with sensible defaults, so existing agents keep working unchanged.

### 1. Backend API Endpoints (New)

Add to `src/backend/main.py`:

```python
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
```

### 2. Frontend - Dynamic Icon Resolution

Replace the planned hardcoded `agentIcons` map with a name-based resolver. Create `src/frontend/src/lib/icons.ts`:

```tsx
import * as LucideIcons from "lucide-react";
import { Cpu, Zap, type LucideIcon } from "lucide-react";

const REGISTRY = LucideIcons as unknown as Record<string, LucideIcon>;

/** Resolve a kebab-case Lucide icon name ("rocket-minor") to a component. */
export function resolveIcon(name?: string | null, fallback: LucideIcon = Zap): LucideIcon {
  if (!name) return fallback;
  return REGISTRY[toPascalCase(name)] ?? fallback;
}

export const AGENT_FALLBACK_ICON = Cpu;
export const TOOL_FALLBACK_ICON = Zap;
```

Notes:
- `resolveIcon` converts kebab-case → PascalCase and looks it up in the bundled `lucide-react` namespace. Unknown names → fallback icon (agent: `Cpu`, tool: `Zap`). Optionally log a dev warning so typos surface.
- No per-device-id mapping anywhere in the frontend — the agent's own `icon` field is the single source of truth.
- If tree-shaking/bundle size from `import * as LucideIcons` is a concern, restrict the import to a curated subset with the same resolver API (decision deferred to implementation).

### 3. Frontend - Agent Tools Panel Component (New)

Create `src/frontend/src/components/AgentToolsPanel.tsx`:
- Slides up from bottom (like CommandBar) when triggered
- Shows connected agents grouped by device_id, using `display_name` (fallback: `device_id`) and the agent's resolved icon
- Within each agent card, tools are organized into **collapsible folder sections by `group`**:
  - Group folders show the group name and a folder icon; tap to expand/collapse
  - Ungrouped tools (`group: null`) render directly in the card above the folders
  - Empty groups (zero tools) are not rendered
- Each tool row shows its resolved icon, name, and description
- Click tool → calls POST `/agents/{device_id}/{action}`
- Handles write confirmation if tool has `write: true` (reuse WriteConfirmDialog pattern)
- Shows loading state during execution
- Shows result toast/notification

### 4. Frontend - DotsIndicator Enhancement

Modify `src/frontend/src/components/DotsIndicator.tsx`:
- Add touch swipe-up detection (or long-press + drag up)
- When swiped up, trigger AgentToolsPanel instead of toggling CommandBar
- Keep click behavior for CommandBar toggle

### 5. Frontend - App.tsx Integration

- Add AgentToolsPanel state (open/closed)
- Pass agent data from new API endpoint
- Position panel above DotsIndicator (fixed bottom, slide up animation)

## Implementation Steps

### Phase 1: Schema & Backend API
1. Add `icon` + `group` to `DeviceCapability`, `display_name` + `icon` to `ConnectedDevice` in `agent_registry.py`; parse new registration fields in `handle_agent_connection`
2. Add GET `/agents` endpoint in `main.py`
3. Add POST `/agents/{device_id}/{action}` endpoint in `main.py`
4. Import HTTPException from fastapi

### Phase 2: Laptop Agent Update
1. Add `display_name` and `icon` to laptop-agent registration
2. Add `icon` + `group` to the `open_toto_dev_environment` capability

### Phase 3: Frontend Types & API
1. Add types for Agent/Capability in `src/frontend/src/plugins/types.ts` or new `src/frontend/src/agents/types.ts`
2. Add API functions in `src/frontend/src/hooks/api.ts` (or create `useAgents` hook)
3. Create `src/frontend/src/lib/icons.ts` dynamic Lucide resolver

### Phase 4: Frontend Components
1. Create `AgentToolsPanel.tsx` component (with group folders + collapsible sections)
2. Modify `DotsIndicator.tsx` for swipe-up gesture
3. Update `App.tsx` to integrate panel

### Phase 5: Polish
1. Add slide-up animation (CSS transition)
2. Handle write confirmations for `write: true` tools
3. Add result notifications
4. Test with laptop agent

## Files to Modify/Create

| File | Change Type |
|------|-------------|
| `src/backend/app/core/agent_registry.py` | Extend `DeviceCapability`/`ConnectedDevice` schema, parse registration |
| `src/backend/main.py` | Add 2 new endpoints |
| `src/agents/laptop-agent.py` | Add display name, agent icon, tool icon + group |
| `src/frontend/src/components/AgentToolsPanel.tsx` | **New file** |
| `src/frontend/src/lib/icons.ts` | **New file** — dynamic Lucide icon resolver |
| `src/frontend/src/components/DotsIndicator.tsx` | Add swipe-up handler |
| `src/frontend/src/App.tsx` | Integrate panel state & render |
| `src/frontend/src/hooks/api.ts` | Add agent API functions |
| `src/frontend/src/plugins/types.ts` | Add Agent/Capability types |

## Verification

1. Start backend: `cd src/backend && source .venv/bin/activate && uvicorn main:app ...`
2. Start laptop agent: `python src/agents/laptop-agent.py`
3. Start frontend: `cd src/frontend && npm run dev`
4. Open app in browser
5. Swipe up on dot indicator → AgentToolsPanel appears
6. See the laptop agent using its self-declared `display_name` and resolved `icon` (not a frontend hardcoded map)
7. See "Development" group folder; expand it to reveal "open_toto_dev_environment" with its declared icon
8. Click tool → confirm dialog appears (since write: true)
9. Confirm → tool executes on laptop, result shown
10. Verify dev environment opens (Firefox, VS Code, terminal)
11. Register a test capability with an unknown icon name (e.g. `"icon": "not-a-real-icon"`) → panel shows the fallback tool icon (`Zap`), no crash

## Notes

- The panel should be a separate "layer" like CommandBar (fixed, full-width, slide up)
- Reuse existing patterns: WriteConfirmDialog for confirmations, apiFetch for requests
- Icons are declared by the agent and resolved by name in the frontend; the frontend never maps device_id → icon
- Group folders are purely presentational (frontend-side); the agent only sends a flat `group` string per capability
- Consider adding WebSocket event for real-time agent connect/disconnect updates
- The swipe gesture should work on both touch and mouse (for desktop testing)