import { CalendarDays } from "lucide-react";
import type { PluginManifest } from "../types";
import CalendarPage, { CalendarHero, CalendarLong, CalendarSmall } from "./CalendarPage";

export default {
    id: "calendar",
    label: "Calendar",
    icon: CalendarDays,
    page: CalendarPage,
    widgets: {
        hero: CalendarHero,
        small: CalendarSmall,
        wide: CalendarLong,
        companion: CalendarSmall,
    },
    commandRenderers: {
        show_calendar: () => null,
    },
} satisfies PluginManifest;