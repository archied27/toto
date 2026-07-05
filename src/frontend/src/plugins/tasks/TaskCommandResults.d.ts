import type { Task } from "./useTasks";
export declare function ShowTasksCommandResult({ data, title, emptyMessage }: {
    data: {
        tasks: Task[];
    };
    title: string;
    emptyMessage: string;
}): import("react/jsx-runtime").JSX.Element;
