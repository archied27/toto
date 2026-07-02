import StatusBar from "./StatusBar";
import WidgetSlots from "./WidgetSlots";
import IdleClock from "./IdleClock";
import { useEffect, useState, type ReactNode } from "react";
import { useWeather } from "@/plugins/weather/useWeather";
import { useDashboard, type DashboardSlot } from "@/hooks/useDashboard";
import { plugins } from "@/plugins";

interface WidgetSlot {
  id: string;
  component: ReactNode;
}

const pluginMap = Object.fromEntries(plugins.map((p) => [p.id, p]));

function resolveSlot(
  slot: DashboardSlot | null,
  size: "hero" | "wide" | "small"
): WidgetSlot | null {
  if (!slot) return null;
  const plugin = pluginMap[slot.id];
  const Component = plugin?.widgets[size];
  if (!Component) return null;
  return { id: slot.id, component: <Component /> };
}

export default function DashboardPage() {
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

  const hasWidgets = widgetSlots.some(Boolean);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background">
      {hasWidgets ? (
        <>
          <div className="shrink-0">
            <StatusBar weather={weather} />
          </div>
          <div className="flex-1 min-h-0 w-full relative">
            <WidgetSlots widgets={widgetSlots} />
          </div>
        </>
      ) : (
        <IdleClock weather={weather} />
      )}
    </div>
  );
}