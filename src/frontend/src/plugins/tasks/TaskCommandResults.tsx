import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task } from "./useTasks";
import TaskCard from "./components/TaskCard";

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