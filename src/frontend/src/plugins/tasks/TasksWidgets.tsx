import { CardTitle } from "@/components/ui/card";
import { useTaskState } from "./useTasks";
import { HeroContainer } from "@/components/HeroContainer";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "./components/TaskCard";

export function TasksHero() {
    const { taskState } = useTaskState();
    
    const showOverdueTasks = taskState && (taskState.overdue_tasks.filter((t) => !t.completed)).length > 0;
    const showTasksDueToday = taskState && (taskState.tasks_due_today.filter((t) => !t.completed)).length > 0;
    const showTodayTasks = taskState && (taskState.today_tasks.filter((t) => !t.completed)).length > 0;

    return (
        <HeroContainer>
            <CardTitle className="text-center">
                Today's Tasks
            </CardTitle>

            { /* Overdue Tasks */ }
            { showOverdueTasks ? (
                <div className="text-red-500">
                    You have {taskState.overdue_tasks.length} overdue tasks!
                </div>
            ) :
            <div className="text-green-500">
                You have no overdue tasks!
            </div> }

            { /* Tasks Due Today */ }
            {showTasksDueToday ? (
                <div className="text-blue-500">
                    You have {taskState.tasks_due_today.length} tasks due today!
                </div>
            ) : 
            <div className="text-green-500">
                You have no more tasks due today!
            </div> }

            { /* Tasks Set To Start Today */ }
            {showTodayTasks && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row">
                        <h1 className="font-bold">Tasks for Today</h1>
                        <p className="text-muted-foreground font-bold text-right ml-auto">
                            {taskState.today_tasks.filter((t) => t.completed).length}/{taskState.today_tasks.length}
                        </p>
                    </div>
                    {taskState ? taskState.today_tasks.filter((t) => !t.completed).map((task) => (
                        <TaskCard key={task.id} task={task} refresh={() => {}} />
                    ))
                    : <Skeleton className="h-4 w-full" />}
                </div>
            ) }

        </HeroContainer>
    );
}