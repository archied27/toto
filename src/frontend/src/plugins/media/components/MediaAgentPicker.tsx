import { useEffect, useState } from "react";
import { Monitor, LoaderCircle, TriangleAlert } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export interface MediaAgent {
    device_id: string;
    display_name?: string | null;
    media_capability?: { display_name?: string; features?: string[] } | null;
    capabilities: { name: string }[];
}

interface AgentsResponse {
    agents: MediaAgent[];
}

export function MediaAgentPicker({
    open,
    onOpenChange,
    onSelect,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (agent: MediaAgent) => void;
}) {
    const [agents, setAgents] = useState<MediaAgent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        apiFetch<AgentsResponse>("/agents")
            .then((response) => {
                if (cancelled) return;
                setAgents(response.agents.filter((agent) =>
                    Boolean(agent.media_capability) &&
                    agent.capabilities.some((capability) => capability.name === "open_url")
                ));
            })
            .catch(() => {
                if (!cancelled) setError("Could not load connected media devices.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Choose where to stream</DialogTitle>
                    <DialogDescription>
                        Select a connected device that can open the stream in its browser.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Finding connected devices...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 text-destructive">
                        <TriangleAlert className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && agents.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No connected device can stream this way.
                    </p>
                )}

                {!loading && !error && agents.length > 0 && (
                    <div className="grid gap-2">
                        {agents.map((agent) => (
                            <Button
                                key={agent.device_id}
                                type="button"
                                variant="outline"
                                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                                onClick={() => onSelect(agent)}
                            >
                                <Monitor className="h-5 w-5 shrink-0" />
                                <span className="min-w-0">
                                    <span className="block truncate font-medium">
                                        {agent.display_name || agent.media_capability?.display_name || agent.device_id}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {agent.device_id}
                                    </span>
                                </span>
                            </Button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}