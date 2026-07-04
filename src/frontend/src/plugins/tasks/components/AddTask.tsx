import { Card } from "@/components/ui/card";
import { useAddTask, useGetTaskLabels, useGetTaskLists } from "../useTasks";
import { CheckIcon, ScrollTextIcon, TagIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AddLabelList from "./AddLabelList";
import LabelListButton from "./LabelListButton";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export default function AddTask({ onClose }: { onClose?: () => void }) {
    const lists = useGetTaskLists();
    const labels = useGetTaskLabels();
    const { addTask, loading } = useAddTask();

    const [name, setName] = useState<string>("");
    const [description, setDescription] = useState<string | null>(null);
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [toDoDate, setToDoDate] = useState<string | null>(null);
    const [selectedList, setSelectedList] = useState<number | null>(null);
    const [selectedLabels, setSelectedLabels] = useState<number[]>([]);

    const onSubmit = async () => {
        if (!name.trim()) return;
        await addTask(name, description, dueDate, toDoDate, selectedList, selectedLabels);
        onClose?.();
    }

    return (
        <Card className="w-full max-w-md overflow-hidden border border-border/50">
            <div className="flex items-center justify-between px-5">
                <XIcon className="h-5 w-5" onClick={onClose} />
                <h2 className="text-base font-semibold text-foreground">Add Task</h2>
                <CheckIcon className={`h-5 w-5 ${!name.trim() || loading ? 'text-muted-foreground' : 'text-primary'}`} onClick={onSubmit} />
            </div>
            
            <div className="px-3 flex flex-col gap-3 w-full">
                <Input placeholder="What needs doing?" value={name} onChange={(e) => setName(e.target.value)} />
                <Textarea placeholder="Description" value={description || ''} className="h-[100px]" onChange={(e) => setDescription(e.target.value)} />
                <div>
                    <DatePicker placeholder="Do it when?" value={toDoDate} onChange={setToDoDate} />
                </div>
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