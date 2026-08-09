import type { Label, TaskList } from "../useTasks";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, X } from "lucide-react";
import { useState } from "react";
import { getTextColour } from "../utils";

interface TaskFilterProps {
    labels: Label[];
    lists: TaskList[];
    selectedLabelId: number | null;
    selectedListId: number | null;
    onLabelSelect: (labelId: number | null) => void;
    onListSelect: (listId: number | null) => void;
}

export default function TaskFilter({
    labels,
    lists,
    selectedLabelId,
    selectedListId,
    onLabelSelect,
    onListSelect,
}: TaskFilterProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setOpen(false)}
            />
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative z-50">
                        <Filter className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 z-50">
                    <div className="grid grid-cols-2 gap-4 p-2">
                        {/* Lists Column */}
                        {lists.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <DropdownMenuLabel className="px-0 py-1 text-xs font-medium text-muted-foreground">
                                    Lists
                                </DropdownMenuLabel>
                                <div className="flex flex-col gap-1">
                                    {lists.map((list) => (
                                        <Button
                                            key={list.id}
                                            className={`justify-start ${
                                                selectedListId === list.id
                                                    ? "ring-1 ring-white"
                                                    : ""
                                            }`}
                                            style={{ backgroundColor: list.colour, color: getTextColour(list.colour) }}
                                            onClick={() =>
                                                onListSelect(selectedListId === list.id ? null : list.id)
                                            }
                                        >
                                            <span className="flex-1 text-left truncate">{list.name}</span>
                                            {selectedListId === list.id && (
                                                <X className="opacity-70" />
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Labels Column */}
                        {labels.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <DropdownMenuLabel className="px-0 py-1 text-xs font-medium text-muted-foreground">
                                    Labels
                                </DropdownMenuLabel>
                                <div className="flex flex-col gap-1">
                                    {labels.map((label) => (
                                        <Button
                                            key={label.id}
                                            className={`justify-start ${
                                                selectedLabelId === label.id
                                                    ? "ring-1 ring-white"
                                                    : ""
                                            }`}
                                            style={{ backgroundColor: label.colour, color: getTextColour(label.colour) }}
                                            onClick={() =>
                                                onLabelSelect(selectedLabelId === label.id ? null : label.id)
                                            }
                                        >
                                            <span className="flex-1 text-left truncate">{label.name}</span>
                                            {selectedLabelId === label.id && (
                                                <X className="opacity-70" />
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
