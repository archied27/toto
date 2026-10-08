import { Card } from "@/components/ui/card";
import { useDeleteTask, useToggleTaskCompletion, useStartWork, useTaskSessions, usePauseWork, useStopWork, type SweepDirection, type Task } from "../useTasks";
import { format, isToday, isTomorrow, isYesterday ,isThisWeek, parseISO, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { getTextColour } from "../utils";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, CircleIcon, EditIcon, TrashIcon, PlayIcon, TimerIcon, HistoryIcon, PauseIcon, SquareIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EditTask from "./EditTask";
import { useEffect, useState } from "react";

function formatDuration(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatTaskDate(isoString: string): string {
  const date = parseISO(isoString);
  const now = new Date();

  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";

  if (isThisWeek(date, { weekStartsOn: 1 })) {
    return format(date, "EEEE");
  }

  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

  if (date >= nextWeekStart && date <= nextWeekEnd) {
    return `Next ${format(date, "EEEE")}`;
  }

  return format(date, "do MMMM yyyy");
}

export default function TaskCard({ task, refresh, className, onSweepingChange }: {
    task: Task;
    refresh: () => void;
    className?: string;
    onSweepingChange?: (taskId: number, direction: SweepDirection | null) => void;
}) {

    const { toggleCompletion } = useToggleTaskCompletion();
    const { deleteTask } = useDeleteTask();
    const { startWork } = useStartWork();
    const { pauseWork } = usePauseWork();
    const { stopWork } = useStopWork();

    const [editOpen, setEditOpen] = useState(false);
    const [sweeping, setSweeping] = useState<SweepDirection | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const sessions = useTaskSessions(task.id, detailsOpen);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!task.is_working) return;
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [task.is_working]);

    // Calculate session seconds from the active portion or the paused session total.
    const sessionSeconds = task.is_working && task.work_session_start
        ? Math.max(0, Math.floor((now - new Date(task.work_session_start).getTime()) / 1000))
        : task.is_paused ? (task.session_elapsed ?? 0) : 0;

    const handleToggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const completing = !task.completed;
        task.completed = completing;
        // Let the parent keep this card mounted until the sweep finishes, so a
        // websocket state update moving the task between sections can't cut the
        // animation short.
        onSweepingChange?.(task.id, completing ? "complete" : "incomplete");
        await toggleCompletion(task.id);
        setSweeping(completing ? "complete" : "incomplete");
        setTimeout(() => {
            setSweeping(null);
            onSweepingChange?.(task.id, null);
            refresh();
        }, 650);
    };

    const handleStartWork = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        await startWork(task.id);
        refresh();
    };

    const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        await deleteTask(task.id);
        refresh();
    }

    const handlePauseWork = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        await pauseWork(task.id);
        refresh();
    };

    const handleStopWork = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        await stopWork(task.id);
        refresh();
    };

    return (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger asChild>
                <Card className={`relative overflow-hidden p-2 flex flex-row gap-2 border border-border/50 hover:border-border/80 transition-colors ${className || ""}`} onClick={(e) => e.stopPropagation()}>
                    {sweeping && (
                        <div
                            className={`absolute inset-0 pointer-events-none ${
                                sweeping === "complete"
                                    ? "bg-green-500/40 animate-task-complete-sweep"
                                    : "bg-red-500/40 animate-task-complete-sweep-reverse"
                            }`}
                        />
                    )}
                    <div className="flex flex-col items-center gap-1">
                        <Button onClick={handleToggle} size={"icon"} className="self-center bg-muted h-8 w-8 border-2 border-border">
                            {task.completed ? (
                                <CircleCheckIcon className="w-4 h-4 text-green-500" />
                            ) : (
                                <CircleIcon className="w-4 h-4 text-foreground" />
                            )}
                        </Button>
                        {!task.is_working && !task.is_paused && (
                            <Button onClick={handleStartWork} size={"icon"} className="self-center bg-muted h-8 w-8 border-2 border-border">
                                <PlayIcon className="w-4 h-4 text-blue-400" />
                            </Button>
                        )}
                    </div>

                    <div className="flex flex-col gap-1 flex-1">

                        <h1 className="font-semibold text-foreground">{task.title}</h1>

                        <div className="flex flex-row">
                            <span className="text-xs text-muted-foreground">{task.to_do_date && formatTaskDate(task.to_do_date)}</span>
                            {task.to_do_date && task.due_date && <span className="text-xs text-muted-foreground text-bold mx-1">|</span>}
                            <span className="text-xs text-muted-foreground">{task.due_date && "Due " + formatTaskDate(task.due_date)}</span>
                        </div>

                        <div className="flex flex-row flex-wrap gap-1">
                            {task.task_list && (
                                <span style={{ backgroundColor: task.task_list.colour, color: getTextColour(task.task_list.colour) }} className="px-2 py-0.5 rounded-full text-xs text-foreground">
                                        {task.task_list.name}
                                </span>
                            )}

                            {task.labels?.map(label => (
                                <span key={label.id} style={{ backgroundColor: label.colour, color: getTextColour(label.colour) }} className="px-2 py-0.5 rounded-full text-xs text-foreground">
                                    {label.name}
                                </span>
                            ))}
                        </div>

                    </div>
                </Card>
            </DialogTrigger>

            <DialogContent className="w-full overflow-hidden border border-border/50 gap-5">
                <DialogHeader className="pb-0">
                    <DialogTitle className="text-lg font-bold">
                        {task.title}
                    </DialogTitle>
                </DialogHeader>

                <DialogDescription className="pt-0">
                    <span className="flex flex-row justify-center gap-2">      
                        <span className="text-sm font-medium text-muted-foreground">{task.to_do_date && formatTaskDate(task.to_do_date)}</span>
                        {task.to_do_date && task.due_date && <span className="text-sm font-medium text-muted-foreground text-bold mx-1">|</span>}
                        <span className="text-sm font-medium text-muted-foreground">{task.due_date && "Due " + formatTaskDate(task.due_date)}</span>
                    </span>
                </DialogDescription>

                <p>{task.description}</p>

                <div className="flex flex-row flex-wrap gap-2">
                    {task.task_list && (
                        <span style={{ backgroundColor: task.task_list.colour, color: getTextColour(task.task_list.colour) }} className="px-2 py-0.5 rounded-full text-sm text-foreground">
                                {task.task_list.name}
                        </span>
                    )}

                    {task.labels?.map(label => (
                        <span key={label.id} style={{ backgroundColor: label.colour, color: getTextColour(label.colour) }} className="px-2 py-0.5 rounded-full text-sm text-foreground">
                            {label.name}
                        </span>
                    ))}
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-6 relative flex flex-col items-center">
                    <div className="relative mb-6">
                        <div className="flex items-center justify-center">
                            <div className="relative w-40 h-40">
                                <div className="absolute inset-0">
                                    <div className="w-full h-full rounded-full border-4 border-border/30 flex items-center justify-center bg-background/20">
                                        <p className="text-4xl font-mono text-foreground">
                                            {task.is_working ? `${formatDuration(sessionSeconds)}` : `${formatDuration(task.time_spent ?? 0)}`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -top-4 -right-12">
                            <div className="flex flex-col gap-2 items-end">
                                {!task.is_working && !task.is_paused && (
                                    <Button variant="default" size="sm" onClick={handleStartWork}>
                                        <PlayIcon className="mr-1 h-3 w-3" />
                                        Start
                                    </Button>
                                )}
                                {task.is_working && (
                                    <Button variant="default" size="sm" onClick={handlePauseWork}>
                                        <PauseIcon className="mr-1 h-3 w-3" />
                                        Pause
                                    </Button>
                                )}
                                {task.is_paused && (
                                    <Button variant="default" size="sm" onClick={handleStartWork}>
                                        <PlayIcon className="mr-1 h-3 w-3" />
                                        Resume
                                    </Button>
                                )}
                                {(task.is_working || task.is_paused) && (
                                    <Button variant="destructive" size="sm" onClick={handleStopWork}>
                                        <SquareIcon className="mr-1 h-3 w-3" />
                                        Stop
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="w-full space-y-3">
                        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                            <TimerIcon className={`h-4 w-4 ${(task.is_working || task.is_paused) ? "animate-pulse text-blue-400" : "text-muted-foreground"}`} />
                            <div className="flex flex-col">
                                <p className="text-xs font-medium text-foreground">Focus completed</p>
                                <p className="text-xs text-muted-foreground">{formatDuration(task.time_spent ?? 0)} of focused work already done</p>
                            </div>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <HistoryIcon className="h-4 w-4 text-muted-foreground" />
                                <p className="text-xs font-medium text-foreground">Focus sessions</p>
                            </div>
                            {sessions.length === 0 ? (
                                <p className="mt-2 text-xs text-muted-foreground">No completed focus sessions yet.</p>
                            ) : (
                                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                                    {sessions.map((session) => (
                                        <div key={session.id} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-muted-foreground">
                                                {format(parseISO(session.started_at), "d MMM, HH:mm")}
                                            </span>
                                            <span className="font-medium tabular-nums text-foreground">
                                                {formatDuration(session.duration_seconds)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-row gap-2 mt-2 justify-center overflow-x-auto flex-wrap scrollbar-none">
                    <Button className="bg-muted text-foreground border-xl" onClick={handleToggle}>
                        {!task.completed ? (
                            <>
                                <CircleIcon className="w-4 h-4 text-foreground" />
                                <p className="text-foreground">Incomplete</p>
                            </>
                        ) : (
                            <>
                                <CircleCheckIcon className="w-4 h-4 text-green-500" />
                                <p className="text-green-500">Complete</p>
                            </>
                        )}
                    </Button>

                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-muted text-foreground border-xl">
                                <EditIcon className="w-4 h-4 text-primary" />
                                <p className="text-primary">Edit</p>
                            </Button>
                        </DialogTrigger>

                        <DialogContent showCloseButton={false}>
                            <EditTask task={task} onClose={() => {
                                setEditOpen(false);
                                refresh();
                            }} />
                        </DialogContent>
                    </Dialog>

                    <Button className="bg-muted text-foreground border-xl" onClick={handleDelete}>
                        <TrashIcon className="w-4 h-4 text-destructive" />
                        <p className="text-destructive">Delete</p>
                    </Button>
                </div>
                

            </DialogContent>
        </Dialog>
    );
}