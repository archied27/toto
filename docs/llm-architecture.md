# Toto LLM architecture

How commands are routed, extracted, and answered. Covers the tool-calling work
(commit `3f0de49`) plus the working-tree extensions (web plugin, richer
task/weather read intents, per-plugin command renderers).

## Big picture: two LLMs, one router

Toto runs two deliberately different LLMs that never overlap in role:

| | `Extractor` | `GeneralLLM` |
|---|---|---|
| File | `app/ai/llm.py` | `app/ai/llm.py` |
| Model | local `qwen2.5-1.5b-instruct-q4_k_m.gguf` via llama-cpp | `openai/gpt-oss-120b` via OmniRoute (OpenAI-compatible) |
| Job | Deterministic slot extraction — command + pydantic schema → JSON | Reasoning / Q&A / tool calling, grounded in tool results |
| Temperature | 0 | 0.3 |
| When it runs | only when a plugin intent matched with high confidence | low-confidence fallback, or explicit `llm` mode |

Slot extraction is cheap, private, and schema-grounded
(`response_format={"type":"json_object","schema":...}`, 256 max tokens), and runs
off the event loop via `asyncio.to_thread`. The general LLM never does structured
extraction; it reasons and calls tools.

## Command routing

Every command enters one router (`CommandRouter`, `app/core/command.py`), exposed
two ways:

- `POST /command` — classic request/response → `CommandResult`.
- `POST /command/stream` — SSE, streams events; what the frontend uses.

`process_stream(raw, mode)`:

1. **`mode == "llm"`** — skip the classifier entirely, go straight to LLM-with-tools
   (the explicit "LLM" toggle in the command bar).
2. **`mode == "normal"`** — **intent classifier first** (`app/ai/intent_classsifier.py`):
   embeds the input with `all-MiniLM-L6-v2` and cosine-matches against every plugin
   intent's example utterances.
   - confidence **≥ 0.7** → plugin path: `Extractor` fills the intent's slot schema →
     `plugin.handle()` → result.
   - confidence **< 0.7** → fall through to the general LLM **with tools**.

The older non-streaming `process()` has an extra band: `[0.5, 0.7)` returns
`NEEDS_CONFIRMATION` (`{intent, plugin, confidence, raw}`); the frontend confirms,
then `POST /command/confirm` re-runs without re-classifying. Below 0.5 it drops to
`general_llm.ask()`.

So the deterministic, repeatable 80% goes through the classifier cheaply; the big
LLM is only invoked when the classifier is unsure or the user asks for it.

## Tool calling — `IntentSpec` is the single contract

One declarative object drives five consumers. An `IntentSpec`
(`app/schemas/base_command.py`) carries `name`, `command_name`, `description`,
`type` (`nav`/`read`/`write`), `examples`, `slots` (a pydantic model),
`slot_examples`, and `loading_msg`. From a single spec the system derives:

- the **classifier's** training examples
- the **extractor's** target schema (`slots.model_json_schema()`)
- the **OpenAI tool definition** (`intent_to_tool()`) — name validated against
  `TOOL_NAME_RE`, parameters from the schema
- the **status line** shown while the tool runs (`tool_status_text()`,
  "Show Today's Tasks" → "Checking today's tasks…")
- the **write gate** — `type == "write"` means the LLM needs explicit user
  confirmation before the tool executes

At startup `register_plugin()` collects every plugin's intents. `_ensure_built()`
builds `build_tools(plugins, ("read", "write"))` (the tool list, cached) and
`build_tool_index()` (name → plugin+spec, so a tool call is executable). `nav`
intents are excluded — navigating is a frontend concern.

## The streaming tool loop

`_llm_stream()` is the heart of the system:

1. System prompt (`TOOL_SYSTEM_PROMPT`): call tools for live data, answer in
   markdown starting at h2, no "Certainly!" filler, cap web search at 2 uses, and
   finish with a short source summary ("Sources: …").
2. Stream chunks. **Tool calls arrive incrementally** — delta fragments accumulate
   per `tc.index` (`id`, `name`, `arguments`) as they stream.
3. No tool calls → answer is complete, return.
4. Otherwise append the reconstructed assistant `tool_calls` message, execute each
   call, append the `tool` result message, and **loop** — up to `MAX_TOOL_ROUNDS = 10`.

Per executed tool:

- **read** — emit `tool_start` → execute → emit `tool_end`. Execution is
  `plugin.handle(intent, args, raw)`; a raised error becomes text fed back to the
  model (`"Error: …"`), so the LLM can adapt rather than crash.
- **write** — the stream **pauses**. It emits a `confirm_write` event carrying a
  `token`, then awaits an `asyncio.Event` for up to `WRITE_CONFIRM_TIMEOUT = 120s`.
  The frontend shows a confirm dialog; `POST /command/confirm-write` →
  `resolve_write()` sets the event. Confirmed → execute; declined → feed the model
  "The user declined this action. Do not claim that it was performed."

## SSE event vocabulary

| event | purpose |
|---|---|
| `text` | streamed markdown answer fragment |
| `tool_start` | tool about to run (`tool`, `plugin`, `status`) |
| `tool_end` | tool finished, result echoed |
| `confirm_write` | write gate — needs user decision (`token`, `title`, `args`) |
| `result` | terminal `CommandResult` (flattened to `{success, action, response, data}`) |

Framed as `data: {json}\n\n`. The frontend (`CommandBar.tsx` parses it) shows each
tool as a muted status line — plugin icon + status text, spinner → check — keeps
the last `MAX_TOOLS = 3` visible, and re-renders the markdown answer on every
chunk. `result` with `action: "navigate"` triggers page navigation; `LLM_RESPONSE`
keeps the already-streamed view; anything else renders through the plugin's
command renderer.

## Plugin-owned rendering

`CommandResult` is transport-agnostic (`success`, `action`, `response`, `data`).
**The action name is the routing key**: `useCommandRegistry()` merges every
plugin's `commandRenderers` (keyed by intent name — `show_pollen`,
`forecast_for_date`, `add_task`, …) into one map; a renderer is a React component
receiving `data`. Backend-only plugins like **web** register a manifest with no
page/widgets purely so tool-status lines can show their icon.

## The "LLM never parses dates" rule

Every date-bearing slot schema (tasks, weather) tells the model to copy the user's
date phrase **verbatim** ("Friday", "tomorrow", "next week") — never convert.
Conversion happens in `app/core/dates.py` `parse_date()`, a deterministic parser
(dateparser, future-preference, plus a custom resolver for "this/next <weekday>"
and "weekend"); it never raises, returns `None` on failure. Rationale: models are
unreliable at calendar math, so they're explicitly barred from doing it; slot
examples reinforce the pattern. Formatting rules (e.g. task titles) live in slot
descriptions, not the model's whims.

## External devices (planned, not built)

`docs/agent-registry.md` is a design plan (status: not implemented) to let the LLM
call tools on connected devices (laptop, phone, ESP32) that dial **out** to the
backend over `/agent/ws`. Key locked-in decisions: the LLM tool list must be
**recomputed live** from currently-connected devices (never cached); device
capabilities get a `write` flag that flows through the **same confirm-write gate**
as plugin writes; integrates additively into `CommandRouter` via a
`device__{device}__{action}` naming scheme with request-id correlation for
dispatch. Dependency-injected, no new deps.

## Architecture decisions, condensed

1. **Small-local / big-cloud split** — extraction and reasoning never share a
   model; extraction is deterministic, cheap, private.
2. **Classifier-first, tools as fallback** — deterministic common path; LLM only
   when unsure or asked.
3. **`IntentSpec` as the single source of truth** — one declarative object feeds
   classifier, extractor, tool defs, status text, and the write gate.
4. **The LLM is disallowed from math/formatting it's bad at** — dates copied
   verbatim, titles formatted by instruction.
5. **Writes are gated, reads are fire-and-forget** — `type` on the intent is the
   security boundary; confirmation is token-keyed and survives the SSE stream.
6. **One SSE protocol carries everything** — text, tool lifecycle, and interactive
   confirmation share a single event vocabulary.
7. **Plugins own their UI** — backend returns `{action, data}`; frontend manifests
   map action → React renderer.
8. **Live recomputation** — tools/index rebuild lazily on plugin registration; the
   device plan extends this to per-request live merging.

## File map

- `app/core/command.py` — `CommandRouter`: routing, `_llm_stream` tool loop,
  write gate, SSE event emission.
- `app/ai/llm.py` — `Extractor` (local slot extraction), `GeneralLLM` (cloud),
  `intent_to_tool`/`build_tools`/`build_tool_index`/`tool_status_text`.
- `app/ai/intent_classsifier.py` — `IntentSimilarityModel` (sentence embeddings +
  cosine matching).
- `app/schemas/base_command.py` — `IntentSpec`, `MatchResult`, `CommandResult`,
  `BaseCommand`.
- `app/core/dates.py` — `parse_date()` (never-raising NL date → ISO).
- `app/plugins/*/command.py` — intents per plugin (`IntentSpec` lists + handlers).
- `app/plugins/web/` — `web_search` read intent backed by `ddgs`.
- `main.py` — `POST /command`, `POST /command/stream`, `POST /command/confirm`,
  `POST /command/confirm-write`.
- `src/frontend/.../CommandBar.tsx` — SSE consumer, mode toggle, write dialog.
- `src/frontend/.../StreamingLLMResponse.tsx` — tool-status lines + markdown.
- `src/frontend/.../MarkdownRenderer.tsx` — styled markdown (react-markdown +
  GFM + highlight + raw HTML).
- `src/frontend/.../plugins/*/index.tsx` — manifests: icon, page, widgets,
  `commandRenderers`.
