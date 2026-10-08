import { useTaskState, useStartWork, useStopWork, usePauseWork, type Task } from "./useTasks";
import TaskCard from "./components/TaskCard";
import { useNavigation } from "@/hooks/NavigationContext";
import { WidgetContainer } from "@/components/WidgetContainer";
import { Button } from "@/components/ui/button";
import { CircleAlertIcon, ClockIcon, PauseIcon, PlayIcon, SquareIcon, TimerIcon, SkipForwardIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
    return (task.session_elapsed ?? 0) + sessionSeconds;
}

const SHORT_BREAK_SECONDS = 5 * 60;
const LONG_BREAK_SECONDS = 15 * 60;

export function PomodoroTimer({ tasks, initialTaskId, onStop, fillHeight = false }: { tasks: Task[]; initialTaskId: number; onStop: () => void; fillHeight: Boolean }) {
    const { startWork, loading: starting } = useStartWork();
    const { stopWork, loading: stopping } = useStopWork();
    const { pauseWork, loading: pausing } = usePauseWork();
    const activeTask = tasks.find((task) => task.is_working || task.is_paused) ?? null;
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(initialTaskId);
    const [phase, setPhase] = useState<"focus" | "break">("focus");
    const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
    const [breakRemaining, setBreakRemaining] = useState(SHORT_BREAK_SECONDS);
    const [completedFocusSessions, setCompletedFocusSessions] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [animateStop, setAnimateStop] = useState(false);
    const transitionInProgress = useRef(false);
    const timerBusy = starting || stopping || pausing;

    useEffect(() => {
        if (activeTask && activeTask.id !== selectedTaskId) {
            const syncTimer = window.setTimeout(() => {
                setSelectedTaskId(activeTask.id);
                setPhase("focus");
                setBreakEndsAt(null);
                setCompletedFocusSessions(0);
            }, 0);
            return () => window.clearTimeout(syncTimer);
        }
    }, [activeTask, activeTask?.id, selectedTaskId]);

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, []);

    const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
    const elapsedSeconds = useLiveWorkSeconds(phase === "focus" ? selectedTask : null);
    const goalSeconds = selectedTask?.pomodoro_goal || 1500;
    const breakSeconds = completedFocusSessions > 0 && completedFocusSessions % 4 === 0
        ? LONG_BREAK_SECONDS
        : SHORT_BREAK_SECONDS;
    const remainingSeconds = phase === "break"
        ? (breakEndsAt ? Math.max(0, Math.ceil((breakEndsAt - now) / 1000)) : breakRemaining)
        : Math.max(0, goalSeconds - elapsedSeconds);

    useEffect(() => {
        if (phase !== "focus" || !selectedTask?.is_working || elapsedSeconds < goalSeconds || transitionInProgress.current) return;
        transitionInProgress.current = true;
        void pauseWork(selectedTask.id).then(() => {
            const nextSessions = completedFocusSessions + 1;
            const nextBreak = nextSessions % 4 === 0 ? LONG_BREAK_SECONDS : SHORT_BREAK_SECONDS;
            setCompletedFocusSessions(nextSessions);
            setBreakRemaining(nextBreak);
            setBreakEndsAt(Date.now() + nextBreak * 1000);
            setPhase("break");
        }).finally(() => {
            transitionInProgress.current = false;
        });
    }, [completedFocusSessions, elapsedSeconds, goalSeconds, pauseWork, phase, selectedTask]);

    useEffect(() => {
        if (phase !== "break" || !breakEndsAt || now < breakEndsAt) return;
        if (!selectedTask) return;
        const transitionTimer = window.setTimeout(() => {
            setBreakEndsAt(null);
            setPhase("focus");
            void startWork(selectedTask.id);
        }, 0);
        return () => window.clearTimeout(transitionTimer);
    }, [breakEndsAt, now, phase, selectedTask, startWork]);

    if (!selectedTask) return null;

    const accentColour = selectedTask.task_list?.colour ?? selectedTask.labels?.[0]?.colour ?? "hsl(var(--primary))";
    const progress = phase === "focus" ? Math.min(100, (elapsedSeconds / goalSeconds) * 100) : (remainingSeconds / breakSeconds) * 100;
    const isRunning = phase === "focus" ? Boolean(selectedTask.is_working) : Boolean(breakEndsAt);

    const togglePause = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (timerBusy) return;
        if (phase === "break") {
            if (breakEndsAt) {
                const remaining = Math.max(0, Math.ceil((breakEndsAt - Date.now()) / 1000));
                setBreakRemaining(remaining);
                setBreakEndsAt(null);
            } else {
                setBreakEndsAt(Date.now() + breakRemaining * 1000);
            }
            return;
        }
        if (selectedTask.is_working) {
            await pauseWork(selectedTask.id);
        } else {
            await startWork(selectedTask.id);
        }
    };

    const skipBreak = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (timerBusy) return;
        if (phase === "break") {
            // End break early and start next focus session
            if (selectedTask) {
                const nextSessions = completedFocusSessions + 1;
                const nextBreak = nextSessions % 4 === 0 ? LONG_BREAK_SECONDS : SHORT_BREAK_SECONDS;
                setCompletedFocusSessions(nextSessions);
                setBreakRemaining(nextBreak);
                setBreakEndsAt(Date.now() + nextBreak * 1000);
                setPhase("break");

                // Automatically start the next focus session after a brief pause
                setTimeout(async () => {
                    if (selectedTask) {
                        await startWork(selectedTask.id);
                        setPhase("focus");
                        setBreakEndsAt(null);
                    }
                }, 500);
            }
        }
    };

    const skipToBreak = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (timerBusy) return;
        if (phase === "focus" && selectedTask?.is_working) {
            // Skip to break: stop current focus and start break immediately
            await pauseWork(selectedTask.id);
            const nextSessions = completedFocusSessions + 1;
            const nextBreak = nextSessions % 4 === 0 ? LONG_BREAK_SECONDS : SHORT_BREAK_SECONDS;
            setCompletedFocusSessions(nextSessions);
            setBreakRemaining(nextBreak);
            setBreakEndsAt(Date.now() + nextBreak * 1000);
            setPhase("break");
        }
    };

    const stopTimer = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (timerBusy) return;
        await stopWork(selectedTask.id);
        onStop();
        setAnimateStop(true);
        // Wait for animation to end before resetting state
        setTimeout(() => {
            setSelectedTaskId(null);
            setPhase("focus");
            setBreakEndsAt(null);
            setCompletedFocusSessions(0);
            setAnimateStop(false);
        }, 500);
    };

    return (
        <div className={`flex flex-col gap-3 animate-pomodoro-enter ${fillHeight ? "h-full min-h-0" : ""} ${animateStop ? "animate-pomodoro-stop" : ""}`}>
            {/* Header: title on the left, controls on the right */}
            <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300" style={{ backgroundColor: `${accentColour}18`, color: accentColour }}>
                    <TimerIcon key={`${phase}-${isRunning}`} className={`size-4 animate-pomodoro-icon ${isRunning ? "animate-pulse" : ""}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accentColour }}>
                        {phase === "focus" ? (isRunning ? "Focus" : "Focus paused") : (isRunning ? "Break" : "Break paused")}
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{selectedTask.title}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="icon" variant="outline" className="size-8 shrink-0 rounded-lg transition-transform duration-200 active:scale-90" onClick={togglePause} disabled={timerBusy} aria-label={isRunning ? "Pause timer" : "Resume timer"} title={isRunning ? "Pause timer" : "Resume timer"}>
                        <span key={`${phase}-${isRunning}`} className="animate-pomodoro-icon">
                            {isRunning ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
                        </span>
                    </Button>
                    {phase === "focus" && (
                        <Button size="icon" variant="secondary" className="size-8 shrink-0 rounded-lg transition-transform duration-200 active:scale-90" onClick={skipToBreak} disabled={timerBusy || !selectedTask?.is_working} aria-label="Skip to break" title="Skip to break">
                            <SkipForwardIcon className="size-4" />
                        </Button>
                    )}
                    {phase === "break" && (
                        <Button size="icon" variant="secondary" className="size-8 shrink-0 rounded-lg transition-transform duration-200 active:scale-90" onClick={skipBreak} disabled={timerBusy} aria-label="Skip break" title="Skip break">
                            <SkipForwardIcon className="size-4" />
                        </Button>
                    )}
                    <Button size="icon" variant="destructive" className="size-8 shrink-0 rounded-lg transition-transform duration-200 active:scale-90" onClick={stopTimer} disabled={timerBusy} aria-label="Stop timer" title="Stop timer">
                        <SquareIcon className="size-4 transition-transform duration-200" />
                    </Button>
                </div>
            </div>

            {/* Ring: sized by width, so it works in auto-height containers */}
            <div className="flex flex-1 items-center justify-center">
                <div className={`relative flex aspect-square items-center justify-center ${
                    fillHeight ? "h-full max-h-full max-w-full" : "w-full max-w-72"
                }`}>
                    <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                        <circle cx="50" cy="50" r="46" fill="none" stroke={accentColour} strokeOpacity="0.15" strokeWidth="5" />
                        <circle cx="50" cy="50" r="46" fill="none" stroke={accentColour} strokeWidth="5" strokeLinecap="round" pathLength="100" className="transition-[stroke-dashoffset] duration-700 ease-linear" style={{ strokeDasharray: "100", strokeDashoffset: `${100 - progress}` }} />
                    </svg>
                    <div className="relative flex flex-col items-center">
                        <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accentColour }}>
                            {phase === "focus" ? "Focus" : `${completedFocusSessions % 4 === 0 ? "Long" : "Short"} break`}
                        </span>
                        <span key={`${phase}-${Math.floor((phase === "focus" ? elapsedSeconds : remainingSeconds) / 60)}`} className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-foreground animate-pomodoro-time">
                            {formatTimer(phase === "focus" ? elapsedSeconds : remainingSeconds)}
                        </span>
                        <span className="mt-2 text-base font-medium tabular-nums text-muted-foreground">
                            / {formatTimer(phase === "focus" ? goalSeconds : breakSeconds)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TasksHero() {
    const { taskState } = useTaskState();
    const { navigate } = useNavigation();

    const overdueTasks = taskState ? taskState.overdue_tasks.filter((t) => !t.completed) : [];
    const dueTodayTasks = taskState ? taskState.tasks_due_today.filter((t) => !t.completed) : [];
    const todayTasks = taskState ? taskState.today_tasks.filter((t) => !t.completed) : [];
    const availableTasks = [...(taskState?.active_tasks ?? []), ...overdueTasks, ...dueTodayTasks, ...todayTasks]
        .filter((task, index, tasks) => tasks.findIndex(candidate => candidate.id === task.id) === index);
    const activeTask = availableTasks.find(task => task.is_working || task.is_paused) ?? null;
    const [pomodoroTaskId, setPomodoroTaskId] = useState<number | null>(activeTask?.id ?? null);
    useEffect(() => {
        if (!activeTask) return;
        const syncTimer = window.setTimeout(() => setPomodoroTaskId(activeTask.id), 0);
        return () => window.clearTimeout(syncTimer);
    }, [activeTask, activeTask?.id]);
    const pomodoroTask = availableTasks.find((task) => task.id === pomodoroTaskId) ?? null;

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
            {pomodoroTask ? (
                <PomodoroTimer tasks={availableTasks} initialTaskId={pomodoroTask.id} onStop={() => setPomodoroTaskId(null)} fillHeight />
            ) : (
                <>
            { /* Overdue Tasks */ }
            { showOverdueTasks && (
                overdueCount > 0 ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row">
                            <h1 className="font-bold text-muted-foreground">Overdue Tasks</h1>
                            <p className="text-muted-foreground font-bold text-right ml-auto">
                                {taskState!.overdue_tasks.filter((t) => t.completed).length}/{taskState!.overdue_tasks.length}
                            </p>
                        </div>
                        {overdueTasks.slice(0, overdueCount).map((task) => (
                            <TaskCard key={task.id} task={task} refresh={() => {}} className="bg-muted/25" />
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