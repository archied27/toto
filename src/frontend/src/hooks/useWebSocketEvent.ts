import { useEffect, useRef } from "react";
import { useWebSocketContext } from "./WebSocketContext";

export function useWebSocketEvent<T = any>(eventType: string, callback: (data: T) => void) {
    const { subscribe, unsubscribe } = useWebSocketContext();
    
    // Use a ref for the callback to prevent unnecessary resubscriptions 
    // if the user passes an inline anonymous function
    const callbackRef = useRef(callback);
    
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        // Create a stable wrapper function that executes the latest callback ref
        const handler = (data: T) => callbackRef.current(data);

        subscribe(eventType, handler);
        
        return () => {
            unsubscribe(eventType, handler);
        };
    }, [eventType, subscribe, unsubscribe]);
}