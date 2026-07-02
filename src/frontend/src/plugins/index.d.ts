export declare const plugins: ({
    id: string;
    label: string;
    page: typeof import("./tasks/TasksPage").default;
    widgets: {
        hero: typeof import("./tasks/TasksWidgets").TasksHero;
        small: null;
        wide: null;
    };
    commandRenderers: {};
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
