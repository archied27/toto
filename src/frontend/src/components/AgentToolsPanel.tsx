import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { apiFetch } from "@/hooks/api";
import WriteConfirmDialog from "./WriteConfirmDialog";
import { cn } from "@/lib/utils";
import {
  AGENT_FALLBACK_ICON,
  TOOL_FALLBACK_ICON,
  resolveIcon,
} from "@/lib/icons";

// ---------------------------------------------------------------------------
// Types (mirror GET /agents response)
// ---------------------------------------------------------------------------

export interface AgentCapability {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  write: boolean;
  /** Lucide icon name declared by the agent; resolved client-side. */
  icon?: string | null;
  /** Group label; null renders the tool ungrouped at the top of the card. */
  group?: string | null;
}

export interface Agent {
  device_id: string;
  display_name?: string | null;
  /** Lucide icon name declared by the agent; resolved client-side. */
  icon?: string | null;
  connected_at: string;
  capabilities: AgentCapability[];
}

interface AgentsResponse {
  agents: Agent[];
}

interface ExecResponse {
  success: boolean;
  result: unknown;
}

type Feedback = { message: string; ok: boolean } | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prettify a snake_case tool name for display. */
function prettyName(name: string) {
  return name.replace(/_/g, " ");
}

/** Pull a human-readable line out of an arbitrary tool result payload. */
function describeResult(result: unknown): string {
  if (result === null || result === undefined) return "Done";
  if (typeof result === "string") return result;
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.message === "string") return r.message;
    if (typeof r.status === "string") return r.status;
  }
  try {
    return JSON.stringify(result);
  } catch {
    return "Done";
  }
}

/** Split capabilities into ungrouped tools and named groups (sorted). */
function groupCapabilities(caps: AgentCapability[]): {
  ungrouped: AgentCapability[];
  groups: [string, AgentCapability[]][];
} {
  const ungrouped: AgentCapability[] = [];
  const map = new Map<string, AgentCapability[]>();
  for (const cap of caps) {
    if (cap.group) {
      const list = map.get(cap.group);
      if (list) list.push(cap);
      else map.set(cap.group, [cap]);
    } else {
      ungrouped.push(cap);
    }
  }
  const groups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  return { ungrouped, groups };
}

// ---------------------------------------------------------------------------
// Tool row
// ---------------------------------------------------------------------------

function ToolRow({
  tool,
  running,
  onClick,
}: {
  tool: AgentCapability;
  running: boolean;
  onClick: () => void;
}) {
  const Icon = resolveIcon(tool.icon, TOOL_FALLBACK_ICON);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={running}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
      )}
    >
      <Icon className="w-4.5 h-4.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium capitalize leading-tight">
          {prettyName(tool.name)}
          {tool.write && (
            <span className="ml-2 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-500 align-middle">
              write
            </span>
          )}
        </span>
        {tool.description && (
          <span className="block text-xs text-muted-foreground truncate">
            {tool.description}
          </span>
        )}
      </span>
      {running && (
        <LoaderCircleIcon className="w-4 h-4 shrink-0 text-muted-foreground animate-spin" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  runningKey,
  onToolClick,
  collapsedGroups,
  onToggleGroup,
}: {
  agent: Agent;
  runningKey: string | null;
  onToolClick: (agent: Agent, tool: AgentCapability) => void;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
}) {
  const AgentIcon = resolveIcon(agent.icon, AGENT_FALLBACK_ICON);
  const { ungrouped, groups } = useMemo(
    () => groupCapabilities(agent.capabilities),
    [agent.capabilities]
  );

  if (agent.capabilities.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Agent header — icon comes from the agent itself, not a frontend map */}
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <AgentIcon className="w-5 h-5 text-foreground" />
        <span className="text-sm font-semibold">
          {agent.display_name || agent.device_id}
        </span>
      </div>

      {/* Ungrouped tools sit directly in the card, above the folders */}
      {ungrouped.map((tool) => (
        <ToolRow
          key={tool.name}
          tool={tool}
          running={runningKey === `${agent.device_id}/${tool.name}`}
          onClick={() => onToolClick(agent, tool)}
        />
      ))}

      {/* Group folders */}
      {groups.map(([group, tools]) => {
        const key = `${agent.device_id}:${group}`;
        const collapsed = collapsedGroups[key] ?? false;
        return (
          <div key={key} className="flex flex-col">
            <button
              type="button"
              onClick={() => onToggleGroup(key)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-muted/60"
            >
              <ChevronDownIcon
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                  collapsed && "-rotate-90"
                )}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </span>
              <span className="text-xs text-muted-foreground/60">
                {tools.length}
              </span>
            </button>
            {!collapsed &&
              tools.map((tool) => (
                <ToolRow
                  key={tool.name}
                  tool={tool}
                  running={runningKey === `${agent.device_id}/${tool.name}`}
                  onClick={() => onToolClick(agent, tool)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * Bottom sheet listing connected agents and their tools, organized into
 * collapsible group folders. Icons and grouping are declared by each agent
 * at registration time and resolved client-side (see lib/icons.ts).
 *
 * Rendered persistently and toggled via `open` so the slide-up transition
 * plays in both directions; data is (re)fetched whenever it opens.
 */
export default function AgentToolsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [pendingWrite, setPendingWrite] = useState<{
    agent: Agent;
    tool: AgentCapability;
  } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AgentsResponse>("/agents");
      setAgents(data.agents);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch whenever the panel opens so connect/disconnect is reflected.
  useEffect(() => {
    if (open) {
      setFeedback(null);
      fetchAgents();
    }
  }, [open, fetchAgents]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const runTool = useCallback(
    async (agent: Agent, tool: AgentCapability) => {
      const key = `${agent.device_id}/${tool.name}`;
      setRunningKey(key);
      setFeedback(null);
      try {
        const res = await apiFetch<ExecResponse>(
          `/agents/${agent.device_id}/${tool.name}`,
          { method: "POST", body: JSON.stringify({ payload: {} }) }
        );
        setFeedback({ message: describeResult(res.result), ok: res.success });
      } catch (err) {
        console.error("Agent tool error:", err);
        setFeedback({
          message: err instanceof Error ? err.message : "Tool call failed",
          ok: false,
        });
      } finally {
        setRunningKey(null);
      }
    },
    []
  );

  const handleToolClick = useCallback(
    (agent: Agent, tool: AgentCapability) => {
      if (runningKey) return;
      // Mirror the LLM write-gate: writes need explicit confirmation.
      if (tool.write) setPendingWrite({ agent, tool });
      else runTool(agent, tool);
    },
    [runningKey, runTool]
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-between pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-opacity duration-300 ease-in-out",
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* Backdrop — tap to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className={cn(
          "absolute bottom-20 inset-x-0 flex flex-col max-h-[75vh] rounded-t-2xl",
          "border border-border bg-background shadow-lg",
          "transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <span className="text-sm font-semibold">Agents</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Refresh agents"
              onClick={fetchAgents}
              disabled={loading}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCwIcon
                className={cn("w-4 h-4", loading && "animate-spin")}
              />
            </button>
            <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* A pending write confirmation replaces the list so the dialog
            isn't buried under it (same pattern as CommandBar). */}
        {pendingWrite ? (
          <div className="px-4 pb-6">
            <WriteConfirmDialog
              title={
                pendingWrite.tool.description || prettyName(pendingWrite.tool.name)
              }
              args={{}}
              onConfirm={() => {
                const { agent, tool } = pendingWrite;
                setPendingWrite(null);
                runTool(agent, tool);
              }}
              onCancel={() => setPendingWrite(null)}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-20 flex flex-col gap-4">
            {loading && agents.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <LoaderCircleIcon className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            ) : agents.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No agents connected
              </p>
            ) : (
              agents.map((agent) => (
                <AgentCard
                  key={agent.device_id}
                  agent={agent}
                  runningKey={runningKey}
                  onToolClick={handleToolClick}
                  collapsedGroups={collapsedGroups}
                  onToggleGroup={toggleGroup}
                />
              ))
            )}

            {feedback && (
              <p
                className={cn(
                  "shrink-0 text-xs text-center pb-2",
                  feedback.ok ? "text-muted-foreground" : "text-destructive"
                )}
              >
                {feedback.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
