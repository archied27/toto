# Agent Tools Panel - Implementation Plan

## Context

The user has a laptop agent connected to the Toto backend that exposes tools (currently `open_toto_dev_environment`). Currently, these tools are only accessible via the LLM (which calls them with the `device__laptop__open_toto_dev_environment` tool name). The user wants a direct UI to call agent tools manually - swipe up on the dot indicator to bring up a panel showing connected agents and their tools, organized by agent with icons.

## Current Architecture

### Backend
- **AgentRegistry** (`src/backend/app/core/agent_registry.py`): Manages connected devices, their capabilities, and dispatches tool calls
- **Agent WebSocket** (`/agent/ws`): Devices connect here and register capabilities
- **CommandRouter** (`src/backend/app/core/command.py`): Builds OpenAI tool definitions from agent capabilities (`device__{device_id}__{action}`) and routes calls via `AgentRegistry.dispatch()`
- **Laptop Agent** (`src/agents/laptop-agent.py`): Connects to backend, registers `open_toto_dev_environment` capability with `write: true`

### Frontend
- **DotsIndicator** (`src/frontend/src/components/DotsIndicator.tsx`): Bottom navigation dots; click toggles CommandBar
- **CommandBar** (`src/frontend/src/components/CommandBar.tsx`): LLM command interface with streaming SSE
- **App.tsx**: Main layout with SwipeNavigator, DotsIndicator, CommandBar
- **WebSocketContext**: Handles backend WebSocket events

## Required Changes

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
                "connected_at": device.connected_at.isoformat(),
                "capabilities": [
                    {
                        "name": cap.name,
                        "description": cap.description,
                        "parameters": cap.parameters,
                        "write": cap.write,
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

### 2. Frontend - Agent Tools Panel Component (New)

Create `src/frontend/src/components/AgentToolsPanel.tsx`:
- Slides up from bottom (like CommandBar) when triggered
- Shows connected agents grouped by device_id
- Each agent has an icon (Laptop for "laptop", Smartphone for "phone", etc.)
- Each tool shows name, description, and Lucide icon
- Click tool → calls POST `/agents/{device_id}/{action}`
- Handles write confirmation if tool has `write: true` (reuse WriteConfirmDialog pattern)
- Shows loading state during execution
- Shows result toast/notification

### 3. Frontend - DotsIndicator Enhancement

Modify `src/frontend/src/components/DotsIndicator.tsx`:
- Add touch swipe-up detection (or long-press + drag up)
- When swiped up, trigger AgentToolsPanel instead of toggling CommandBar
- Keep click behavior for CommandBar toggle

### 4. Frontend - App.tsx Integration

- Add AgentToolsPanel state (open/closed)
- Pass agent data from new API endpoint
- Position panel above DotsIndicator (fixed bottom, slide up animation)

### 5. Icon Mapping

Create agent icon mapping in frontend:
```tsx
const agentIcons: Record<string, LucideIcon> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  watch: Watch,
  // fallback
  default: Cpu,
}
```

Tool icons: Use a default (Zap, Play, Terminal, etc.) or allow agents to specify icon names in capabilities.

## Implementation Steps

### Phase 1: Backend API
1. Add GET `/agents` endpoint in `main.py`
2. Add POST `/agents/{device_id}/{action}` endpoint in `main.py`
3. Import HTTPException from fastapi

### Phase 2: Frontend Types & API
1. Add types for Agent/Capability in `src/frontend/src/plugins/types.ts` or new `src/frontend/src/agents/types.ts`
2. Add API functions in `src/frontend/src/hooks/api.ts` (or create `useAgents` hook)

### Phase 3: Frontend Components
1. Create `AgentToolsPanel.tsx` component
2. Modify `DotsIndicator.tsx` for swipe-up gesture
3. Update `App.tsx` to integrate panel

### Phase 4: Polish
1. Add slide-up animation (CSS transition)
2. Handle write confirmations for `write: true` tools
3. Add result notifications
4. Test with laptop agent

## Files to Modify/Create

| File | Change Type |
|------|-------------|
| `src/backend/main.py` | Add 2 new endpoints |
| `src/frontend/src/components/AgentToolsPanel.tsx` | **New file** |
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
6. See "laptop" agent with Laptop icon
7. See "open_toto_dev_environment" tool with icon
8. Click tool → confirm dialog appears (since write: true)
9. Confirm → tool executes on laptop, result shown
10. Verify dev environment opens (Firefox, VS Code, terminal)

## Notes

- The panel should be a separate "layer" like CommandBar (fixed, full-width, slide up)
- Reuse existing patterns: WriteConfirmDialog for confirmations, apiFetch for requests
- Agent icons can be extended later; start with lucide-react icons
- Consider adding WebSocket event for real-time agent connect/disconnect updates
- The swipe gesture should work on both touch and mouse (for desktop testing)