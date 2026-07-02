export interface Label {
    id: number;
    name: string;
    colour: string;
}
export interface TaskList {
    id: number;
    name: string;
    colour: string;
}
export interface Task {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
    to_do_date?: string;
    completed: boolean;
    labels?: Label[];
    task_list?: TaskList;
}
export interface TaskState {
    overdue_tasks: Task[];
    today_tasks: Task[];
    tasks_due_today: Task[];
}
export declare function useTaskState(): {
    taskState: TaskState | null;
    getTasks: () => void;
};
export declare function useGetTaskLists(): {
    taskLists: TaskList[];
    refetch: () => void;
};
export declare function useGetTaskLabels(): {
    taskLabels: Label[];
    refetch: () => void;
};
export declare function useAddList(): {
    addList: (name: string, colour: string) => Promise<void>;
    loading: boolean;
};
export declare function useAddLabel(): {
    addLabel: (name: string, colour: string) => Promise<void>;
    loading: boolean;
};
export declare function useDeleteList(): {
    deleteList: (id: number) => Promise<void>;
    loading: boolean;
};
export declare function useDeleteLabel(): {
    deleteLabel: (id: number) => Promise<void>;
    loading: boolean;
};
export declare function useEditList(): {
    editList: (id: number, name: string, colour: string) => Promise<void>;
    loading: boolean;
};
export declare function useEditLabel(): {
    editLabel: (id: number, name: string, colour: string) => Promise<void>;
    loading: boolean;
};
export declare function useAddTask(): {
    addTask: (title: string, description: string | null, due_date: string | null, to_do_date: string | null, list_id: number | null, label_ids: number[] | null) => Promise<void>;
    loading: boolean;
};
export declare function useGetAllTasks(): {
    tasks: Task[];
    refetch: () => void;
};
export declare function useGetTomorrowTasks(): {
    tasks: Task[];
    refetch: () => void;
};
export declare function useGetUpcomingTasks(): {
    tasks: Task[];
    refetch: () => void;
};
export declare function useToggleTaskCompletion(): {
    toggleCompletion: (taskId: number) => Promise<void>;
    loading: boolean;
};
export declare function useDeleteTask(): {
    deleteTask: (taskId: number) => Promise<void>;
    loading: boolean;
};
export declare function useEditTask(): {
    editTask: (id: number, title: string, description: string | null, due_date: string | null, to_do_date: string | null, list_id: number | null, label_ids: number[] | null) => Promise<void>;
    loading: boolean;
};
