import { useState } from "react";
import { Textarea } from "./ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useNavigation } from "@/hooks/NavigationContext";
import CommandResultRenderer from "./CommandResultRenderer";
import StreamingLLMResponse from "./StreamingLLMResponse";
import WriteConfirmDialog from "./WriteConfirmDialog";
import type { CommandResult } from "@/plugins/types";
import {
  BrainIcon,
  ZapIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// The event vocabulary emitted by POST /command/stream.
type StreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; tool: string; plugin: string; status: string }
  | { type: "tool_end"; tool: string; result: string }
  | {
      type: "confirm_write";
      token: string;
      tool: string;
      title: string;
      args: Record<string, unknown>;
    }
  | { type: "result"; result: CommandResult };

// Read an SSE response body, yielding one parsed event per `data:` block.
// The backend frames each event as `data: {json}\n\n`, so we split the buffer
// on blank lines and extract the `data:` payload.
async function* readStreamEvents(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLine = block
          .split("\n")
          .find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        try {
          yield JSON.parse(dataLine.slice(5).trim()) as StreamEvent;
        } catch {
          // skip a malformed event rather than killing the stream
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default function CommandBar({
  onClose,
  longComponent,
}: {
  onClose: () => void;
  longComponent?: React.ReactNode;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [streaming, setStreaming] = useState<{
    tools: { plugin: string; status: string; active: boolean }[];
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingWrite, setPendingWrite] = useState<{
    token: string;
    title: string;
    args: Record<string, unknown>;
  } | null>(null);
  const [mode, setMode] = useState<"normal" | "llm">("normal");
  const { navigate } = useNavigation();

  // POST to /command/confirm-write with the user's decision, then clear
  // the dialog.  The backend resumes the paused LLM stream accordingly.
  const resolveWrite = async (confirmed: boolean) => {
    if (!pendingWrite) return;
    const { token } = pendingWrite;
    setPendingWrite(null);
    await fetch("/command/confirm-write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, confirmed }),
    }).catch((err) => console.error("Write confirmation error:", err));
  };

  const handleSubmit = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || !searchTerm.trim()) return;
    // The textarea would otherwise insert a newline on Enter — submit instead.
    e.preventDefault();

    setLoading(true);
    setResult(null);
    setStreaming(null);

    // Tracked locally so each event re-sets the full streaming state.
    let content = "";
    let tools: { plugin: string; status: string; active: boolean }[] = [];

    try {
      const res = await fetch("/command/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: searchTerm, mode }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Command stream failed (${res.status})`);
      }

      for await (const event of readStreamEvents(res.body)) {
        if (event.type === "text") {
          content += event.content;
          setStreaming({ tools, content });
        } else if (event.type === "tool_start") {
          // Each tool call gets its own line — a new entry, running.
          tools = [
            ...tools,
            { plugin: event.plugin, status: event.status, active: true },
          ];
          setStreaming({ tools, content });
        } else if (event.type === "tool_end") {
          // Keep the line visible once its tool finishes — only stop the
          // spinner so it no longer looks like it's still running.
          tools = tools.map((t, i) =>
            i === tools.length - 1 ? { ...t, active: false } : t
          );
          setStreaming({ tools, content });
        } else if (event.type === "confirm_write") {
          // LLM wants to execute a write — pause and ask the user.
          setPendingWrite({
            token: event.token,
            title: event.title,
            args: event.args,
          });
        } else if (event.type === "result") {
          const r = event.result;
          if (r.action === "navigate" && r.data?.navigate_to) {
            navigate(r.data.navigate_to, r.data?.params);
            onClose();
            return;
          }
          if (r.success && r.action === "LLM_RESPONSE") {
            // The streaming view already shows the full answer — keep it.
            setStreaming({ tools, content });
          } else {
            // Data card or error — render through the normal renderer.
            setStreaming(null);
            setResult(r);
          }
        }
      }
    } catch (err) {
      console.error("Command error:", err);
    } finally {
      setLoading(false);
      setMode("normal");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {/* A pending write confirmation sits at the top, replacing the
            long widget below so the dialog isn't buried under content. */}
        {pendingWrite && (
          <WriteConfirmDialog
            title={pendingWrite.title}
            args={pendingWrite.args}
            onConfirm={() => resolveWrite(true)}
            onCancel={() => resolveWrite(false)}
          />
        )}
        {result ? (
          <CommandResultRenderer result={result} onResult={setResult} />
        ) : streaming ? (
          <StreamingLLMResponse
            tools={streaming.tools}
            content={streaming.content}
          />
        ) : !pendingWrite ? (
          <div className="flex flex-col h-full">
            <div className="h-[10%] opacity-80">{longComponent}</div>
          </div>
        ) : null}
      </div>
      <div className="pb-16 pt-10 px-4 flex items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Command mode"
              disabled={loading}
              className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === "normal" ? (
                <ZapIcon className="w-5 h-5" />
              ) : (
                <BrainIcon className="w-5 h-5" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="flex flex-col p-2 min-w-[100px]">
            <DropdownMenuItem
              onClick={() => setMode("normal")}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                mode === "normal" && "bg-accent text-accent-foreground"
              )}
            >
              <ZapIcon className="w-4 h-4" />
              Normal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setMode("llm")}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                mode === "llm" && "bg-accent text-accent-foreground"
              )}
            >
              <BrainIcon className="w-4 h-4" />
              LLM
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="relative w-full">
          <Textarea
            className="text-foreground pr-10 leading-5 min-h-9 max-h-[calc(3_*_1.25rem_+_1rem_+_2px)] resize-none overflow-y-auto"
            placeholder="Type a command..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSubmit}
            disabled={loading}
          />
          {loading && pendingWrite ? (
            // A write is awaiting confirmation — a warning instead of the
            // spinner signals the user needs to act.
            <TriangleAlertIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-500 animate-pulse" />
          ) : loading ? (
            <LoaderCircleIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground animate-spin" />
          ) : (
            searchTerm && (
              <button
                type="button"
                aria-label="Clear input"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
