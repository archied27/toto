export interface DashboardSlot {
    id: string;
}
export interface DashboardState {
    hero: DashboardSlot | null;
    long: DashboardSlot | null;
    small_a: DashboardSlot | null;
    small_b: DashboardSlot | null;
}
export declare function useDashboard(): {
    slots: DashboardState;
};
