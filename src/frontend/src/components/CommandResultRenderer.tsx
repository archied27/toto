import type { CommandResult } from "@/plugins/types";
import { useCommandRegistry } from "@/hooks/useCommandRegistry";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { useState } from "react";
import "@fontsource-variable/geist";
import { MarkdownRenderer } from "./MarkdownRenderer";

export default function CommandResultRenderer({
  result,
  onResult,
}: {
  result: CommandResult;
  onResult?: (result: CommandResult) => void;
}) {
  const registry = useCommandRegistry();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const { intent, plugin, raw } = result.data;
    setLoading(true);
    try {
      const data = await apiFetch<CommandResult | null>("/command/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: intent, plugin: plugin, raw: raw }),
        });

        if (!data) return;

        onResult?.(data);
      }
      catch (err) {
        console.error("Command confirmation error:", err);
      }
      finally {
        setLoading(false);
      }
  }

  const handleCancel = () => {}

  if (!result.success) {
    return (
      <Card className="p-5 border-none shadow-none flex flex-col gap-2 opacity-80">
        <p className="text-lg font-bold text-destructive">{result.response}</p>
      </Card>
    );
  }

  console.log(result.action, registry[result.action]);
  const Renderer = registry[result.action];

  if (Renderer) {
    return <Renderer data={result.data} />;
  }

  if (result.action === "NEEDS_CONFIRMATION") {
    if (loading) {
      return <Card className="p-5 border-none shadow-none flex flex-col gap-2">
        <LoaderCircleIcon className="w-6 h-6 text-muted-foreground animate-spin mx-auto" />
      </Card>
    }

    else {
      return <Card className="p-5 border-none shadow-none flex flex-col gap-2">
        <p className="text-[1rem] font-bold text-muted-foreground text-center">{result.response}</p>
        <p className="font-medium text-muted-foreground text-center">{result.data.confidence ? `Confidence: ${(result.data.confidence * 100).toFixed(0)}%` : null}</p>
        <div className="flex flex-row gap-2 mt-2 justify-center">
          <Button className="bg-green-500/20 border-none" onClick={handleConfirm}>
            <CheckIcon className="w-4 h-4 text-muted-foreground font-bold" />
          </Button>

          <Button className="bg-destructive/20 text-destructive border-none" onClick={handleCancel}>
            <XIcon className="w-4 h-4 text-muted-foreground font-bold" />
          </Button>
        </div>
      </Card>;
    }
  }

  if (result.action === "LLM_RESPONSE") {
    console.log(result.response);
    return <Card className="font-serif p-5 border-none shadow-none flex flex-col gap-2">
      <MarkdownRenderer content={result.response} />
    </Card>
  }

  return (
    <Card className="p-5 border-none shadow-none flex flex-col gap-2">
      <p className="text-[1rem] font-bold text-muted-foreground">{result.response}</p>
    </Card>
  );
}