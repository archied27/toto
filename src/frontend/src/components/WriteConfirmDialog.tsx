import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

/**
 * Simple confirmation dialog shown when the LLM wants to execute a write
 * action (e.g. adding a task).  Displays a title and the parsed arguments,
 * with Confirm / Cancel buttons.  The dialog is intentionally light so it
 * can overlay the still-streaming answer behind it.
 */
export default function WriteConfirmDialog({
  title,
  args,
  onConfirm,
  onCancel,
}: {
  title: string;
  args: Record<string, unknown>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Build a simple list of non-null argument entries, prettified for display.
  const entries = Object.entries(args).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <Card className="gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
      <div className="flex items-start gap-3">
        <TriangleAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Confirm action</p>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
          {entries.map(([key, value]) => (
            <li key={key} className="flex gap-3">
              <span className="shrink-0 font-semibold text-muted-foreground">
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                :
              </span>{" "}
              <span className="min-w-0 break-words text-foreground">{String(value)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <XIcon />
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm}>
          <CheckIcon />
          Run action
        </Button>
      </div>
    </Card>
  );
}
