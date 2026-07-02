import type { PluginManifest } from "../types";
import TasksPage from "./TasksPage";
import { TasksHero } from "./TasksWidgets";

export default {
    id: 'tasks',
    label: 'Tasks',
    page: TasksPage,
    widgets: {
        hero: TasksHero,
        small: null,
        wide: null
    },
    commandRenderers: {}
} satisfies PluginManifest