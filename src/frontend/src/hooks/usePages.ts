import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { useWebSocketEvent } from "./useWebSocketEvent";

export interface Page {
    id: string;
    priority: number;
}

interface PagesResponse {
    pages: Page[];
}

const DASHBOARD_PAGE: Page = { id: "dashboard", priority: Infinity };

function withDashboard(pages: Page[]): Page[] {
    return [DASHBOARD_PAGE, ...pages.filter(p => p.id !== "dashboard")];
}

export function usePages() {
    const [pages, setPages] = useState<Page[]>([DASHBOARD_PAGE]);

    useEffect(() => {
        apiFetch<PagesResponse>("/pages")
            .then(data => {
                setPages(withDashboard(data.pages));
            })
            .catch(() => {
                console.error("Failed to fetch pages");
            });
    }, []);

    useWebSocketEvent<Page[]>("pages.changed", (newPages) => {
        setPages(withDashboard(newPages));
    });

    return { pages };
}