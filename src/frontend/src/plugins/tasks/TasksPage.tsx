import { useEffect, useState } from "react";
import { parseISO, subDays } from "date-fns";
import Hero from "./components/Hero";
import { useGetAllTasks, useGetTomorrowTasks, useGetUpcomingTasks, useTaskState, useGetLabelTasks, useGetListTasks, useGetTaskLabels, useGetTaskLists, type SweepDirection, type Task } from "./useTasks";
import TaskTabs from "./components/TaskTabs";
import TaskList from "./components/TaskList";
import TaskCard from "./components/TaskCard";
import AddTask from "./components/AddTask";
import TaskFilter from "./components/TaskFilter";
import ActiveFilters from "./components/ActiveFilters";
import { useNavigation } from "@/hooks/NavigationContext";

export default function TasksPage() {
    const { taskState, getTasks } = useTaskState();
    const { tasks: allTasks, refetch: getAllTasks } = useGetAllTasks();
    const { tasks: tomorrowTasks, refetch: getTomorrowTasks } = useGetTomorrowTasks();
    const { tasks: upcomingTasks, refetch: getUpcomingTasks } = useGetUpcomingTasks();

    const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
    const [selectedListId, setSelectedListId] = useState<number | null>(null);

    const { tasks: labelFilteredTasks, refetch: getLabelTasks } = useGetLabelTasks(selectedLabelId);
    const { tasks: listFilteredTasks, refetch: getListTasks } = useGetListTasks(selectedListId);
    const { taskLabels } = useGetTaskLabels();
    const { taskLists } = useGetTaskLists();

    const [currentTab, setCurrentTab] = useState<"Today" | "Tomorrow" | "Upcoming" | "All">("All");

    const [currentTasks, setCurrentTasks] = useState<Task[]>(taskState?.today_tasks || []);
    const [currentRefresh, setCurrentRefresh] = useState<() => void>(() => () => {});

    const { params } = useNavigation();

    const [addTaskPageOpen, setAddTaskPageOpen] = useState(false);

    // Tasks whose sweep animation is still playing. While a task is sweeping it is
    // kept in the section it started in, so the websocket state update moving it to
    // another section can't unmount its card and cut the animation short.
    const [sweeps, setSweeps] = useState<Record<number, { direction: SweepDirection; task: Task }>>({});

    // Task ids currently fading out of the section they were in. Their card is kept
    // mounted there (with the leave animation) until the fade finishes, then the
    // section move happens and the task fades back in at its new home.
    const [leaving, setLeaving] = useState<Set<number>>(new Set());
    // Task ids currently fading into the section they moved to.
    const [entering, setEntering] = useState<Set<number>>(new Set());

    const handleSweepingChange = (taskId: number, direction: SweepDirection | null) => {
        if (direction === null) {
            // Sweep finished. Keep the card pinned in its old section — the sweeps
            // entry stays in place so the filters still include it — while it fades
            // out there. Then drop the pin and let it move to its new section,
            // where it fades back in.
            setLeaving(prev => new Set(prev).add(taskId));
            window.setTimeout(() => {
                setSweeps(prev => {
                    const next = { ...prev };
                    delete next[taskId];
                    return next;
                });
                setLeaving(prev => {
                    const next = new Set(prev);
                    next.delete(taskId);
                    return next;
                });
                setEntering(prev => new Set(prev).add(taskId));
                window.setTimeout(() => {
                    setEntering(prev => {
                        const next = new Set(prev);
                        next.delete(taskId);
                        return next;
                    });
                }, 550);
            }, 300);
            return;
        }
        setSweeps(prev => {
            const next = { ...prev };
            const task = currentTasks.find(task => task.id === taskId)
                ?? (taskState?.overdue_tasks || []).find(task => task.id === taskId)
                ?? prev[taskId]?.task;
            if (!task) return prev;
            next[taskId] = { direction, task };
            return next;
        });
    };

    const sevenDaysAgo = subDays(new Date(), 7);

    const completingSweeps = Object.values(sweeps).filter(s => s.direction === "complete");

    const overdueBase = (taskState?.overdue_tasks || []).filter(task => !sweeps[task.id]);
    const overdueIds = overdueBase.map(task => task.id);
    const dedupedTasks = currentTasks.filter(task => !overdueIds.includes(task.id));

    // A sweeping task belongs to the main lists if it is still in the current task
    // source; otherwise (e.g. an overdue task the state update already dropped) it
    // stays in the overdue list for the duration of the sweep.
    const inMainList = (taskId: number) => currentTasks.some(task => task.id === taskId);

    const overdueTasks = [
        ...overdueBase,
        ...completingSweeps.filter(s => !inMainList(s.task.id)).map(s => s.task),
    ];

    const completedTasks = dedupedTasks.filter(task =>
        sweeps[task.id]?.direction === "incomplete"
        || (
            task.completed
            && !sweeps[task.id]
            && (task.date_completed ? parseISO(task.date_completed) >= sevenDaysAgo : false)
        )
    );
    const incompleteTasks = dedupedTasks.filter(task =>
        sweeps[task.id]?.direction === "complete"
        || (!task.completed && !sweeps[task.id])
    );

    const activeLabel = taskLabels.find(label => label.id === selectedLabelId) ?? null;
    const activeList = taskLists.find(list => list.id === selectedListId) ?? null;
    const filtersActive = selectedLabelId !== null || selectedListId !== null;

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
                // Determine which tasks to show based on filters
                if (selectedLabelId !== null) {
                    setCurrentTasks(labelFilteredTasks);
                    setCurrentRefresh(() => getLabelTasks);
                } else if (selectedListId !== null) {
                    setCurrentTasks(listFilteredTasks);
                    setCurrentRefresh(() => getListTasks);
                } else {
                    setCurrentTasks(allTasks);
                    setCurrentRefresh(() => getAllTasks);
                }
                break;
        }
    }, [taskState, tomorrowTasks, upcomingTasks, allTasks, labelFilteredTasks, listFilteredTasks, selectedLabelId, selectedListId, currentTab]);

    const handleTabChange = (tab: "Today" | "Tomorrow" | "Upcoming" | "All") => {
        setCurrentTab(tab);
        if (tab === "Tomorrow") getTomorrowTasks();
        if (tab === "Upcoming") getUpcomingTasks();
        if (tab === "All") getAllTasks();
    };

    useEffect(() => {
        if (params?.addTask === true) {
            setAddTaskPageOpen(true);
        }
    }, [params]);

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

                    {filtersActive && (
                        <div className="flex items-center gap-2">
                            <TaskFilter
                                labels={taskLabels}
                                lists={taskLists}
                                selectedLabelId={selectedLabelId}
                                selectedListId={selectedListId}
                                onLabelSelect={setSelectedLabelId}
                                onListSelect={setSelectedListId}
                            />
                            <ActiveFilters
                                labels={activeLabel ? [activeLabel] : []}
                                lists={activeList ? [activeList] : []}
                                onLabelRemove={() => setSelectedLabelId(null)}
                                onListRemove={() => setSelectedListId(null)}
                            />
                        </div>
                    )}

                    {overdueTasks.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-red-500">Overdue Tasks</h2>
                                {!filtersActive && (taskLabels.length > 0 || taskLists.length > 0) && (
                                    <TaskFilter
                                        labels={taskLabels}
                                        lists={taskLists}
                                        selectedLabelId={selectedLabelId}
                                        selectedListId={selectedListId}
                                        onLabelSelect={setSelectedLabelId}
                                        onListSelect={setSelectedListId}
                                    />
                                )}
                            </div>
                            {overdueTasks.map(task => (
                                <TaskCard key={task.id} task={task} refresh={getAllTasks} className={`bg-red-500/25 ${leaving.has(task.id) ? "animate-task-leave" : ""}`} onSweepingChange={handleSweepingChange} />
                            ))}
                        </div>
                    )}
                    {incompleteTasks.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {overdueTasks.length === 0 && (
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-foreground">To Do Tasks</h2>
                                    {!filtersActive && (taskLabels.length > 0 || taskLists.length > 0) && (
                                        <TaskFilter
                                            labels={taskLabels}
                                            lists={taskLists}
                                            selectedLabelId={selectedLabelId}
                                            selectedListId={selectedListId}
                                            onLabelSelect={setSelectedLabelId}
                                            onListSelect={setSelectedListId}
                                        />
                                    )}
                                </div>
                            )}
                            {overdueTasks.length > 0 && <h2 className="text-lg font-semibold text-foreground">To Do Tasks</h2>}
                            {incompleteTasks.map(task => (
                                <TaskCard key={task.id} task={task} refresh={currentRefresh} className={entering.has(task.id) ? "animate-fade-slide-in" : leaving.has(task.id) ? "animate-task-leave" : undefined} onSweepingChange={handleSweepingChange} />
                            ))}
                        </div>
                    )}
                    {completedTasks.length > 0  && (
                        <TaskList tasks={completedTasks} refresh={currentRefresh} title="Completed Tasks" titleClassName="text-muted-foreground" cardClassName="opacity-50" onSweepingChange={handleSweepingChange} entering={entering} leaving={leaving} />
                    )}

                    {dedupedTasks.length === 0 && (
                        <div className="flex flex-1 items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                {selectedLabelId !== null || selectedListId !== null
                                    ? "No tasks match this filter"
                                    : "All Tasks Completed"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}