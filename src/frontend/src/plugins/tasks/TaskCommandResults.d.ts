import { type Task } from "./useTasks";
export declare function ShowTasksCommandResult({ data, title, emptyMessage }: {
    data: {
        tasks: Task[];
    };
    title: string;
    emptyMessage: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function NewTaskCreated({ data }: {
    data: {
        task: Task;
    };
}): import("react/jsx-runtime").JSX.Element;
