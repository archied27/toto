import { useNavigation } from "@/hooks/NavigationContext";
import type { PluginManifest } from "../types";
import { ListChecksIcon } from "lucide-react";
import { NewTaskCreated, ShowTasksCommandResult } from "./TaskCommandResults";
import TasksPage from "./TasksPage";
import { TasksHero, TasksLong, TasksSmall } from "./TasksWidgets";

export default {
    id: 'tasks',
    label: 'Tasks',
    icon: ListChecksIcon,
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
        },

        tasks_on_date: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title={`Tasks on ${data.date}`} emptyMessage="No tasks on this date" />);
        },

        tasks_in_date_range: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title={`Tasks ${data.start_date} to ${data.end_date}`} emptyMessage="No tasks in this range" />);
        },

        overdue_tasks: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title="Overdue Tasks" emptyMessage="No overdue tasks" />);
        },

        tasks_by_list: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title={data.list.name} emptyMessage="No tasks in this list" />);
        },

        tasks_by_label: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title={data.label.name} emptyMessage="No tasks with this label" />);
        },

        get_completed_tasks: ({ data }) => {
            return (<ShowTasksCommandResult data={data} title={`Completed on ${data.date}`} emptyMessage="No tasks completed on this date" />);
        }
    }
} satisfies PluginManifest