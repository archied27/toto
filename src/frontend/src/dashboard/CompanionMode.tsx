import { useEffect, useMemo, useState } from "react";
import { useWeather } from "@/plugins/weather/useWeather";
import { type DashboardSlot, useDashboard } from "@/hooks/useDashboard";
import { type WidgetSlot } from "./DashboardPage";
import { weatherIcon } from "@/plugins/weather/utils";
import { plugins } from "@/plugins";

const pluginMap = Object.fromEntries(plugins.map((p) => [p.id, p]));

function resolveCompanionSlot(
  slot: DashboardSlot | null
): WidgetSlot | null {
  if (!slot?.id) return null;
  const plugin = pluginMap[slot.id];

  // Try companion widget first, then fall back to hero
  const Component = plugin?.widgets.companion || plugin?.widgets.hero;
  if (!Component) return null;

  return { id: slot.id, component: <Component /> };
}

export default function CompanionMode() {
  const { weather } = useWeather();
  const { slots } = useDashboard();
  const [time, setTime] = useState(new Date());

  // Keep the screen awake while Companion Mode is active
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if (
          "wakeLock" in navigator &&
          document.visibilityState === "visible"
        ) {
          // Release any previous lock before requesting a new one
          if (wakeLock) {
            await wakeLock.release();
            wakeLock = null;
          }

          wakeLock = await navigator.wakeLock.request("screen");

          console.log("Companion Mode: screen wake lock enabled");

          wakeLock.addEventListener("release", () => {
            console.log("Companion Mode: screen wake lock released");
          });
        }
      } catch (error) {
        console.error(
          "Companion Mode: failed to acquire screen wake lock:",
          error
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    // Request wake lock when Companion Mode starts
    requestWakeLock();

    // Browsers release the wake lock when the page becomes hidden.
    // Re-acquire it when the user comes back.
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
      }
    };
  }, []);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const companionSlots = useMemo(() => [slots.hero, slots.long, slots.small_a, slots.small_b]
      .filter((slot): slot is DashboardSlot => !!slot?.id && slot.priority >= 90)
      .slice(0, 2)
      .map(resolveCompanionSlot)
      .filter((slot): slot is WidgetSlot => !!slot), [slots]);

  const current = weather?.current_weather;
  const hasWidget = companionSlots.length > 0;
  const hasTwoWidgets = companionSlots.length === 2;

  return (
    <div
      className="h-full w-full flex overflow-hidden bg-background"
    >
      {!hasTwoWidgets && (
        <div className={`flex flex-col items-center justify-center transition-all duration-300 ${
          hasWidget ? 'w-80 p-6' : 'flex-1 p-8'
        }`}>
          <div className="flex flex-col items-center">
            <span className={`font-semibold text-primary leading-none tracking-tight transition-all duration-300 ${
              hasWidget ? 'text-[72px]' : 'text-[120px]'
            }`}>
              {time.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", hour12: false})}
            </span>
            <span className={`font-normal text-muted-foreground transition-all duration-300 ${
              hasWidget ? 'text-[18px] mt-1' : 'text-[24px] mt-2'
            }`}>
              {time.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <div className={`flex items-center gap-2 font-normal text-muted-foreground transition-all duration-300 ${
              hasWidget ? 'text-[18px] mt-3' : 'text-[24px] mt-4'
            }`}>
              {current ? (
                <>
                  <img src={weatherIcon(current.code, current.is_day)} className={hasWidget ? 'w-10 h-10' : 'w-12 h-12'} />
                  <span className="font-semibold">{current.temp}°</span>
                </>
              ) : (
                <span className="font-semibold">-</span>
              )}
            </div>
          </div>
        </div>
      )}

      {hasWidget && (
        <div className={`flex items-center justify-center p-6 ${hasTwoWidgets ? 'flex-1 min-w-0' : 'flex-1'}`}>
          {companionSlots.map((slot) => (
            <div key={slot.id} className={hasTwoWidgets ? 'w-1/2 h-full px-3' : 'w-full h-full'}>
              {slot.component}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
