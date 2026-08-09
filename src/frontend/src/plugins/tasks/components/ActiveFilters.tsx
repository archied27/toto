import type { Label, TaskList } from "../useTasks";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getTextColour } from "../utils";

interface ActiveFiltersProps {
    labels: Label[];
    lists: TaskList[];
    onLabelRemove: (id: number) => void;
    onListRemove: (id: number) => void;
}

export default function ActiveFilters({
    labels,
    lists,
    onLabelRemove,
    onListRemove,
}: ActiveFiltersProps) {
    if (labels.length === 0 && lists.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {lists.map((list) => (
                <Button
                    key={list.id}
                    onClick={() => onListRemove(list.id)}
                    style={{ backgroundColor: list.colour, color: getTextColour(list.colour) }}
                >
                    <span>{list.name}</span>
                    <X className="opacity-70 group-hover/button:opacity-100" />
                </Button>
            ))}
            {labels.map((label) => (
                <Button
                    key={label.id}
                    onClick={() => onLabelRemove(label.id)}
                    style={{ backgroundColor: label.colour, color: getTextColour(label.colour) }}
                >
                    <span>{label.name}</span>
                    <X className="opacity-70 group-hover/button:opacity-100" />
                </Button>
            ))}
        </div>
    );
}
