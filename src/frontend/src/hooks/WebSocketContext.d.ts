import { type ConnectionStatus } from "@/hooks/useWebSocket";
export interface WSMessage {
    type: string;
    data: any;
}
export interface WSContextValue {
    connectionStatus: ConnectionStatus;
    send: (message: unknown) => void;
    subscribe: (eventType: string, callback: (data: any) => void) => void;
    unsubscribe: (eventType: string, callback: (data: any) => void) => void;
}
export declare function WebSocketProvider({ url, children }: {
    url: string;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useWebSocketContext(): WSContextValue;
