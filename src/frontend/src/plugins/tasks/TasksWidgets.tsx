import { CardTitle } from "@/components/ui/card";
import { useTaskState } from "./useTasks";
import { HeroContainer } from "@/components/HeroContainer";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "./components/TaskCard";

const maxTasksToShow = 3;

export function TasksHero() {
    const { taskState } = useTaskState();
    
    const showOverdueTasks = taskState && (taskState.overdue_tasks.filter((t) => !t.completed)).length > 0;
    const showTasksDueToday = taskState && (taskState.tasks_due_today.filter((t) => !t.completed)).length > 0;
    const showTodayTasks = taskState && (taskState.today_tasks.filter((t) => !t.completed)).length > 0;

    // calculate the number of tasks to show for each category
    const overdueTasks = taskState ? taskState.overdue_tasks.filter((t) => !t.completed) : [];
    const dueTodayTasks = taskState ? taskState.tasks_due_today.filter((t) => !t.completed) : [];
    const todayTasks = taskState ? taskState.today_tasks.filter((t) => !t.completed) : [];

    const globalMax = overdueTasks.length > 0 ? 2 : maxTasksToShow;
    
    let remainingBudget = globalMax;

    const overdueCount = Math.min(overdueTasks.length, remainingBudget);
    remainingBudget -= overdueCount;

    const dueTodayCount = Math.min(dueTodayTasks.length, remainingBudget);
    remainingBudget -= dueTodayCount;

    const todayCount = Math.min(todayTasks.length, remainingBudget);

    console.log("overdueCount", overdueCount);
    console.log("dueTodayCount", dueTodayCount);
    console.log("todayCount", todayCount);

    return (
        <HeroContainer>
            <CardTitle className="text-center">
                Today's Tasks
            </CardTitle>

            { /* Overdue Tasks */ }
            { showOverdueTasks && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row">
                        <h1 className="font-bold text-red-500">To Do Today</h1>
                        <p className="text-muted-foreground font-bold text-right ml-auto">
                            {taskState.overdue_tasks.filter((t) => t.completed).length}/{taskState.overdue_tasks.length}
                        </p>
                    </div>
                    {taskState ? taskState.overdue_tasks.filter((t) => !t.completed).slice(0, overdueCount).map((task) => (
                        <TaskCard key={task.id} task={task} refresh={() => {}} />
                    ))
                    : <Skeleton className="h-4 w-full" />}
                </div>
            )}

            { /* Tasks Due Today */ }
            {showTasksDueToday && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row">
                        <h1 className="font-bold">To Do Today</h1>
                        <p className="text-muted-foreground font-bold text-right ml-auto">
                            {taskState.tasks_due_today.filter((t) => t.completed).length}/{taskState.tasks_due_today.length}
                        </p>
                    </div>
                    {taskState ? taskState.tasks_due_today.filter((t) => !t.completed).slice(0, dueTodayCount).map((task) => (
                        <TaskCard key={task.id} task={task} refresh={() => {}} />
                    ))
                    : <Skeleton className="h-4 w-full" />}
                </div>
            )}

            { /* Tasks Set To Start Today */ }
            {showTodayTasks && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row">
                        <h1 className="font-bold">To Do Today</h1>
                        <p className="text-muted-foreground font-bold text-right ml-auto">
                            {taskState.today_tasks.filter((t) => t.completed).length}/{taskState.today_tasks.length}
                        </p>
                    </div>
                    {taskState ? taskState.today_tasks.filter((t) => !t.completed).slice(0, todayCount).map((task) => (
                        <TaskCard key={task.id} task={task} refresh={() => {}} />
                    ))
                    : <Skeleton className="h-4 w-full" />}
                </div>
            ) }

        </HeroContainer>
    );
}