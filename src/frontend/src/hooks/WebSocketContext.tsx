import { createContext, useContext,  useRef } from "react";
import { useWebSocket, type ConnectionStatus } from "@/hooks/useWebSocket";

export interface WSMessage {
    type: string;
    data: any;
}

export interface WSContextValue {
    connectionStatus: ConnectionStatus;
    send: (message: unknown) => void;
    // Expose standard functions, NOT hooks
    subscribe: (eventType: string, callback: (data: any) => void) => void;
    unsubscribe: (eventType: string, callback: (data: any) => void) => void;
}

const WebSocketContext = createContext<WSContextValue | null>(null);

export function WebSocketProvider({ url, children }: { url: string; children: React.ReactNode }) {
    const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

    // Process packets straight out of the network wire, avoiding React state batching completely
    const handleIncomingPacket = (msg: WSMessage) => {
        if (!msg || !msg.type) return;

        const handlers = handlersRef.current.get(msg.type);

        if (handlers && handlers.size > 0) {
            console.log(`[WS-Stream] Dispatching type ${msg.type} to ${handlers.size} handlers`);
            handlers.forEach((callback) => {
                try {
                    callback(msg.data);
                } catch (err) {
                    console.error(`Error in WebSocket handler for ${msg.type}:`, err);
                }
            });
        } else {
            console.warn(`[WS-Stream] No handlers registered for message type: ${msg.type}`);
        }
    };

    // Instantiate hook with our instantaneous callback
    const { connectionStatus, send } = useWebSocket(url, {
        onMessage: handleIncomingPacket
    });

    const subscribe = (eventType: string, callback: (data: any) => void) => {
        if (!handlersRef.current.has(eventType)) {
            handlersRef.current.set(eventType, new Set());
        }
        handlersRef.current.get(eventType)!.add(callback);
    };

    const unsubscribe = (eventType: string, callback: (data: any) => void) => {
        const handlers = handlersRef.current.get(eventType);
        if (handlers) {
            handlers.delete(callback);
            if (handlers.size === 0) {
                handlersRef.current.delete(eventType);
            }
        }
    };

    return (
        <WebSocketContext.Provider value={{ connectionStatus, send, subscribe, unsubscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
}

// Hook to access the context raw elements
export function useWebSocketContext() {
    const context = useContext(WebSocketContext);
    if (!context) throw new Error("useWebSocketContext must be used within a WebSocketProvider");
    return context;
}