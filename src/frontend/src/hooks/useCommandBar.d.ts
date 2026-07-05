export interface CommandResult {
    success: boolean;
    action: string;
    response: string;
    data: Record<string, any>;
}
export declare function useCommandBar(): {
    result: CommandResult | null;
    loading: boolean;
    execute: (input: string) => Promise<void>;
    clear: () => void;
};
