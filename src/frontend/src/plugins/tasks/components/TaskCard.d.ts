import { type Task } from "../useTasks";
export declare function formatTaskDate(isoString: string): string;
export default function TaskCard({ task, refresh }: {
    task: Task;
    refresh: () => void;
}): import("react/jsx-runtime").JSX.Element;
