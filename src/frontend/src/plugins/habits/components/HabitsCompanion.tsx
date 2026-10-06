import { Card } from "@/components/ui/card";
import { useHabits } from "../useHabits";
import { CheckCircle2, Circle, Flame } from "lucide-react";

export function HabitsCompanion() {
  const { habits, loading } = useHabits();

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-full p-6 bg-card/50">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (!habits || habits.length === 0) {
    return (
      <Card className="flex items-center justify-center h-full p-6 bg-card/50">
        <p className="text-xl text-muted-foreground">No habits tracked</p>
      </Card>
    );
  }

  // Get today's date
  const today = new Date().toISOString().split("T")[0];

  // Find habits with the longest streaks that haven't been completed today
  const habitsByStreak = [...habits]
    .filter((habit) => {
      const todayCompletion = habit.completions?.find(
        (c) => c.date === today
      );
      return !todayCompletion;
    })
    .sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0));

  const topHabit = habitsByStreak[0] || habits[0];

  return (
    <Card className="flex flex-col justify-between h-full p-6 bg-card/50">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-medium text-muted-foreground">
            Current Streak
          </span>
        </div>

        <h3 className="text-2xl font-bold text-primary mb-2">
          {topHabit.name}
        </h3>

        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold text-primary">
            {topHabit.current_streak || 0}
          </span>
          <span className="text-xl text-muted-foreground">days</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Today</span>
          {topHabit.completions?.find((c) => c.date === today) ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : (
            <Circle className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        {habits.length > 1 && (
          <p className="text-sm text-muted-foreground mt-4">
            +{habits.length - 1} more habit{habits.length > 2 ? "s" : ""}
          </p>
        )}
      </div>
    </Card>
  );
}
