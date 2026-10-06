import { useEffect, useState } from "react";
import { useWeather } from "@/plugins/weather/useWeather";
import { useDashboard } from "@/hooks/useDashboard";
import { type WidgetSlot } from "./DashboardPage";
import { weatherIcon } from "@/plugins/weather/utils";
import { plugins } from "@/plugins";

interface CompanionModeProps {
  onOpenCommandBar: () => void;
}

const pluginMap = Object.fromEntries(plugins.map((p) => [p.id, p]));

function resolveCompanionSlot(
  slot: { id: string } | null
): WidgetSlot | null {
  if (!slot) return null;
  const plugin = pluginMap[slot.id];

  // Try companion widget first, then fall back to hero
  const Component = plugin?.widgets.companion || plugin?.widgets.hero;
  if (!Component) return null;

  return { id: slot.id, component: <Component /> };
}

export default function CompanionMode({ onOpenCommandBar }: CompanionModeProps) {
  const { weather } = useWeather();
  const { slots } = useDashboard();
  const [time, setTime] = useState(new Date());
  const [companionSlot, setCompanionSlot] = useState<WidgetSlot | null>(null);

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

  // Resolve highest priority companion widget (tries companion, falls back to hero)
  useEffect(() => {
    const resolved = resolveCompanionSlot(slots.hero);
    setCompanionSlot(resolved);
  }, [slots]);

  const current = weather?.current_weather;
  const hasWidget = !!companionSlot;

  return (
    <div
      className="h-full w-full flex overflow-hidden bg-background"
      onClick={onOpenCommandBar}
    >
      {/* Left side: Time + weather - scales based on widget presence */}
      <div className={`flex flex-col items-center justify-center transition-all duration-300 ${
        hasWidget ? 'w-80 p-6' : 'flex-1 p-8'
      }`}>
        <div className="flex flex-col items-center">
          {/* Time - large when no widget, medium with widget */}
          <span className={`font-semibold text-primary leading-none tracking-tight transition-all duration-300 ${
            hasWidget ? 'text-[72px]' : 'text-[120px]'
          }`}>
            {time.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit", hour12: false})}
          </span>

          {/* Date */}
          <span className={`font-normal text-muted-foreground transition-all duration-300 ${
            hasWidget ? 'text-[18px] mt-1' : 'text-[24px] mt-2'
          }`}>
            {time.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>

          {/* Weather */}
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

      {/* Right side: Priority widget (if exists) */}
      {hasWidget && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full h-full">
            {companionSlot.component}
          </div>
        </div>
      )}
    </div>
  );
}
