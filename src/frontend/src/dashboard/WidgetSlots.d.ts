import { type ReactNode } from "react";
interface WidgetSlot {
    id: string;
    component: ReactNode;
}
interface WidgetSlotsProps {
    widgets: (WidgetSlot | null)[];
}
export default function WidgetSlots({ widgets }: WidgetSlotsProps): import("react/jsx-runtime").JSX.Element | null;
export {};
