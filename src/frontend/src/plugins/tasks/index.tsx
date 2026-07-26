import { useNavigation } from "@/hooks/NavigationContext";
import type { PluginManifest } from "../types";
import { NewTaskCreated, ShowTasksCommandResult } from "./TaskCommandResults";
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

        upcoming_tasks: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title="Upcoming Tasks" emptyMessage="No upcoming tasks" />);
        },

        show_tasks: () => {
            const { navigate } = useNavigation();
            navigate("tasks");
        },

        show_add_task: () => {
            const { navigate } = useNavigation();
            navigate("tasks", { addTask: true });
        },

        add_task: ({ data }) => {
            return (<NewTaskCreated data={data} />);
        }
    }
} satisfies PluginManifest