import TaskCard from "./TaskCard";
import { type Task } from "../useTasks";

export default function TaskList({ tasks, refresh, title, titleClassName, cardClassName }: { tasks: Task[]; refresh: () => void; title: string; titleClassName?: string; cardClassName?: string }) {
    const isEmpty = tasks.length === 0;

    return (
        isEmpty ? (
            <></>
        ) : (
            <div className="flex flex-col gap-2">
                <h2 className={`text-lg font-semibold text-foreground ${titleClassName || ""}`}>{title}</h2>
                {tasks.map(task => (
                    <TaskCard key={task.id} task={task} refresh={refresh} className={cardClassName || ""} />
                ))}
            </div>
        )
    );
}