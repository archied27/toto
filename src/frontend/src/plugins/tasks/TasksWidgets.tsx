import { useTaskState, useStopWork, type Task } from "./useTasks";
import TaskCard from "./components/TaskCard";
import { useNavigation } from "@/hooks/NavigationContext";
import { WidgetContainer } from "@/components/WidgetContainer";
import { Button } from "@/components/ui/button";
import { CircleAlertIcon, ClockIcon, PauseIcon, TimerIcon } from "lucide-react";
import { useEffect, useState } from "react";

const maxTasksToShow = 2;

function formatTimer(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function useLiveWorkSeconds(task: Task | null): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!task?.is_working) return;
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [task?.is_working]);

    if (!task) return 0;
    const sessionSeconds = task.is_working && task.work_session_start
        ? Math.max(0, Math.floor((now - new Date(task.work_session_start).getTime()) / 1000))
        : 0;
    return (task.time_spent ?? 0) + sessionSeconds;
}

export function TasksHero() {
    const { taskState } = useTaskState();
    const { navigate } = useNavigation();
    const { stopWork } = useStopWork();

    const overdueTasks = taskState ? taskState.overdue_tasks.filter((t) => !t.completed) : [];
    const dueTodayTasks = taskState ? taskState.tasks_due_today.filter((t) => !t.completed) : [];
    const todayTasks = taskState ? taskState.today_tasks.filter((t) => !t.completed) : [];
    const availableTasks = [...overdueTasks, ...dueTodayTasks, ...todayTasks]
        .filter((task, index, tasks) => tasks.findIndex(candidate => candidate.id === task.id) === index);
    const activeTask = availableTasks.find(task => task.is_working) ?? null;
    const elapsedSeconds = useLiveWorkSeconds(activeTask);
    const goalSeconds = activeTask?.pomodoro_goal || 1500;
    const progress = Math.min(100, (elapsedSeconds / goalSeconds) * 100);
    const ringRadius = 42;

    const handleStop = async (task: Task) => {
        await stopWork(task.id);
    };

    const showOverdueTasks = overdueTasks.length > 0;
    const showTasksDueToday = dueTodayTasks.length > 0;
    const showTodayTasks = todayTasks.length > 0;

    const globalMax = overdueTasks.length > 0 ? 2 : maxTasksToShow;

    let remainingBudget = globalMax;

    const overdueCount = Math.min(overdueTasks.length, remainingBudget);
    remainingBudget -= overdueCount;

    const dueTodayCount = Math.min(dueTodayTasks.length, remainingBudget);
    remainingBudget -= dueTodayCount;

    const todayCount = Math.min(todayTasks.length, remainingBudget);

    const overdueHidden = overdueTasks.length - overdueCount;
    const dueTodayHidden = dueTodayTasks.length - dueTodayCount;
    const todayHidden = todayTasks.length - todayCount;

    return (
        <WidgetContainer onClick={() => navigate("tasks")}>
            {activeTask ? (
                <div className="flex h-full min-h-40 flex-col justify-between gap-4 py-1">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
                                <TimerIcon className="h-3.5 w-3.5 animate-pulse" />
                                Working now
                            </div>
                            <p className="mt-1 break-words text-base font-semibold leading-snug text-foreground">{activeTask.title}</p>
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 shrink-0"
                            aria-label="Pause work timer"
                            onClick={(event) => {
                                event.stopPropagation();
                                void handleStop(activeTask);
                            }}
                        >
                            <PauseIcon className="h-4 w-4 text-yellow-400" />
                        </Button>
                    </div>
                    <div className="flex min-h-0 items-center gap-5">
                    <div className="relative flex size-36 shrink-0 items-center justify-center">
                        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                            <circle cx="50" cy="50" r={ringRadius} fill="none" className="stroke-muted" strokeWidth="5" />
                            <circle
                                cx="50"
                                cy="50"
                                r={ringRadius}
                                fill="none"
                                className={progress >= 100 ? "stroke-emerald-500" : "stroke-blue-400"}
                                strokeWidth="5"
                                strokeLinecap="round"
                                pathLength="100"
                                style={{ strokeDasharray: "100", strokeDashoffset: `${100 - progress}` }}
                            />
                        </svg>
                        <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatTimer(elapsedSeconds)}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                        <span className="text-sm tabular-nums text-muted-foreground">Goal {formatTimer(goalSeconds)}</span>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className={`h-full rounded-full transition-[width] duration-1000 ${progress >= 100 ? "bg-emerald-500" : "bg-blue-400"}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    </div>
                </div>
            ) : (
                <>
            { /* Overdue Tasks */ }
            { showOverdueTasks && (
                overdueCount > 0 ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row">
                            <h1 className="font-bold text-red-500">Overdue Tasks</h1>
                            <p className="text-muted-foreground font-bold text-right ml-auto">
                                {taskState!.overdue_tasks.filter((t) => t.completed).length}/{taskState!.overdue_tasks.length}
                            </p>
                        </div>
                        {overdueTasks.slice(0, overdueCount).map((task) => (
                            <TaskCard key={task.id} task={task} refresh={() => {}} className="bg-red-500/25" />
                        ))}
                        {overdueHidden > 0 && (
                            <p className="text-xs text-muted-foreground text-center">+{overdueHidden} more overdue</p>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center">+{overdueHidden} more overdue</p>
                )
            )}

            { /* Tasks Due Today */ }
            {showTasksDueToday && (
                dueTodayCount > 0 ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row">
                            <h1 className="font-bold">Tasks Due Today</h1>
                            <p className="text-muted-foreground font-bold text-right ml-auto">
                                {taskState!.tasks_due_today.filter((t) => t.completed).length}/{taskState!.tasks_due_today.length}
                            </p>
                        </div>
                        {dueTodayTasks.slice(0, dueTodayCount).map((task) => (
                            <TaskCard key={task.id} task={task} refresh={() => {}} />
                        ))}
                        {dueTodayHidden > 0 && (
                            <p className="text-xs text-muted-foreground text-center">+{dueTodayHidden} more due today</p>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center">+{dueTodayHidden} more due today</p>
                )
            )}

            { /* Tasks Set To Start Today */ }
            {showTodayTasks && (
                todayCount > 0 ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row">
                            <h1 className="font-bold">To Do Today</h1>
                            <p className="text-muted-foreground font-bold text-right ml-auto">
                                {taskState!.today_tasks.filter((t) => t.completed).length}/{taskState!.today_tasks.length}
                            </p>
                        </div>
                        {todayTasks.slice(0, todayCount).map((task) => (
                            <TaskCard key={task.id} task={task} refresh={() => {}} />
                        ))}
                        {todayHidden > 0 && (
                            <p className="text-xs text-muted-foreground text-center">+{todayHidden} more to do today</p>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground text-center">+{todayHidden} more to do today</p>
                )
            ) }
                </>
            )}
        </WidgetContainer>
    );
}

export function TasksLong() {
    const { taskState } = useTaskState();
    const { navigate } = useNavigation();

    const overdueCount = taskState ? taskState.overdue_tasks.filter((t) => !t.completed).length : 0;
    const dueTodayCount = taskState ? taskState.tasks_due_today.filter((t) => !t.completed).length : 0;
    const todayCount = taskState ? taskState.today_tasks.filter((t) => !t.completed).length : 0;

    return (
        <WidgetContainer onClick={() => navigate("tasks")}>
            <div className="flex flex-row justify-center items-stretch h-full divide-x divide-border/50">
                {overdueCount > 0 && (
                    <div className="flex flex-1 items-center justify-center gap-1 px-1">
                        <CircleAlertIcon className="text-red-500 w-4 shrink-0" />
                        <p className="text-red-500 font-medium text-center text-sm">{overdueCount} Task{overdueCount !== 1 ? 's' : ''} Overdue</p>
                    </div>
                )}
                {dueTodayCount > 0 && (
                    <div className="flex flex-1 items-center justify-center gap-1 px-1">
                        <ClockIcon className="w-4 shrink-0" />
                        <p className="text-center font-medium text-foreground text-sm">{dueTodayCount} Task{dueTodayCount !== 1 ? 's' : ''} Due Today</p>
                    </div>
                )}
                {todayCount > 0 && (
                    <div className="flex flex-1 items-center justify-center gap-1 px-1">
                        <ClockIcon className="w-4 shrink-0" />
                        <p className="text-center font-medium text-foreground text-sm">{todayCount} Task{todayCount !== 1 ? 's' : ''} Today</p>
                    </div>
                )}
            </div>
        </WidgetContainer>
    )
}

export function TasksSmall() {
    const { taskState } = useTaskState();
    const { navigate } = useNavigation();

    const overdueCount = taskState ? taskState.overdue_tasks.filter((t) => !t.completed).length : 0;
    const dueTodayCount = taskState ? taskState.tasks_due_today.filter((t) => !t.completed).length : 0;
    const todayCount = taskState ? taskState.today_tasks.filter((t) => !t.completed).length : 0;

    const totalPending = overdueCount + dueTodayCount + todayCount;
    const primary = overdueCount > 0
        ? { count: overdueCount, label: "Overdue", color: "text-red-500", icon: true }
        : dueTodayCount > 0
        ? { count: dueTodayCount, label: "Due Today", color: "text-foreground", icon: false }
        : todayCount > 0
        ? { count: todayCount, label: "Today", color: "text-foreground", icon: false }
        : null;

    return (
        <WidgetContainer onClick={() => navigate("tasks")}>
            <div className="flex flex-col items-center justify-center h-full gap-1">
                {primary ? (
                    <>
                        {primary.icon && <CircleAlertIcon className={`w-5 mb-1 ${primary.color}`} />}
                        <p className={`text-3xl font-bold ${primary.color}`}>{primary.count} Tasks</p>
                        <p className={`text-xs font-medium ${primary.color === "text-red-500" ? primary.color : "text-muted-foreground"}`}>
                            {primary.label}
                        </p>
                        {totalPending > primary.count && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                                +{totalPending - primary.count} more
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">No Tasks</p>
                )}
            </div>
        </WidgetContainer>
    )
}