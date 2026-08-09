import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Filter } from "lucide-react";
import { useState } from "react";

export type MediaType = "all" | "movie" | "tv";

const OPTIONS: { value: MediaType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "movie", label: "Movies" },
    { value: "tv", label: "Shows" },
];

interface MediaFilterProps {
    value: MediaType;
    onChange: (type: MediaType) => void;
}

export default function MediaFilter({ value, onChange }: MediaFilterProps) {
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
                        {value !== "all" && (
                            <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 z-50">
                    <div className="flex flex-col gap-1 p-2">
                        {OPTIONS.map((option) => (
                            <Button
                                key={option.value}
                                variant="ghost"
                                className={`justify-between ${
                                    value === option.value ? "bg-accent" : ""
                                }`}
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <Check className="h-4 w-4" />}
                            </Button>
                        ))}
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
