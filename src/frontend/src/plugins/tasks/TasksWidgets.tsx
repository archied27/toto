import { CardTitle } from "@/components/ui/card";
import { useTaskState } from "./useTasks";
import TaskCard from "./components/TaskCard";
import { useNavigation } from "@/hooks/NavigationContext";
import { WidgetContainer } from "@/components/WidgetContainer";
import { CircleAlertIcon, ClockIcon } from "lucide-react";

const maxTasksToShow = 2;

export function TasksHero() {
    const { taskState } = useTaskState();
    const { navigate } = useNavigation();

    const overdueTasks = taskState ? taskState.overdue_tasks.filter((t) => !t.completed) : [];
    const dueTodayTasks = taskState ? taskState.tasks_due_today.filter((t) => !t.completed) : [];
    const todayTasks = taskState ? taskState.today_tasks.filter((t) => !t.completed) : [];

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
            <CardTitle className="text-center">
                Today's Tasks
            </CardTitle>

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
            <div className="flex flex-row justify-center items-stretch h-full divide-x divide-border">
                {overdueCount > 0 && (
                    <div className="flex flex-1 items-center justify-center gap-1.5 px-2">
                        <CircleAlertIcon className="text-red-500 w-4 shrink-0" />
                        <p className="text-red-500 font-medium text-center text-sm">{overdueCount} Task{overdueCount !== 1 ? 's' : ''} Overdue</p>
                    </div>
                )}
                {dueTodayCount > 0 && (
                    <div className="flex flex-1 items-center justify-center gap-1.5 px-2">
                        <ClockIcon className="w-4 shrink-0" />
                        <p className="text-center font-medium text-foreground text-sm">{dueTodayCount} Task{dueTodayCount !== 1 ? 's' : ''} Due Today</p>
                    </div>
                )}
                {todayCount > 0 && (
                    <div className="flex flex-1 items-center justify-center gap-1.5 px-2">
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
1
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