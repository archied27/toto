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
    commandRenderers: {};
};
export default _default;
