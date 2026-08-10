import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { CheckIcon, XIcon } from "lucide-react";

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
    <Card className="p-5 border-none shadow-none flex flex-col gap-3">
      <p className="text-[1rem] font-bold text-muted-foreground text-center">
        {title}
      </p>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {entries.map(([key, value]) => (
            <li key={key}>
              <span className="font-semibold">
                {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                :
              </span>{" "}
              {String(value)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-row gap-2 mt-1 justify-center">
        <Button className="bg-green-500/20 border-none" onClick={onConfirm}>
          <CheckIcon className="w-4 h-4 text-muted-foreground font-bold" />
        </Button>
        <Button
          className="bg-destructive/20 text-destructive border-none"
          onClick={onCancel}
        >
          <XIcon className="w-4 h-4 text-muted-foreground font-bold" />
        </Button>
      </div>
    </Card>
  );
}
