import AddTaskButton from "./AddTaskButton"

interface HeroProps {
  selected: "Today" | "Tomorrow" | "Upcoming" | "All" | "Stats"
  total: number | null // total number of tasks
  completed: number | null  // completed number of tasks
  handleAddTask?: () => void
}

export default function Hero({ selected, total, completed, handleAddTask }: HeroProps) {
  const selectedLabels = {
    "Today": "Today",
    "Tomorrow": "Tomorrow",
    "Upcoming": "Upcoming Tasks",
    "All": "All Tasks",
    "Stats": "Task Statistics"
  }

  const progressString = (completed !== null && total !== null) 
                          ? (completed === total)
                            ? "Completed"
                            : `${completed} / ${total}`
                          : "";

  return (
    <div className="top-0 z-30 border-b border-border bg-background/80 px-5 pb-3 backdrop-blur-md">
      <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 
            key={selected}
            className="animate-fade-slide-in text-2xl font-semibold tracking-tight text-balance"
          >
            {selectedLabels[selected]}
          </h1>
            {total !== null && completed !== null && (
              <div className="flex items-center gap-5">
                <span 
                  key={`${completed}-${total}`}
                  className="text-[13px] font-medium text-muted-foreground tabular-nums ease-in-out"
                >
                  {progressString}
                </span>
                <AddTaskButton onClick={handleAddTask} />
              </div>
            )}
          </div>
    </div>
  )
}