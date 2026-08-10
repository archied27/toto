import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { Card } from "./ui/card";
import { MarkdownRenderer } from "./MarkdownRenderer";

// The live view while the LLM streams its answer. Shows a muted status line at
// the top while a tool is executing ("Checking current weather…"), then the
// markdown answer beneath it, re-rendered on every chunk until the stream's
// terminal `result` event lands. The status line stays visible once the tool
// finishes (spinner swaps to a check) so it persists in the final view.
// Mirrors the LLM_RESPONSE card in CommandResultRenderer, so switching from
// live to final has no visual jump.
export default function StreamingLLMResponse({
  statusText,
  statusActive,
  content,
}: {
  statusText: string;
  statusActive: boolean;
  content: string;
}) {
  return (
    <Card className="font-serif p-5 border-none shadow-none flex flex-col gap-2">
      {statusText && (
        <div className="flex items-center gap-2">
          {statusActive ? (
            <LoaderCircleIcon className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <CheckIcon className="w-4 h-4 text-muted-foreground" />
          )}
          <p className="text-xs font-medium text-muted-foreground">{statusText}</p>
        </div>
      )}
      {content && <MarkdownRenderer content={content} />}
    </Card>
  );
}
