import { useState, useRef, useEffect, useCallback } from "react";

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
    reconnect: () => void; // manually trigger reconnect and reset retry counter
}

export function useWebSocket(
    url: string,
    {
        onMessage,
        maxRetries = 6,
        baseDelay = 500,
        maxDelay=30_000,
    } : UseWebSocketOptions = {}
): UseWebSocketReturn {
    // states
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
    const [lastMessage, setLastMessage] = useState<unknown>(null);

    // refs
    const wsRef = useRef<WebSocket | null>(null);
    const retryCountRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shouldReconnectRef = useRef(true);

    // exponential backoff delay with +-10% jitter
    const getBackoffDelay = (attempt: number): number => {
        const exponential = Math.min(baseDelay * 2 ** attempt, maxDelay);
        const jitter = exponential * 0.1 * (Math.random() * 2 - 1);
        return Math.round(exponential + jitter);
    };

    const connect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }

        setConnectionStatus("connecting");

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[WS] Connected");
            setConnectionStatus("connected");
            retryCountRef.current = 0;
        };

        ws.onmessage = (event: MessageEvent) => {
            let parsed: unknown;
            try {
                console.log("[WS] Received message:", event.data);
                parsed = JSON.parse(event.data as string);
            } catch {
                console.warn("[WS] Received non-JSON message:", event.data);
                parsed = event.data;
            }

            setLastMessage(parsed);
            onMessage?.(parsed);
        }

        ws.onclose = () => {
            console.warn("[WS] Connection closed");
            setConnectionStatus("disconnected");

            if(!shouldReconnectRef.current) return;

            // cannot conenect
            if(retryCountRef.current > maxRetries)
            {
                setConnectionStatus("error");
                return;
            }

            const delay = getBackoffDelay(retryCountRef.current);

            retryTimerRef.current = setTimeout(() => {
                retryCountRef.current += 1;
                connect();
            }, delay)
        }

        ws.onerror = () => {
            setConnectionStatus("error")
        }
    }, [url, maxRetries, baseDelay, maxDelay])

    // connect to ws on mount
    useEffect(() => {
        shouldReconnectRef.current = true;
        connect();

        return () => {
            shouldReconnectRef.current = false;

            if(retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
            }

            wsRef.current?.close();
        };
    }, [connect])

    const send = useCallback((message: unknown) => {
        if(wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn("[WS] send called but socket not open")
        }
    }, []);

    const reconnect = useCallback(() => {
        shouldReconnectRef.current = true;
        retryCountRef.current = 0;

        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
        }

        connect();
    }, [connect])

    return { connectionStatus, lastMessage, send, reconnect };
}