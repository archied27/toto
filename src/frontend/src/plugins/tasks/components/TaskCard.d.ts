import { type Task } from "../useTasks";
export declare function formatTaskDate(isoString: string): string;
export default function TaskCard({ task, refresh, className }: {
    task: Task;
    refresh: () => void;
    className?: string;
}): import("react/jsx-runtime").JSX.Element;
