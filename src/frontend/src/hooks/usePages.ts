import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useWebSocketEvent } from "./useWebSocketEvent";

export interface Page {
    id: string;
}

export function usePages() {
    const [pages, setPages] = useState<Page[]>([]);

    useEffect(() => {
        apiFetch<Page[]>("/pages")
            .then(data => {
                setPages(data);
            })
            .catch(() => {
                console.error("Failed to fetch pages");
            });
    }, []);

    useWebSocketEvent<Page[]>("pages.updated", (newPages) => {
        setPages(newPages);
    });

    return { pages };
}