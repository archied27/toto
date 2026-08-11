import { CheckIcon, LoaderCircleIcon, WrenchIcon } from "lucide-react";
import type { ComponentType } from "react";
import { Card } from "./ui/card";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { plugins } from "@/plugins";

// Each plugin owns the icon shown for its tool calls (e.g. tasks -> list
// check, web -> globe). Unknown plugin ids fall back to a wrench.
const PLUGIN_ICONS: Record<string, ComponentType<{ className?: string }>> =
  Object.fromEntries(plugins.map((p) => [p.id, p.icon]));

// Keep the tool-call list bounded — only the most recent few show, since the
// older lines scroll out of sight rather than clutter the answer.
const MAX_TOOLS = 3;

// The live view while the LLM streams its answer. Shows a muted line per tool
// call at the top ("Searching the web…", "Checking today's tasks…"), one for
// every tool the model ran in this turn, then the markdown answer beneath it,
// re-rendered on every chunk until the stream's terminal `result` event lands.
// Each line stays visible once its tool finishes (spinner swaps to a check) so
// every call persists in the final view.
export default function StreamingLLMResponse({
  tools,
  content,
}: {
  tools: { plugin: string; status: string; active: boolean }[];
  content: string;
}) {
  const visible = tools.slice(-MAX_TOOLS);
  return (
    <Card className="font-serif p-5 border-none shadow-none flex flex-col gap-2">
      {visible.map((tool, i) => {
        const Icon = PLUGIN_ICONS[tool.plugin] ?? WrenchIcon;
        return (
          <div key={i} className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs font-medium text-muted-foreground flex-1">
              {tool.status}
            </p>
            {tool.active ? (
              <LoaderCircleIcon className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <CheckIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
          </div>
        );
      })}
      {content && <MarkdownRenderer content={content} />}
    </Card>
  );
}
