import { useEffect, useState } from "react";
import Hero from "./components/Hero";
import { useGetAllTasks, useGetTomorrowTasks, useGetUpcomingTasks, useTaskState, type Task } from "./useTasks";
import TaskTabs from "./components/TaskTabs";
import TaskList from "./components/TaskList";
import AddTask from "./components/AddTask";

export default function TasksPage() {
    const { taskState, getTasks } = useTaskState();
    const { tasks: allTasks, refetch: getAllTasks } = useGetAllTasks();
    const { tasks: tomorrowTasks, refetch: getTomorrowTasks } = useGetTomorrowTasks();
    const { tasks: upcomingTasks, refetch: getUpcomingTasks } = useGetUpcomingTasks();

    const [currentTab, setCurrentTab] = useState<"Today" | "Tomorrow" | "Upcoming" | "All">("Today");

    const [currentTasks, setCurrentTasks] = useState<Task[]>(taskState?.today_tasks || []);
    const [currentRefresh, setCurrentRefresh] = useState<() => void>(() => () => {});

    const [addTaskPageOpen, setAddTaskPageOpen] = useState(false);

    const overdueTasks = taskState?.overdue_tasks || [];
    const overdueIds = overdueTasks.map(task => task.id);
    const dedupedTasks = currentTasks.filter(task => !overdueIds.includes(task.id));

    const completedTasks = dedupedTasks.filter(task => task.completed);
    const incompleteTasks = dedupedTasks.filter(task => !task.completed);

    useEffect(() => {
        switch (currentTab) {
            case "Today":
                const merged = [
                ...(taskState?.tasks_due_today || []),
                ...(taskState?.today_tasks || []),
                ];
                const seen = new Set<number | string>();
                const deduped = merged.filter(task => {
                    if (seen.has(task.id)) return false;
                    seen.add(task.id);
                    return true;
                });
                setCurrentTasks(deduped);
                setCurrentRefresh(() => () => getTasks);
                break;
            case "Tomorrow":
                setCurrentTasks(tomorrowTasks);
                setCurrentRefresh(() => getTomorrowTasks);
                break;
            case "Upcoming":
                setCurrentTasks(upcomingTasks);
                setCurrentRefresh(() => getUpcomingTasks);
                break;
            case "All":
                setCurrentTasks(allTasks);
                setCurrentRefresh(() => getAllTasks);
                break;
        }
    }, [taskState, tomorrowTasks, upcomingTasks, allTasks, currentTab]);

    const handleTabChange = (tab: "Today" | "Tomorrow" | "Upcoming" | "All") => {
        setCurrentTab(tab);
        if (tab === "Tomorrow") getTomorrowTasks();
        if (tab === "Upcoming") getUpcomingTasks();
        if (tab === "All") getAllTasks();
    };

    return (
        <div className="bg-background text-foreground px-3 pb-35 min-h-screen flex flex-col">
            <div className="relative flex-1 flex flex-col">
                {addTaskPageOpen && (
                    <>
                        <div
                        className="fixed inset-0 z-40"
                        onClick={() => setAddTaskPageOpen(false)}
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none">
                        <div className="pointer-events-auto w-full max-w-sm">
                            <AddTask onClose={() => setAddTaskPageOpen(false)} />
                        </div>
                        </div>
                    </>
                )}

                <div className={`${addTaskPageOpen ? "opacity-50 blur pointer-events-none" : ""} gap-5 pt-5 flex flex-col flex-1 transition-opacity`}>
                    <Hero selected={currentTab} total={dedupedTasks.length} completed={completedTasks.length} handleAddTask={() => setAddTaskPageOpen(true)} />
                    <TaskTabs currentTab={currentTab} onTabChange={handleTabChange} />

                    {overdueTasks.length > 0 && (
                        <TaskList tasks={overdueTasks} refresh={getAllTasks} title="Overdue Tasks" titleClassName="text-red-500" cardClassName="bg-red-500/25" />
                    )}
                    {incompleteTasks.length > 0 && (
                        <TaskList tasks={incompleteTasks} refresh={currentRefresh} title="To Do Tasks" />
                    )}
                    {completedTasks.length > 0  && (
                        <TaskList tasks={completedTasks} refresh={currentRefresh} title="Completed Tasks" titleClassName="text-muted-foreground" cardClassName="opacity-50" />
                    )}

                    {dedupedTasks.length === 0 && (
                        <div className="flex flex-1 items-center justify-center">
                            <p className="text-sm text-muted-foreground">All Tasks Completed</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}