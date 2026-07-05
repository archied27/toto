import { type ReactNode } from "react";
import { type DashboardSlot } from "@/hooks/useDashboard";
export interface WidgetSlot {
    id: string;
    component: ReactNode;
}
export declare function resolveSlot(slot: DashboardSlot | null, size: "hero" | "wide" | "small"): WidgetSlot | null;
export default function DashboardPage(): import("react/jsx-runtime").JSX.Element;
