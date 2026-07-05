import { useState } from "react";
import { Input } from "./ui/input";
import { useNavigation } from "@/hooks/NavigationContext";
import CommandResultRenderer from "./CommandResultRenderer";
import type { CommandResult } from "@/plugins/types";
import { apiFetch } from "@/hooks/api";

export default function CommandBar({
  onClose, longComponent
}: {
  onClose: () => void;
  longComponent?: React.ReactNode;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { navigate } = useNavigation();

  const handleSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !searchTerm.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch<CommandResult | null>("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: searchTerm }),
      });

      if (!data) return;

      if (data.action === "navigate" && data.data?.navigate_to) {
        navigate(data.data.navigate_to);
        onClose();
        return;
      }

      setResult(data);
    } catch (err) {
      console.error("Command error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {result ? <CommandResultRenderer result={result} /> : 
        (<div className="flex flex-col h-full">
            <div className="h-[10%] opacity-80">
              {longComponent}
            </div>
          </div>)}
      </div>
      <div className="pb-12 px-4 flex flex-col items-center gap-4">
        <Input
          className="text-foreground"
          placeholder="Type a command..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSubmit}
          disabled={loading}
        />
      </div>
    </div>
  );
}