import { apiFetch } from "@/hooks/api";
import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";
import { useCallback, useEffect, useState } from "react";

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
    date_completed?: string;
    labels?: Label[];
    task_list?: TaskList;
}

export interface TaskState {
    overdue_tasks: Task[];
    today_tasks: Task[];
    tasks_due_today: Task[];
}

export function useTaskState() {
    const [taskState, setTaskState] = useState<TaskState | null>(null);

    const getTasks = useCallback(() => {
        apiFetch<TaskState>("/tasks/state")
            .then(data => {
                setTaskState(data);
            })
            .catch(() => {
                console.error("Failed to fetch task state");
            });
    }, [])

    useEffect(() => {
        getTasks();
    }, []);

    useWebSocketEvent<TaskState>("tasks.state_updated", (newState) => {
        setTaskState(newState);
    });

    return { taskState, getTasks };
}

export function useGetTaskLists() {
    const [taskLists, setTaskLists] = useState<TaskList[]>([]);

    const fetchLists = useCallback(() => {
        apiFetch<TaskList[]>("/tasks/get_lists")
            .then(data => setTaskLists(data))
            .catch(() => console.error("Failed to fetch task lists"));
    }, []);

    useEffect(() => { fetchLists(); }, [fetchLists]);

    return { taskLists, refetch: fetchLists };
}

export function useGetTaskLabels() {
    const [taskLabels, setTaskLabels] = useState<Label[]>([]);

    const fetchLabels = useCallback(() => {
        apiFetch<Label[]>("/tasks/get_labels")
            .then(data => setTaskLabels(data))
            .catch(() => console.error("Failed to fetch task labels"));
    }, []);

    useEffect(() => { fetchLabels(); }, [fetchLabels]);

    return { taskLabels, refetch: fetchLabels };
}

export function useAddList() {
    const [loading, setLoading] = useState(false);

    const addList = useCallback(async (name: string, colour: string) => {
        setLoading(true);
        try {
            await apiFetch("/tasks/add_list", {
                method: "POST",
                body: JSON.stringify({ name, colour }),
            });
        } catch (error) {
            console.error("Failed to add task list", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { addList, loading };
}

export function useAddLabel() {
    const [loading, setLoading] = useState(false);

    const addLabel = useCallback(async (name: string, colour: string) => {
        setLoading(true);
        try {
            await apiFetch("/tasks/add_label", {
                method: "POST",
                body: JSON.stringify({ name, colour }),
            });
        } catch (error) {
            console.error("Failed to add task label", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { addLabel, loading };
}

export function useDeleteList() {
    const [loading, setLoading] = useState(false);

    const deleteList = useCallback(async (id: number) => {
        setLoading(true);
        try {
            await apiFetch(`/tasks/delete_list/${id}`, {
                method: "DELETE"
            });
        } catch (error) {
            console.error("Failed to delete list", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteList, loading };
}


export function useDeleteLabel() {
    const [loading, setLoading] = useState(false);

    const deleteLabel = useCallback(async (id: number) => {
        setLoading(true);
        try {
            await apiFetch(`/tasks/delete_label/${id}`, {
                method: "DELETE"
            });
        } catch (error) {
            console.error("Failed to delete label", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteLabel, loading };
}

export function useEditList() {
    const [loading, setLoading] = useState(false);

    const editList = useCallback(async (id: number, name: string, colour: string) => {
        setLoading(true);
        console.log(`Editing list with id: ${id}, name: ${name}, colour: ${colour}`);
        try {
            await apiFetch(`/tasks/edit_list`, {
                method: "PUT",
                body: JSON.stringify({ id, name, colour }),
            });
        } catch (error) {
            console.error("Failed to edit list", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { editList, loading };
}

export function useEditLabel() {
    const [loading, setLoading] = useState(false);

    const editLabel = useCallback(async (id: number, name: string, colour: string) => {
        setLoading(true);
        try {
            await apiFetch(`/tasks/edit_label`, {
                method: "PUT",
                body: JSON.stringify({ id, name, colour }),
            });
        } catch (error) {
            console.error("Failed to edit label", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { editLabel, loading };
}

export function useAddTask() {
    const [loading, setLoading] = useState(false);

    const addTask = useCallback(async (title: string, description: string | null, due_date: string | null, to_do_date: string | null, list_id: number | null, label_ids: number[] | null) => {
        setLoading(true);
        try {
            await apiFetch("/tasks/add_task", {
                method: "POST",
                body: JSON.stringify({ title, description, due_date, to_do_date, list_id, label_ids }),
            });
        } catch (error) {
            console.error("Failed to add task", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { addTask, loading };
}

export function useGetAllTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = useCallback(() => {
        apiFetch<Task[]>("/tasks/get_all_tasks")
            .then(data => setTasks(data))
            .catch(() => console.error("Failed to fetch tasks"));
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    return { tasks, refetch: fetchTasks };
}

export function useGetLabelTasks(labelId: number | null) {
    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = useCallback(() => {
        if (labelId === null) {
            setTasks([]);
            return;
        }
        apiFetch<Task[]>(`/tasks/get_label_tasks/${labelId}`)
            .then(data => setTasks(data))
            .catch(() => console.error("Failed to fetch label tasks"));
    }, [labelId]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    return { tasks, refetch: fetchTasks };
}

export function useGetListTasks(listId: number | null) {
    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = useCallback(() => {
        if (listId === null) {
            setTasks([]);
            return;
        }
        apiFetch<Task[]>(`/tasks/get_list_tasks/${listId}`)
            .then(data => setTasks(data))
            .catch(() => console.error("Failed to fetch list tasks"));
    }, [listId]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    return { tasks, refetch: fetchTasks };
}

export function useGetTomorrowTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = useCallback(() => {
        apiFetch<Task[]>("/tasks/get_tomorrow_tasks")
            .then(data => setTasks(data))
            .catch(() => console.error("Failed to fetch tomorrow's tasks"));
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    return { tasks, refetch: fetchTasks };
}

export function useGetUpcomingTasks() {
    const [tasks, setTasks] = useState<Task[]>([]);

    const fetchTasks = useCallback(() => {
        apiFetch<Task[]>("/tasks/get_upcoming_tasks")
            .then(data => setTasks(data))
            .catch(() => console.error("Failed to fetch upcoming tasks"));
    }, []);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    return { tasks, refetch: fetchTasks };
}

export function useToggleTaskCompletion() {
    const [loading, setLoading] = useState(false);

    const toggleCompletion = useCallback(async (taskId: number) => {
        setLoading(true);
        try {
            await apiFetch(`/tasks/toggle_task_completion/${taskId}`, {
                method: "PUT",
            });
        } catch (error) {
            console.error("Failed to toggle task completion", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { toggleCompletion, loading };
}

export function useDeleteTask() {
    const [loading, setLoading] = useState(false);

    const deleteTask = useCallback(async (taskId: number) => {
        setLoading(true);
        try {
            await apiFetch(`/tasks/delete_task/${taskId}`, {
                method: "DELETE",
            });
        } catch (error) {
            console.error("Failed to delete task", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteTask, loading };
}

export function useEditTask() {
    const [loading, setLoading] = useState(false);

    const editTask = useCallback(async (id: number, title: string, description: string | null, due_date: string | null, to_do_date: string | null, list_id: number | null, label_ids: number[] | null) => {
        setLoading(true);
        try {
            await apiFetch(`/tasks/update_task?id=${id}`, {
                method: "PUT",
                body: JSON.stringify({ title, description, due_date, to_do_date, list_id, label_ids }),
            });
        } catch (error) {
            console.error("Failed to edit task", error);
        } finally {
            setLoading(false);
        }
    }, []);

    return { editTask, loading };
}