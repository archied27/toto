import { useRef, useEffect, useState } from "react";

interface TaskTabsProps {
  currentTab: "Today" | "Tomorrow" | "Upcoming" | "All";
  onTabChange: (tab: "Today" | "Tomorrow" | "Upcoming" | "All") => void;
}

export default function TaskTabs({ currentTab, onTabChange }: TaskTabsProps) {
  const tabs = ["All", "Today", "Tomorrow", "Upcoming"] as const;
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>(
      `[data-tab="${currentTab}"]`
    );
    if (!activeBtn) return;
    const containerLeft = container.getBoundingClientRect().left;
    const btnRect = activeBtn.getBoundingClientRect();
    const padX = 12;
    setIndicatorStyle({
      left: btnRect.left - containerLeft + padX,
      width: btnRect.width - padX * 2,
    });
  }, [currentTab]);

  return (
    <div className="relative">
      <div ref={containerRef} className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map(tab => (
          <button
            key={tab}
            data-tab={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 shrink-0 rounded-md px-3 py-2 text-[13px] font-medium
              transition-colors active:scale-95
              ${currentTab === tab ? "text-foreground" : "text-muted-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        className="absolute -bottom-px h-0.5 rounded-full bg-primary transition-all duration-250"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}