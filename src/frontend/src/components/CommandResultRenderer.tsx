import type { CommandResult } from "@/plugins/types";
import { useCommandRegistry } from "@/hooks/useCommandRegistry";
import { Card } from "./ui/card";

export default function CommandResultRenderer({
  result,
}: {
  result: CommandResult;
}) {
  const registry = useCommandRegistry();

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

  return (
    <Card className="p-5 border-none shadow-none flex flex-col gap-2">
      <p className="text-[1rem] font-bold text-muted-foreground">{result.response}</p>
    </Card>
  );
}