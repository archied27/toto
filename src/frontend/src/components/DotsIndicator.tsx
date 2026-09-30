"use client";

import { useRef, useMemo } from "react";

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

    // Calculate which dots to show with indicator dots for more pages
    const visibleDots = useMemo(() => {
        if (total <= 3) {
            // Show all dots if 3 or fewer
            return {
                dots: Array.from({ length: total }, (_, i) => i),
                hasMore: { left: false, right: false },
            };
        }

        // Always show 3 main dots, with indicators if there are more
        const dots: number[] = [];
        let hasMoreLeft = false;
        let hasMoreRight = false;

        if (currentIndex === 0) {
            // At start: show 0, 1, 2
            dots.push(0, 1, 2);
            hasMoreRight = total > 3;
        } else if (currentIndex === total - 1) {
            // At end: show n-3, n-2, n-1
            dots.push(total - 3, total - 2, total - 1);
            hasMoreLeft = total > 3;
        } else {
            // Middle: show current-1, current, current+1
            dots.push(currentIndex - 1, currentIndex, currentIndex + 1);
            hasMoreLeft = currentIndex > 1;
            hasMoreRight = currentIndex < total - 2;
        }

        return { dots, hasMore: { left: hasMoreLeft, right: hasMoreRight } };
    }, [currentIndex, total]);

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
                    <>
                        {/* Left indicator dot for more pages */}
                        {visibleDots.hasMore.left && (
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/30 transition-all duration-300" />
                        )}

                        {/* Main dots */}
                        {visibleDots.dots.map((dotIndex) => (
                            <div
                                key={dotIndex}
                                className={[
                                    "rounded-full transition-all duration-300",
                                    dotIndex === currentIndex
                                        ? "bg-primary w-4 h-2"
                                        : "bg-muted-foreground/60 w-2 h-2",
                                ].join(" ")}
                            />
                        ))}

                        {/* Right indicator dot for more pages */}
                        {visibleDots.hasMore.right && (
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/30 transition-all duration-300" />
                        )}
                    </>
                )}
            </button>
        </div>
    );
}