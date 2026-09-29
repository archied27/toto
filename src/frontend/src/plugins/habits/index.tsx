import { CalendarCheck2 } from "lucide-react";
import { useEffect } from "react";
import type { PluginManifest } from "../types";
import { useNavigation } from "@/hooks/NavigationContext";
import HabitsPage, { HabitsHero, HabitsLong, HabitsSmall } from "./HabitsPage";

function ShowHabitsCommandResult() {
    const { navigate } = useNavigation();
    useEffect(() => {
        navigate("habits");
    }, [navigate]);
    return null;
}

export default {
    id: "habits",
    label: "Habits",
    icon: CalendarCheck2,
    page: HabitsPage,
    widgets: {
        hero: HabitsHero,
        small: HabitsSmall,
        wide: HabitsLong,
    },
    commandRenderers: {
        show_habits: ShowHabitsCommandResult,
    },
} satisfies PluginManifest;