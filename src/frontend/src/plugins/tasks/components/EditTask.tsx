import { Card } from "@/components/ui/card";
import { useEditTask, useGetTaskLabels, useGetTaskLists, type Task } from "../useTasks";
import { CheckIcon, ScrollTextIcon, TagIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AddLabelList from "./AddLabelList";
import LabelListButton from "./LabelListButton";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export default function EditTask({ onClose, task }: { onClose?: () => void; task: Task }) {
    const lists = useGetTaskLists();
    const labels = useGetTaskLabels();
    const { editTask, loading } = useEditTask();

    const [name, setName] = useState<string>(task.title);
    const [description, setDescription] = useState<string | null>(task.description || null);
    const [dueDate, setDueDate] = useState<string | null>(task.due_date || null);
    const [toDoDate, setToDoDate] = useState<string | null>(task.to_do_date || null);
    const [selectedList, setSelectedList] = useState<number | null>(task.task_list?.id || null);
    const [selectedLabels, setSelectedLabels] = useState<number[]>(task?.labels?.map((label) => label.id) || []);

    const onSubmit = async () => {
        if (!name.trim()) return;
        await editTask(task.id, name, description, dueDate, toDoDate, selectedList, selectedLabels);
        onClose?.();
    }

    return (
        <Card className="w-full max-w-md overflow-hidden border border-border/50">
            <div className="flex items-center justify-between px-5">
                <XIcon className="h-5 w-5" onClick={onClose} />
                <h2 className="text-base font-semibold text-foreground">Edit Task</h2>
                <CheckIcon className={`h-5 w-5 ${!name.trim() || loading ? 'text-muted-foreground' : 'text-primary'}`} onClick={onSubmit} />
            </div>
            
            <div className="px-3 flex flex-col gap-3 w-full">
                <Input placeholder="What needs doing?" value={name} onChange={(e) => setName(e.target.value)} />
                <Textarea placeholder="Description" value={description || ''}  className="h-[100px]" onChange={(e) => setDescription(e.target.value)} />
                <DatePicker placeholder="Do it when?" value={toDoDate} onChange={setToDoDate} />
                <DatePicker placeholder="When is it due?" value={dueDate} onChange={setDueDate} />

                <div className="flex justify-center gap-3 w-full">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"}>
                                <ScrollTextIcon className="text-muted-foreground" />
                                <p className="text-muted-foreground">List</p>
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent className="border opacity-90 p-1 gap-1 flex flex-row flex-wrap w-auto max-w-55">
                            {lists.taskLists.map((tList) => (
                                <LabelListButton item={tList} type="list" key={tList.id} refetch={lists.refetch} selected={selectedList === tList.id} onToggle={() => {
                                    setSelectedList(prev => prev === tList.id ? null : tList.id);
                                }} />
                            ))}

                            <AddLabelList type="List" onAdd={lists.refetch} />
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"}>
                                <TagIcon className="text-muted-foreground" />
                                <p className="text-muted-foreground">Label</p>
                            </Button>
                        </PopoverTrigger>

                        <PopoverContent className="border opacity-90 p-1 gap-1 flex flex-row flex-wrap w-auto max-w-55">
                            {labels.taskLabels.map((tLabels) => (
                                <LabelListButton item={tLabels} type="label" key={tLabels.id} refetch={labels.refetch} selected={selectedLabels.includes(tLabels.id)} onToggle={() => {
                                    setSelectedLabels(prev => prev.includes(tLabels.id) ? prev.filter(id => id !== tLabels.id) : [...prev, tLabels.id]);
                                }} />
                            ))}

                            <AddLabelList type="Label"
                            onAdd={labels.refetch} />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </Card>
    );
}