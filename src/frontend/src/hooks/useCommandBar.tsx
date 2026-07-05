import { useState } from "react";

export interface CommandResult {
  success: boolean;
  action: string;
  response: string;
  data: Record<string, any>;
}

export function useCommandBar() {
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = async (input: string) => {
    setLoading(true);
    try {
      const res = await fetch("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      setResult(data ?? null);
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, execute, clear: () => setResult(null) };
}