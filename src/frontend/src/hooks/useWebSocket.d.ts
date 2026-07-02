export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
export interface UseWebSocketOptions {
    onMessage?: (data: any) => (void);
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
}
export interface UseWebSocketReturn {
    connectionStatus: ConnectionStatus;
    lastMessage: unknown;
    send: (message: unknown) => void;
    reconnect: () => void;
}
export declare function useWebSocket(url: string, { onMessage, maxRetries, baseDelay, maxDelay, }?: UseWebSocketOptions): UseWebSocketReturn;
