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
        show_tasks: () => undefined;
    };
} | {
    id: string;
    label: string;
    page: typeof import("./weather/WeatherPage").default;
    widgets: {
        hero: null;
        small: null;
        wide: null;
    };
    commandRenderers: {
        show_pollen: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
        show_weather: () => undefined;
        show_current_weather: ({ data }: {
            data: any;
        }) => import("react/jsx-runtime").JSX.Element;
    };
})[];
