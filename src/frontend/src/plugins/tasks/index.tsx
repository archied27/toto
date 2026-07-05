import { useNavigation } from "@/hooks/NavigationContext";
import type { PluginManifest } from "../types";
import { ShowTasksCommandResult } from "./TaskCommandResults";
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
    commandRenderers: {
        today_tasks: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title="Today's Tasks" emptyMessage="No tasks for today" />);
        },

        tomorrow_tasks: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title="Tomorrow's Tasks" emptyMessage="No tasks for tomorrow" />);
        },

        show_tasks: () => {
            const { navigate } = useNavigation();
            navigate("tasks");
        }
    }
} satisfies PluginManifest