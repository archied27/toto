import type { PluginManifest } from "../types";
import TasksPage from "./TasksPage";
import { TasksHero, TasksLong, TasksSmall } from "./TasksWidgets";

export default {
    id: 'tasks',
    label: 'Tasks',
    page: TasksPage,
    widgets: {
        hero: TasksHero,
        small: TasksSmall,
        wide: TasksLong
    },
    commandRenderers: {}
} satisfies PluginManifest