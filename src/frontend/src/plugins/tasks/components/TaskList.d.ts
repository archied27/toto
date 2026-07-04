import { type Task } from "../useTasks";
export default function TaskList({ tasks, refresh, title, titleClassName, cardClassName }: {
    tasks: Task[];
    refresh: () => void;
    title: string;
    titleClassName?: string;
    cardClassName?: string;
}): import("react/jsx-runtime").JSX.Element;
