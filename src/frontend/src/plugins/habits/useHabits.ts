import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";
import { useState } from "react";

interface Habit {
  id: number;
  name: string;
  colour?: string | null;
  icon?: string | null;
  description?: string | null;
  current_streak?: number;
  completions?: Array<{ date: string }>;
}

export function useHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  useWebSocketEvent("habits.state", (data: { habits?: Habit[] }) => {
    setHabits(data.habits || []);
    setLoading(false);
  });

  return { habits, loading };
}
