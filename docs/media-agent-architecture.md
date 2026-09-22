# Media Agents Architecture

## Summary

The media plugin should become a coordinator for media libraries and playback agents.
An agent owns the files and the player on a host; Toto owns the user-facing media
model, command routing, aggregation, and dashboard presentation.

The important distinction is:

- **TMDB identifies media.** A movie or series is represented by its TMDB ID, with
  season and episode numbers for episodic media.
- **An agent owns availability and playback.** The same movie may be available on
  zero, one, or several connected agents, and each agent may have different
  playback progress.
- **The media plugin is the authority for the combined view.** It should not make
  the frontend or the LLM join TMDB results, agent capabilities, and playback
  responses itself.

This removes the backend's local MPV responsibility entirely while allowing a
laptop, desktop, NAS, or future remote player to expose the same media contract.

## Recommended Shape

```text
TMDB search/details
        |
        v
Media plugin --------------------> Media page and dashboard widget
  catalog + availability              continue watching / now playing
  playback sessions                   controls and progress
        ^
        |
Agent registry --------------------> connected media agents
  capability discovery                library + player protocol
        ^
        |
Agent WebSocket
```

The existing generic agent tool mechanism remains valuable for natural-language
fallbacks and manual tools. Media should additionally have a typed plugin-level
protocol, because availability, playback state, events, reconnects, and progress
are a durable domain contract rather than one-off LLM tool calls.

## Agent Contract

An agent should declare a media capability during registration, for example:

```json
{
  "name": "media",
  "version": 1,
  "display_name": "Living Room PC",
  "features": [
    "library",
    "playback",
    "pause",
    "seek",
    "next",
    "previous",
    "stop"
  ]
}
```

The capability declaration describes what the host can do; it should not contain
the entire library. The backend requests or receives library data separately.

### Library operations

The media capability should support:

- `media.library.list` with optional media type, TMDB ID, and pagination filters
- `media.library.refresh` to rescan files and reconcile metadata
- `media.library.get` for one TMDB movie, series, season, or episode

Each availability record should include:

```json
{
  "agent_id": "living-room-pc",
  "media_type": "movie",
  "tmdb_id": 550,
  "season_number": null,
  "episode_number": null,
  "title": "Fight Club",
  "duration_seconds": 8340,
  "available": true,
  "source_id": "stable-agent-local-id"
}
```

`source_id` is an opaque stable identifier known to the agent. It avoids exposing
file paths and lets the agent change its filesystem layout without invalidating
Toto's catalog references. A series should expose episode-level availability so
Toto can identify the next playable episode accurately.

### Playback operations

Playback commands should use an availability or source identifier, never a raw
path supplied by the frontend or LLM:

- `media.play(source_id, start_seconds?)`
- `media.pause`
- `media.resume`
- `media.toggle_pause`
- `media.stop`
- `media.seek(offset_seconds)` or `media.seek_to(position_seconds)`
- `media.next`
- `media.previous`
- `media.get_state`

The agent validates that the source belongs to its own library and launches or
controls its local player. The backend should require confirmation only for
actions that the product classifies as writes; ordinary playback controls can be
direct actions.

## Playback State and Events

Polling alone is not sufficient for a responsive dashboard. The agent should send
`media.playback.changed` events over the existing agent WebSocket whenever one of
these changes:

- current item, play/pause state, or stopped state
- position or duration
- queue/episode transition
- player availability or error

The event should be normalized and include an event timestamp and monotonically
increasing agent sequence number:

```json
{
  "type": "media.playback.changed",
  "agent_id": "living-room-pc",
  "sequence": 1842,
  "occurred_at": "2026-09-22T20:15:00Z",
  "state": {
    "status": "playing",
    "source_id": "movie-550",
    "tmdb_id": 550,
    "media_type": "movie",
    "position_seconds": 421,
    "duration_seconds": 8340,
    "updated_at": "2026-09-22T20:15:00Z"
  }
}
```

The backend should also poll `media.get_state` at a modest interval while an
agent reports `playing`, and once after a command. This repairs missed events and
captures progress when an agent disconnects. The agent remains the source of
truth for current playback; the media plugin persists the last known progress.

Progress should be written with throttling, for example every 15 to 30 seconds,
on pause, on stop, on item transition, and on disconnect. Mark an item complete
only when the agent reports completion or the position passes a defined threshold
(for example 90 percent), not merely because it was started.

## Backend Ownership

### Media plugin

The media plugin should no longer launch or control MPV directly. It owns:

1. **Catalog index** keyed by `(agent_id, media_type, tmdb_id, season, episode)`.
2. **Availability reconciliation** when agents connect, refresh, or disappear.
3. **Playback session state** keyed by agent and source ID.
4. **Command handlers** that resolve a selected media item to an agent and source.
5. **Continue-watching queries** across all agents.
6. **Dashboard priority calculation** based on active playback and useful resume
   content.

The local MPV implementation should be migrated into the first media-capable
agent. External agents then use the same WebSocket protocol without requiring
special backend code.

### Agent registry

The registry should remain responsible for connection lifecycle and request
routing. Add typed media messages and subscriptions there, but do not put TMDB
joins or dashboard policy into `AgentRegistry`.

The registry should expose safe operations such as:

- list connected agents with media capability
- dispatch a media command to a specific agent
- publish agent connect, disconnect, and media event notifications
- reject stale events from an older connection or lower sequence number

### Database

The current `mpv_*` tables are a useful starting point but are local-host
specific. A future schema should separate identity from availability:

- `media_items`: canonical TMDB metadata and media identity
- `media_sources`: agent ID, source ID, media item reference, availability,
  duration, and last reconciliation time
- `media_progress`: agent ID, media identity/source, position, completion, and
  last watched time
- `media_playback_sessions`: current status, source, position, duration, and
  last event sequence

Use migrations or a compatibility layer rather than silently changing existing
`mpv_*` tables. Existing local data should be imported into the new model with a
stable local agent ID such as `local-mpv`.

## API and Commands

The media plugin should expose stable backend endpoints for the UI and typed
plugin commands for the LLM. Suggested endpoints:

- `GET /media/search?query=&media_type=`: TMDB search enriched with availability
- `GET /media/items/{tmdb_id}`: details plus per-agent availability
- `GET /media/continue-watching`: ordered resume items across agents
- `GET /media/playing`: all current sessions, or a selected agent's session
- `POST /media/play`: `{agent_id, source_id, start_seconds?}`
- `POST /media/{agent_id}/pause`
- `POST /media/{agent_id}/resume`
- `POST /media/{agent_id}/stop`
- `POST /media/{agent_id}/seek`: `{position_seconds}`
- `POST /media/{agent_id}/next`
- `POST /media/{agent_id}/previous`
- `POST /media/{agent_id}/refresh`

The LLM should see semantic media intents such as `search_media`, `play_media`,
`pause_media`, and `show_playing`. It should not need to know the generated
agent tool name. `play_media` resolves ambiguity as follows:

1. Use the selected `agent_id` and `source_id` when supplied by the UI.
2. If only a TMDB ID is supplied, find available sources.
3. If exactly one source exists, play it.
4. If several exist, ask the user which agent to use.
5. If none exist, return the TMDB result as unavailable rather than attempting a
   raw path or generic agent call.

This supports both “play this” from a search card and “play Fight Club on the
living room PC” from the command bar.

## Continue Watching and Dashboard Priority

`continue watching` should be a query over persisted progress, not a static list
maintained by the frontend. The result should include:

- canonical media identity and artwork
- agent name and agent ID
- source ID
- current/next episode information
- position, duration, and percentage
- availability and last-watched time
- a direct play action

For series, return the next unfinished playable episode and retain the series
identity for display. Do not collapse progress from different agents into one
row unless the product explicitly chooses a primary source; watching a movie on
two hosts is two independent resume positions.

Suggested priority policy:

- active playback: highest priority, e.g. 100
- paused playback: high priority, e.g. 90
- recently watched unfinished item: score by recency and progress, capped below
  active playback
- available library with no progress: zero dashboard priority by default
- no connected source: remove from continue watching or mark unavailable

The media state slice should contain both the dashboard priority and the data
needed by its widget. On every meaningful playback or progress change, update
the `media` slice and emit the existing rerank event. The dashboard service can
then continue to rank plugins without knowing media-specific rules.

The media widget should render from the state snapshot and subscribe to normal
WebSocket state updates. It should not call each agent or poll TMDB directly.

## UI Flow

1. The user searches for a movie or series.
2. TMDB results are enriched with `available_on` entries from the media plugin.
3. A result shows “On file” and the available agent names; unavailable results
   remain useful for discovery but have no play action.
4. Pressing play sends the selected `agent_id` and `source_id` to the backend.
5. The backend dispatches to the agent and immediately updates optimistic state
   only after the agent acknowledges the command.
6. Agent events update progress and the dashboard widget in real time.
7. Pause, resume, seek, next, and stop target the active session's agent.
8. On disconnect, the session becomes `offline` and its last progress is retained;
   controls are disabled until that source reconnects.

The UI should show the agent explicitly whenever more than one host is involved.
That prevents a play or pause button from appearing to act globally when it is
actually controlling one machine.

## Failure and Consistency Rules

- Commands must be idempotent where practical. A retry of `pause`, `resume`, or
  `stop` should not create a second player.
- Every command should carry a request ID and receive an acknowledgement with
  the resulting playback state.
- Agent reconnects must replace the old socket without allowing stale events or
  responses to mutate current state.
- A library refresh is incremental and preserves progress rows when a source is
  temporarily missing.
- File paths stay on the agent. They are never sent to the frontend or exposed
  as LLM-facing arguments.
- TMDB API failures should not erase locally known availability or progress.
- If an agent does not support a control, the backend returns a capability error
  and the UI hides or disables that control.

## Plugin Access to Agents

Plugins should not access `AgentRegistry` internals, private device maps, or
agent WebSockets directly. Give plugins a domain-neutral gateway injected through
`Core`:

```python
class AgentGateway(Protocol):
  async def list_agents(self) -> list[AgentInfo]:
    ...

  async def get_capability(
    self,
    agent_id: str,
    capability: str,
  ) -> AgentCapability | None:
    ...

  async def dispatch(
    self,
    agent_id: str,
    capability: str,
    action: str,
    payload: dict,
  ) -> dict:
    ...

  def subscribe(self, event_type: str, handler: Callable) -> None:
    ...
```

`Core` receives an implementation of this interface:

```python
class Core:
  def __init__(
    self,
    event_bus,
    bg_worker,
    scheduler,
    db_manager,
    state,
    agents: AgentGateway,
  ):
    self.agents = agents
```

The media plugin then uses a stable service boundary:

```python
await self.core.agents.dispatch(
  agent_id="laptop",
  capability="media",
  action="play",
  payload={"source_id": source_id},
)
```

The dependency direction is:

```text
Media plugin -> AgentGateway interface -> AgentRegistry implementation
```

The registry remains responsible for connection lifecycle, request IDs,
timeouts, WebSocket routing, reconnects, and event delivery. The media plugin
remains responsible for media identity, availability, progress, and dashboard
policy. Generic agent capabilities remain available for ad hoc LLM tools; typed
capabilities are appropriate when a domain has persistent state, events,
synchronization, and multiple related operations.

## Removing Backend MPV

The following responsibilities should be removed from the backend media plugin:

- `MPVController`
- `MPVSocket`
- backend MPV process launching
- backend media directory scanning
- backend-side file path playback arguments
- local MPV routes such as direct `play` and `toggle_pause`
- backend reliance on `/tmp/mpvsocket`

MPV becomes an implementation detail of the agent. The agent may use MPV today
and VLC, Plex, or another player later without changing the media plugin
protocol.

The agent should have an internal player adapter:

```python
class MediaPlayer:
  async def play(self, source_id: str, start_seconds: int = 0): ...
  async def pause(self): ...
  async def resume(self): ...
  async def stop(self): ...
  async def seek(self, position_seconds: int): ...
  async def get_state(self) -> PlaybackState: ...
```

The agent owns filesystem configuration, scanning, source IDs, MPV IPC, player
lifecycle, current position, and local recovery behavior. Source IDs are opaque
and stable; paths never leave the agent.

## Implementation Phases

### Phase 1: Build agent-side MPV

- Define the typed media capability and normalized playback state.
- Move media directory configuration and scanning into the laptop agent.
- Move MPV launch and IPC control into the agent's `MediaPlayer` adapter.
- Add reliable reads for path, pause, position, duration, and stop.
- Generate stable opaque source IDs instead of exposing file paths.
- Persist progress on a timer and on lifecycle transitions.

### Phase 2: Add the agent gateway

- Define `AgentGateway` and inject it into `Core`.
- Implement the gateway using `AgentRegistry`.
- Add event subscriptions without exposing WebSockets to plugins.
- Add sequence validation, request IDs, timeout handling, and reconnect behavior.

### Phase 3: Add agent media protocol

- Extend registration with a versioned media capability declaration.
- Add library sync, playback command, acknowledgement, and playback event
  messages to the agent WebSocket.
- Implement the protocol in the laptop agent.
- Keep generic agent tools separate from typed media operations.

### Phase 4: Replace the media plugin

- Remove the backend MPV controller, socket, process launching, and directory
  scanning.
- Request library snapshots from connected media agents.
- Dispatch playback only through `Core.agents`.
- Introduce the agent-independent media tables or a compatibility repository.

### Phase 5: Aggregate catalog and progress

- Enrich TMDB search and detail responses with per-agent availability.
- Implement cross-agent continue watching and current playback endpoints.
- Emit media state and rerank events from the media plugin.

### Phase 6: Finish the frontend workflow

- Build availability badges and an agent picker on search/detail views.
- Add play and playback controls bound to a session's agent.
- Add the continue-watching widget as the media plugin's hero/long widget.
- Handle offline, stale progress, command errors, and unsupported controls.

### Phase 7: LLM and polish

- Add semantic media intents and response renderers.
- Add confirmation only where policy requires it.
- Add tests for multiple agents, duplicate TMDB IDs, reconnects, stale events,
  episode progression, and dashboard ranking.

## Decisions to Make Before Implementation

1. **Player scope:** should an agent support one active player or a named set of
   players? Start with one active session per agent unless multi-room playback is
   a near-term requirement.
2. **Source identity:** use opaque stable IDs generated by the agent, not paths.
3. **Progress authority:** agent is authoritative while connected; backend is the
   durable last-known projection.
4. **Multi-agent selection:** require an explicit choice when several sources are
   available; never choose silently based on connection order.
5. **Refresh model:** event-driven initial sync plus periodic reconciliation,
   rather than sending a full library on every WebSocket message.
6. **Dashboard semantics:** active/paused playback outranks resume content;
   unstarted media should not displace useful continue watching.

7. **Migration data:** decide whether existing `mpv_*` progress is migrated into
  `media_progress` under a `local-mpv` agent identity or intentionally reset.

8. **Agent ownership:** start with one active media session per agent. Add named
  players or multi-room playback only when the product requires it.

## Bottom Line

The best approach is to make “media” a typed, stateful agent capability and keep
generic agent tools as a fallback interface. MPV, filesystem scanning, and local
progress belong entirely on the agent. Plugins access agents through an injected
`AgentGateway`, never through registry internals.

Agents report what they own and what they are playing; the media plugin
normalizes that into TMDB-based catalog, availability, progress, and playback
session state. Once that state is the source for both the media page and
dashboard priority, search, play controls, continue watching, and
natural-language commands all use the same model instead of developing separate
assumptions.