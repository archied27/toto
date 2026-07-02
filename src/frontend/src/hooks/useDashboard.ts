import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useWebSocketEvent } from "./useWebSocketEvent";

export interface DashboardSlot {
    id: string;
}

export interface DashboardState {
    hero: DashboardSlot | null;
    long: DashboardSlot | null;
    small_a: DashboardSlot | null;
    small_b: DashboardSlot | null;
}

export function useDashboard() {
    const [slots, setSlots] = useState<DashboardState>({
        hero: null,
        long: null,
        small_a: null,
        small_b: null
    });

    useEffect(() => {
        apiFetch<DashboardState>("/dashboard")
            .then(data => {
                setSlots(data);
            })
            .catch(() => {
                console.error("Failed to fetch dashboard widgets");
            });
    }, []);

    useWebSocketEvent<DashboardState>("dashboard.changed", (newSlots) => {
        setSlots(newSlots);
    });

    return { slots };
}