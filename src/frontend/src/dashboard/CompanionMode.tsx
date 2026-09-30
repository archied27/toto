import StatusBar from "./StatusBar";
import IdleClock from "./IdleClock";
import { useEffect, useState } from "react";
import { useWeather } from "@/plugins/weather/useWeather";
import { useDashboard } from "@/hooks/useDashboard";
import { resolveSlot, type WidgetSlot } from "./DashboardPage";

interface CompanionModeProps {
  onOpenCommandBar: () => void;
}

export default function CompanionMode({ onOpenCommandBar }: CompanionModeProps) {
  const { weather } = useWeather();
  const { slots } = useDashboard();

  const [widgetSlots, setWidgetSlots] = useState<(WidgetSlot | null)[]>([]);

  useEffect(() => {
    const resolvedSlots = [
      resolveSlot(slots.hero, "hero"),
      resolveSlot(slots.long, "wide"),
      resolveSlot(slots.small_a, "small"),
      resolveSlot(slots.small_b, "small"),
    ];
    setWidgetSlots(resolvedSlots);
  }, [slots]);

  const [hero, wide, smallA, smallB] = widgetSlots;
  const hasWidgets = widgetSlots.some(Boolean);

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden bg-background"
      onClick={onOpenCommandBar}
    >
      {hasWidgets ? (
        <>
          {/* Status bar across the top */}
          <div className="shrink-0">
            <StatusBar weather={weather} />
          </div>

          {/* Main landscape layout */}
          <div className="flex-1 min-h-0 w-full p-4 flex gap-4">
            {/* Left column: Hero widget takes up most vertical space */}
            <div className="flex-1 flex flex-col gap-4">
              {hero && (
                <div className="flex-1 min-h-0">
                  {hero.component}
                </div>
              )}
              {/* Wide widget below hero if it exists */}
              {wide && (
                <div className="h-24 shrink-0">
                  {wide.component}
                </div>
              )}
            </div>

            {/* Right column: Small widgets stacked vertically */}
            {(smallA || smallB) && (
              <div className="w-80 flex flex-col gap-4">
                {smallA && (
                  <div className="flex-1 min-h-0">
                    {smallA.component}
                  </div>
                )}
                {smallB && (
                  <div className="flex-1 min-h-0">
                    {smallB.component}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <IdleClock weather={weather} />
      )}
    </div>
  );
}
