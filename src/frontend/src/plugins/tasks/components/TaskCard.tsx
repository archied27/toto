import { Card } from "@/components/ui/card";
import { useDeleteTask, useToggleTaskCompletion, type Task } from "../useTasks";
import { format, isToday, isTomorrow, isYesterday ,isThisWeek, parseISO, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { getTextColour } from "../utils";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon, CircleIcon, EditIcon, TrashIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EditTask from "./EditTask";
import { useState } from "react";

export function formatTaskDate(isoString: string): string {
  const date = parseISO(isoString);
  const now = new Date();

  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";

  if (isThisWeek(date, { weekStartsOn: 1 })) {
    return format(date, "EEEE");
  }

  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

  if (date >= nextWeekStart && date <= nextWeekEnd) {
    return `Next ${format(date, "EEEE")}`;
  }

  return format(date, "do MMMM yyyy");
}

export default function TaskCard({ task, refresh, className }: { task: Task; refresh: () => void; className?: string }) {

    const { toggleCompletion } = useToggleTaskCompletion();
    const { deleteTask } = useDeleteTask();

    const [editOpen, setEditOpen] = useState(false);
    const [sweeping, setSweeping] = useState<"complete" | "incomplete" | null>(null);

    const handleToggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const completing = !task.completed;
        task.completed = completing;
        await toggleCompletion(task.id);
        setSweeping(completing ? "complete" : "incomplete");
        setTimeout(() => {
            setSweeping(null);
            refresh();
        }, 650);
    };

    const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        await deleteTask(task.id);
        refresh();
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Card className={`relative overflow-hidden p-2 flex flex-row gap-2 border border-border/50 hover:border-border/80 transition-colors ${className || ""}`} onClick={(e) => e.stopPropagation()}>
                    {sweeping && (
                        <div
                            className={`absolute inset-0 bg-green-500/40 pointer-events-none ${
                                sweeping === "complete"
                                    ? "animate-task-complete-sweep"
                                    : "animate-task-complete-sweep-reverse"
                            }`}
                        />
                    )}
                    <Button onClick={handleToggle} size={"icon"} className="self-center bg-muted h-8 w-8 border-2 border-border">
                        {task.completed ? (
                            <CircleCheckIcon className="w-4 h-4 text-green-500" />
                        ) : (
                            <CircleIcon className="w-4 h-4 text-foreground" />
                        )}
                    </Button>

                    <div className="flex flex-col gap-1 flex-1">

                        <h1 className="font-semibold text-foreground">{task.title}</h1>

                        <div className="flex flex-row">
                            <span className="text-xs text-muted-foreground">{task.to_do_date && formatTaskDate(task.to_do_date)}</span>
                            {task.to_do_date && task.due_date && <span className="text-xs text-muted-foreground text-bold mx-1">|</span>}
                            <span className="text-xs text-muted-foreground">{task.due_date && "Due " + formatTaskDate(task.due_date)}</span>
                        </div>

                        <div className="flex flex-row flex-wrap gap-1">
                            {task.task_list && (
                                <span style={{ backgroundColor: task.task_list.colour, color: getTextColour(task.task_list.colour) }} className="px-2 py-0.5 rounded-full text-xs text-foreground">
                                        {task.task_list.name}
                                </span>
                            )}

                            {task.labels?.map(label => (
                                <span key={label.id} style={{ backgroundColor: label.colour, color: getTextColour(label.colour) }} className="px-2 py-0.5 rounded-full text-xs text-foreground">
                                    {label.name}
                                </span>
                            ))}
                        </div>

                    </div>
                </Card>
            </DialogTrigger>

            <DialogContent className="w-full overflow-hidden border border-border/50 gap-5">
                <DialogHeader className="pb-0">
                    <DialogTitle className="text-lg font-bold">
                        {task.title}
                    </DialogTitle>
                </DialogHeader>

                <DialogDescription className="pt-0">
                    <span className="flex flex-row justify-center gap-2">      
                        <span className="text-sm font-medium text-muted-foreground">{task.to_do_date && formatTaskDate(task.to_do_date)}</span>
                        {task.to_do_date && task.due_date && <span className="text-sm font-medium text-muted-foreground text-bold mx-1">|</span>}
                        <span className="text-sm font-medium text-muted-foreground">{task.due_date && "Due " + formatTaskDate(task.due_date)}</span>
                    </span>
                </DialogDescription>

                <p>{task.description}</p>

                <div className="flex flex-row flex-wrap gap-2">
                    {task.task_list && (
                        <span style={{ backgroundColor: task.task_list.colour, color: getTextColour(task.task_list.colour) }} className="px-2 py-0.5 rounded-full text-sm text-foreground">
                                {task.task_list.name}
                        </span>
                    )}

                    {task.labels?.map(label => (
                        <span key={label.id} style={{ backgroundColor: label.colour, color: getTextColour(label.colour) }} className="px-2 py-0.5 rounded-full text-sm text-foreground">
                            {label.name}
                        </span>
                    ))}
                </div>

                <div className="flex flex-row gap-2 mt-2 justify-center overflow-x-auto flex-wrap scrollbar-none">
                    <Button className="bg-muted text-foreground border-xl" onClick={handleToggle}>
                        {!task.completed ? (
                            <>
                                <CircleIcon className="w-4 h-4 text-foreground" />
                                <p className="text-foreground">Incomplete</p>
                            </>
                        ) : (
                            <>
                                <CircleCheckIcon className="w-4 h-4 text-green-500" />
                                <p className="text-green-500">Complete</p>
                            </>
                        )}
                    </Button>

                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-muted text-foreground border-xl">
                                <EditIcon className="w-4 h-4 text-primary" />
                                <p className="text-primary">Edit</p>
                            </Button>
                        </DialogTrigger>

                        <DialogContent showCloseButton={false}>
                            <EditTask task={task} onClose={() => {
                                setEditOpen(false);
                                refresh();
                            }} />
                        </DialogContent>
                    </Dialog>

                    <Button className="bg-muted text-foreground border-xl" onClick={handleDelete}>
                        <TrashIcon className="w-4 h-4 text-destructive" />
                        <p className="text-destructive">Delete</p>
                    </Button>
                </div>
                

            </DialogContent>
        </Dialog>
    );
}