import { useEffect, useState } from "react";
import { apiFetch } from "@/hooks/api";
import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";

export interface CalendarVisibility {
    visible_source_ids: number[];
}

export function useCalendarVisibility() {
    const [visibleSourceIds, setVisibleSourceIds] = useState<number[] | null>(null);

    async function loadVisibility() {
        try {
            const preferences = await apiFetch<CalendarVisibility>("/calendar/visibility");
            setVisibleSourceIds(preferences.visible_source_ids);
        } catch {
            setVisibleSourceIds(null);
        }
    }

    useEffect(() => { void loadVisibility(); }, []);
    useWebSocketEvent("calendar.state_updated", () => { void loadVisibility(); });

    async function toggleSource(sourceId: number, allSourceIds: number[]) {
        const current = new Set(visibleSourceIds ?? allSourceIds);
        if (current.has(sourceId)) current.delete(sourceId);
        else current.add(sourceId);
        const next = [...current];
        setVisibleSourceIds(next);
        try {
            await apiFetch<CalendarVisibility>("/calendar/visibility", { method: "PUT", body: JSON.stringify({ visible_source_ids: next }) });
        } catch {
            await loadVisibility();
        }
    }

    function isVisible(sourceId: number, allSourceIds: number[]) {
        return (visibleSourceIds ?? allSourceIds).includes(sourceId);
    }

    return { visibleSourceIds, isVisible, toggleSource };
}