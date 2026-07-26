import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteTask, type Task } from "./useTasks";
import TaskCard from "./components/TaskCard";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UndoIcon } from "lucide-react";

export function ShowTasksCommandResult({ data, title, emptyMessage }: { data: { tasks: Task[] }, title: string, emptyMessage: string }) {
    return (
        <Card className="p-2 border-none shadow-none flex flex-col gap-2 opacity-80">
            <CardHeader className="justify-center p-3">
                <CardTitle className="text-lg font-semibold text-center">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-0 pb-5">
                {data.tasks.length === 0 ? (
                    <h2 className="text-md font-medium text-muted-foreground text-center">
                        {emptyMessage}
                    </h2>
                ) : (
                    data.tasks.map((task) => (
                        <TaskCard task={task} key={task.id} refresh={() => {}} className={`${task.completed ? "opacity-80" : ""}`} />
                    ))
                )}
            </CardContent>
        </Card>
    )
}

export function NewTaskCreated({ data }: { data: { task: Task } }) {
    const [undoDone, setUndoDone] = useState(false);
    const { deleteTask } = useDeleteTask();

    const handleUndo = async () => {
        await deleteTask(data.task.id);
        setUndoDone(true);
    }

    return (
        undoDone ? 
            (<Card className="p-2 border-none shadow-none flex flex-col gap-2 opacity-80">
                <CardHeader className="justify-center p-3">
                    <CardTitle className="text-lg font-semibold text-center">
                        Task Deleted
                    </CardTitle>
                </CardHeader>
            </Card>) : (
            <Card className="p-2 border-none shadow-none flex flex-col gap-2 opacity-80">
                <CardHeader className="justify-center p-3">
                    <CardTitle className="text-lg font-semibold text-center">
                        New Task Created
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-0 pb-5">
                    <TaskCard task={data.task} key={data.task.id} refresh={() => {}} />
                    <div className="justify-center gap-2 text-center">
                        <Button className="bg-muted text-foreground border-xl" onClick={handleUndo}>
                            <UndoIcon className="w-4 h-4 text-destructive" />
                            <p className="text-destructive">Undo</p>
                        </Button>
                    </div>
                </CardContent>
            </Card>
            )
    )
}