import TaskCard from "./TaskCard";
import { type SweepDirection, type Task } from "../useTasks";

export default function TaskList({ tasks, refresh, title, titleClassName, cardClassName, onSweepingChange, entering, leaving }: {
    tasks: Task[];
    refresh: () => void;
    title: string;
    titleClassName?: string;
    cardClassName?: string;
    onSweepingChange?: (taskId: number, direction: SweepDirection | null) => void;
    entering?: Set<number>;
    leaving?: Set<number>;
}) {
    const isEmpty = tasks.length === 0;

    return (
        isEmpty ? (
            <></>
        ) : (
            <div className="flex flex-col gap-2">
                <h2 className={`text-lg font-semibold text-foreground ${titleClassName || ""}`}>{title}</h2>
                {tasks.map(task => (
                    <div key={task.id} className={entering?.has(task.id) ? "animate-fade-slide-in" : leaving?.has(task.id) ? "animate-task-leave" : undefined}>
                        <TaskCard task={task} refresh={refresh} className={cardClassName || ""} onSweepingChange={onSweepingChange} />
                    </div>
                ))}
            </div>
        )
    );
}