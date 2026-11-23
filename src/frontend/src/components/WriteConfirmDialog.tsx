import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

/**
 * Confirmation dialog shown when the LLM wants to execute a write action.
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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="gap-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="h-5 w-5 shrink-0 text-amber-500" />
            Confirm action
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
