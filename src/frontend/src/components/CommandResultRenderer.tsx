import type { CommandResult } from "@/plugins/types";
import { useCommandRegistry } from "@/hooks/useCommandRegistry";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import "@fontsource-variable/geist";

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
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold tracking-tight mt-5 mb-2">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="text-xl font-semibold tracking-tight mt-5 mb-2">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="text-lg font-semibold mt-4 mb-1.5">
              {children}
            </h3>
          ),

          h4: ({ children }) => (
            <h4 className="text-base font-semibold mt-3 mb-1">
              {children}
            </h4>
          ),

          p: ({ children }) => (
            <p className="leading-6 mb-2.5 text-foreground">
              {children}
            </p>
          ),

          strong: ({ children }) => (
            <strong className="font-semibold">
              {children}
            </strong>
          ),

          em: ({ children }) => (
            <em className="italic">
              {children}
            </em>
          ),

          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 mb-3">
              {children}
            </ul>
          ),

          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-3">
              {children}
            </ol>
          ),

          li: ({ children }) => (
            <li className="leading-6">
              {children}
            </li>
          ),

          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground my-3">
              {children}
            </blockquote>
          ),

          hr: () => (
            <hr className="my-4 border-border" />
          ),

          a: ({ children, href }) => (
            <a
              href={href}
              className="text-primary underline underline-offset-2 hover:opacity-80"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),

          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");

            if (isBlock) {
              return (
                <code className={className}>
                  {children}
                </code>
              );
            }

            return (
              <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">
                {children}
              </code>
            );
          },

          pre: ({ children }) => (
            <pre className="bg-muted/50 border border-border rounded-lg p-3 overflow-x-auto my-3 text-sm font-mono leading-5">
              {children}
            </pre>
          ),

          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),

          thead: ({ children }) => (
            <thead className="border-b border-border">
              {children}
            </thead>
          ),

          th: ({ children }) => (
            <th className="text-left font-medium px-2 py-1.5">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="border-b border-border px-2 py-1.5">
              {children}
            </td>
          ),

          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              className="rounded-lg max-w-full my-3"
            />
          ),
        }}
      >
        {result.response}
      </ReactMarkdown>
    </Card>
  }

  return (
    <Card className="p-5 border-none shadow-none flex flex-col gap-2">
      <p className="text-[1rem] font-bold text-muted-foreground">{result.response}</p>
    </Card>
  );
}