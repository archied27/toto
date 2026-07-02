import { type Task } from "../useTasks";
export default function TaskList({ tasks, refresh, title }: {
    tasks: Task[];
    refresh: () => void;
    title: string;
}): import("react/jsx-runtime").JSX.Element;
