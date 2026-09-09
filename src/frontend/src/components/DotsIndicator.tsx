"use client";

import { useRef } from "react";

type DotsIndicatorProps = {
    currentIndex: number;
    total: number;
    onClick?: () => void;       // tap -> command bar
    onSwipeUp?: () => void;     // swipe up -> agent tools panel
    isCommandBar?: boolean;
};

const SWIPE_UP_THRESHOLD = 40;   // px of upward movement to count as a swipe
const TAP_MOVE_THRESHOLD = 10;   // px — under this, it's a tap not a drag
const TAP_TIME_THRESHOLD = 300;  // ms — under this, it's a tap not a hold

export default function DotsIndicator({
    currentIndex,
    total,
    onClick,
    onSwipeUp,
    isCommandBar,
}: DotsIndicatorProps) {
    const startY = useRef<number | null>(null);
    const startTime = useRef(0);
    const swiped = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        startTime.current = Date.now();
        swiped.current = false;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY.current === null) return;
        const deltaY = e.touches[0].clientY - startY.current;
        if (deltaY < -SWIPE_UP_THRESHOLD) {
            swiped.current = true;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (startY.current === null) return;
        const deltaY = e.changedTouches[0].clientY - startY.current;
        const deltaTime = Date.now() - startTime.current;

        if (swiped.current || deltaY < -SWIPE_UP_THRESHOLD) {
            onSwipeUp?.();
        } else if (Math.abs(deltaY) < TAP_MOVE_THRESHOLD && deltaTime < TAP_TIME_THRESHOLD) {
            onClick?.();
        }

        // Stop the browser from also firing a synthetic "click" after this touch,
        // which would double-trigger the command bar.
        e.preventDefault();
        startY.current = null;
    };

    return (
        <div
            className={[
                "fixed left-1/2 -translate-x-1/2 z-50",
                "bottom-10",
            ].join(" ")}
        >
            <button
                type="button"
                onClick={onClick} // still works for mouse/desktop clicks
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-background/60 backdrop-blur-md border border-border shadow-sm transition-all duration-500 ease-in-out"
                {...{
                    style: {
                        height: '2rem',
                        padding: isCommandBar ? '0 0.625rem' : '0 0.75rem',
                        gap: isCommandBar ? '0' : '6px',
                        touchAction: 'none',
                    },
                }}
            >
                {isCommandBar ? (
                    <div>
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                            className="text-foreground/70"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                        >
                            <line x1="2" y1="2" x2="12" y2="12" />
                            <line x1="12" y1="2" x2="2" y2="12" />
                        </svg>
                    </div>
                ) : (
                    Array.from({ length: total }).map((_, i) => (
                        <div
                            key={i}
                            className={[
                                "w-2 h-2 rounded-full transition-all duration-200",
                                i === currentIndex
                                    ? "bg-primary w-4"
                                    : "bg-muted-foreground/60 w-1",
                            ].join(" ")}
                        />
                    ))
                )}
            </button>
        </div>
    );
}