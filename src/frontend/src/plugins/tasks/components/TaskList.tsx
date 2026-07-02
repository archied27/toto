import TaskCard from "./TaskCard";
import { type Task } from "../useTasks";

export default function TaskList({ tasks, refresh, title }: { tasks: Task[]; refresh: () => void; title: string }) {
    const isEmpty = tasks.length === 0;

    return (
        isEmpty ? (
            <></>
        ) : (
            <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                {tasks.map(task => (
                    <TaskCard key={task.id} task={task} refresh={refresh} />
                ))}
            </div>
        )
    );
}