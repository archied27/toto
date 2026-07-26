import TasksPage from "./TasksPage";
import { TasksHero, TasksLong, TasksSmall } from "./TasksWidgets";
declare const _default: {
    id: string;
    label: string;
    page: typeof TasksPage;
    widgets: {
        hero: typeof TasksHero;
        small: typeof TasksSmall;
        wide: typeof TasksLong;
    };
    commandRenderers: {
        today_tasks: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        tomorrow_tasks: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        upcoming_tasks: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        show_tasks: () => undefined;
        show_add_task: () => undefined;
        add_task: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
    };
};
export default _default;
