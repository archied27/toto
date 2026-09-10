import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { apiFetch } from "@/hooks/api";
import WriteConfirmDialog from "./WriteConfirmDialog";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
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
  action_type?: "read" | "open" | "write";
  requires_confirmation?: boolean;
  /** Legacy flag retained for agents that have not migrated yet. */
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

type ParameterSchema = {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  ui?: "select" | "slider";
  options?: unknown[];
  options_source?: string | {
    action: string;
    value_key?: string;
    label_key?: string;
  };
  minimum?: number;
  maximum?: number;
  step?: number;
};

type ToolParameters = {
  type?: string;
  properties?: Record<string, ParameterSchema>;
  required?: string[];
};

type ToolPayload = Record<string, unknown>;

type ParameterOption = { value: string; label: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Prettify a snake_case tool name for display. */
function prettyName(name: string) {
  return name.replace(/_/g, " ");
}

function toolNeedsConfirmation(tool: AgentCapability) {
  return tool.requires_confirmation === true || tool.write === true;
}

function toolActionLabel(tool: AgentCapability) {
  if (tool.action_type === "open") return "open";
  if (tool.action_type === "write" || tool.write) return "write";
  return "read";
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

function parameterSchema(tool: AgentCapability): ToolParameters {
  const parameters = tool.parameters as ToolParameters;
  return parameters && typeof parameters === "object" ? parameters : {};
}

function initialParameterValues(tool: AgentCapability): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const [name, schema] of Object.entries(parameterSchema(tool).properties ?? {})) {
    if (schema.default !== undefined) {
      values[name] = typeof schema.default === "boolean" ? schema.default : String(schema.default);
    } else if (schema.type === "boolean") {
      values[name] = false;
    } else if (schema.ui === "slider") {
      values[name] = String(schema.minimum ?? 0);
    } else {
      values[name] = "";
    }
  }
  return values;
}

function parseParameterValue(value: string | boolean, schema: ParameterSchema): unknown {
  if (schema.type === "boolean") return value === true || value === "true";
  if (value === "") return undefined;
  if (schema.type === "number" || schema.type === "integer" || schema.ui === "slider") {
    return schema.type === "integer" ? Number.parseInt(String(value), 10) : Number(value);
  }
  if (schema.type === "array" || schema.type === "object") {
    try {
      return JSON.parse(String(value));
    } catch {
      return value;
    }
  }
  return value;
}

function toParameterOptions(options: unknown[], schema: ParameterSchema): ParameterOption[] {
  const source = schema.options_source;
  const valueKey = typeof source === "object" ? source.value_key : undefined;
  const labelKey = typeof source === "object" ? source.label_key : undefined;
  return options.flatMap((option) => {
    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const value = valueKey ? record[valueKey] : record.value;
      const label = labelKey ? record[labelKey] : record.label ?? value;
      if (value !== undefined && label !== undefined) {
        return [{ value: String(value), label: String(label) }];
      }
    }
    return [{ value: String(option), label: String(option) }];
  });
}

function extractOptions(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    for (const key of ["options", "items", "applications"]) {
      if (Array.isArray(record[key])) return record[key];
    }
  }
  return [];
}

function ToolParameterForm({
  agent,
  tool,
  onSubmit,
  onCancel,
}: {
  agent: Agent;
  tool: AgentCapability;
  onSubmit: (payload: ToolPayload) => void;
  onCancel: () => void;
}) {
  const schema = parameterSchema(tool);
  const properties = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);
  const [values, setValues] = useState(() => initialParameterValues(tool));
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, ParameterOption[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadOptions = async (name: string, property: ParameterSchema) => {
      if (!property.options_source) return;
      const source = property.options_source;
      const action = typeof source === "string" ? source : source.action;
      setLoadingOptions((current) => ({ ...current, [name]: true }));
      try {
        const response = await apiFetch<ExecResponse>(
          `/agents/${encodeURIComponent(agent.device_id)}/${encodeURIComponent(action)}`,
          { method: "POST", body: JSON.stringify({ payload: {} }) }
        );
        if (!cancelled) {
          setDynamicOptions((current) => ({
            ...current,
            [name]: toParameterOptions(extractOptions(response.result), property),
          }));
        }
      } catch (loadError) {
        console.error(`Failed to load options for ${name}:`, loadError);
      } finally {
        if (!cancelled) setLoadingOptions((current) => ({ ...current, [name]: false }));
      }
    };

    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      void loadOptions(name, property);
    }
    return () => { cancelled = true; };
  }, [agent.device_id, tool]);

  const submit = () => {
    const payload: ToolPayload = {};
    for (const [name, property] of properties) {
      const rawValue = values[name] ?? "";
      if (required.has(name) && rawValue === "") {
        setError(`${property.title || name} is required`);
        return;
      }
      const parsed = parseParameterValue(rawValue, property);
      if (parsed !== undefined) payload[name] = parsed;
    }
    setError(null);
    onSubmit(payload);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <div>
        <p className="text-sm font-semibold">{prettyName(tool.name)}</p>
        {tool.description && <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>}
      </div>

      {properties.length === 0 ? (
        <p className="text-sm text-muted-foreground">This tool has no parameters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {properties.map(([name, property]) => {
            const label = property.title || name.replace(/_/g, " ");
            const value = values[name] ?? "";
            const options = property.options_source
              ? dynamicOptions[name] ?? []
              : toParameterOptions(property.options ?? property.enum ?? [], property);
            const isSelect = property.ui === "select" || property.options_source || property.options || property.enum;
            const isSlider = property.ui === "slider";
            return (
              <label key={name} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium capitalize">
                  {label}{required.has(name) && <span className="ml-1 text-destructive">*</span>}
                </span>
                {isSelect ? (
                  <select
                    value={String(value)}
                    onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    disabled={loadingOptions[name]}
                  >
                    <option value="">{loadingOptions[name] ? "Loading..." : "Select..."}</option>
                    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : isSlider ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={property.minimum ?? 0}
                      max={property.maximum ?? 100}
                      step={property.step ?? 1}
                      value={String(value || property.minimum || 0)}
                      onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                      className="min-w-0 flex-1 accent-primary"
                    />
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{String(value || property.minimum || 0)}</span>
                  </div>
                ) : property.type === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                ) : (
                  <Input
                    type={property.type === "number" || property.type === "integer" ? "number" : "text"}
                    value={String(value)}
                    placeholder={property.type === "array" || property.type === "object" ? "JSON value" : undefined}
                    onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                  />
                )}
                {property.description && <span className="text-xs text-muted-foreground">{property.description}</span>}
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
        <button type="button" onClick={submit} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Continue</button>
      </div>
    </div>
  );
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
          <span className={cn(
            "ml-2 text-[0.65rem] font-semibold uppercase tracking-wide align-middle",
            toolActionLabel(tool) === "write" ? "text-amber-500" : "text-muted-foreground"
          )}>
              {toolActionLabel(tool)}
          </span>
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
        const collapsed = collapsedGroups[key] ?? true;
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
  const [parameterTool, setParameterTool] = useState<{
    agent: Agent;
    tool: AgentCapability;
  } | null>(null);
  const [pendingWrite, setPendingWrite] = useState<{
    agent: Agent;
    tool: AgentCapability;
    payload: ToolPayload;
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
    setCollapsedGroups((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  }, []);

  const groupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const agent of agents) {
      for (const capability of agent.capabilities) {
        if (capability.group) {
          keys.add(`${agent.device_id}:${capability.group}`);
        }
      }
    }
    return [...keys];
  }, [agents]);

  const allGroupsOpen =
    groupKeys.length > 0 &&
    groupKeys.every((key) => collapsedGroups[key] === false);

  const toggleAllGroups = useCallback(() => {
    const nextCollapsed = allGroupsOpen;
    setCollapsedGroups((previous) => {
      const next = { ...previous };
      for (const key of groupKeys) {
        next[key] = nextCollapsed;
      }
      return next;
    });
  }, [allGroupsOpen, groupKeys]);

  const runTool = useCallback(
    async (agent: Agent, tool: AgentCapability, payload: ToolPayload = {}) => {
      const key = `${agent.device_id}/${tool.name}`;
      setRunningKey(key);
      setFeedback(null);
      try {
        const res = await apiFetch<ExecResponse>(
          `/agents/${agent.device_id}/${tool.name}`,
          { method: "POST", body: JSON.stringify({ payload }) }
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
      const properties = parameterSchema(tool).properties ?? {};
      if (Object.keys(properties).length > 0) {
        setParameterTool({ agent, tool });
      } else if (toolNeedsConfirmation(tool)) {
        setPendingWrite({ agent, tool, payload: {} });
      } else {
        runTool(agent, tool);
      }
    },
    [runningKey, runTool]
  );

  const handleParameters = useCallback(
    (payload: ToolPayload) => {
      if (!parameterTool) return;
      const { agent, tool } = parameterTool;
      setParameterTool(null);
      if (toolNeedsConfirmation(tool)) setPendingWrite({ agent, tool, payload });
      else runTool(agent, tool, payload);
    },
    [parameterTool, runTool]
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
              aria-label={allGroupsOpen ? "Collapse all folders" : "Expand all folders"}
              onClick={toggleAllGroups}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {allGroupsOpen ? (
                <ChevronsUpIcon className="w-4 h-4" />
              ) : (
                <ChevronsDownIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* A pending write confirmation replaces the list so the dialog
            isn't buried under it (same pattern as CommandBar). */}
        {parameterTool ? (
          <ToolParameterForm
            agent={parameterTool.agent}
            tool={parameterTool.tool}
            onSubmit={handleParameters}
            onCancel={() => setParameterTool(null)}
          />
        ) : pendingWrite ? (
          <div className="px-4 pb-6">
            <WriteConfirmDialog
              title={
                pendingWrite.tool.description || prettyName(pendingWrite.tool.name)
              }
              args={pendingWrite.payload}
              onConfirm={() => {
                const { agent, tool, payload } = pendingWrite;
                setPendingWrite(null);
                runTool(agent, tool, payload);
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
