export declare const plugins: ({
    id: string;
    label: string;
    page: typeof import("./tasks/TasksPage").default;
    widgets: {
        hero: typeof import("./tasks/TasksWidgets").TasksHero;
        small: typeof import("./tasks/TasksWidgets").TasksSmall;
        wide: typeof import("./tasks/TasksWidgets").TasksLong;
    };
    commandRenderers: {
        today_tasks: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        tomorrow_tasks: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        upcoming_tasks: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        show_tasks: () => undefined;
        show_add_task: () => undefined;
        add_task: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
    };
} | {
    id: string;
    label: string;
    page: typeof import("./media/MediaPage").MediaPage;
    widgets: {
        hero: null;
        small: null;
        wide: null;
    };
    commandRenderers: {};
})[];
