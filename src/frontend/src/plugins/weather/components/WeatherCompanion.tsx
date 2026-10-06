import { Card } from "@/components/ui/card";
import { useWeather } from "../useWeather";
import { weatherIcon, weatherColour } from "../utils";
import { CloudIcon } from "lucide-react";

export function WeatherCompanion() {
  const { weather, loading } = useWeather();

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-full p-6 bg-card/50">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (!weather?.current_weather || !weather?.two_week_overview) {
    return (
      <Card className="flex items-center justify-center h-full p-6 bg-card/50">
        <p className="text-xl text-muted-foreground">No weather data</p>
      </Card>
    );
  }

  const current = weather.current_weather;
  const today = weather.two_week_overview[0];
  const tomorrow = weather.two_week_overview[1];

  return (
    <Card className="flex flex-col justify-between h-full p-6 bg-card/50">
      {/* Current Weather */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CloudIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Right Now
          </span>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <img
            src={weatherIcon(current.code, current.is_day)}
            alt="Weather"
            className="w-20 h-20"
          />
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-6xl font-bold"
                style={{ color: weatherColour(current.code) }}
              >
                {current.temp}
              </span>
              <span className="text-3xl text-muted-foreground">°</span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Range & Tomorrow */}
      <div className="space-y-3">
        {today && (
          <div className="flex items-center justify-between py-2 border-t border-border">
            <span className="text-sm font-medium text-muted-foreground">
              Today
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-green-400">
                {today.max_temp}°
              </span>
              <span className="text-sm text-blue-200">{today.min_temp}°</span>
              {today.precip > 0 && (
                <span className="text-sm text-muted-foreground">
                  {today.precip}mm
                </span>
              )}
            </div>
          </div>
        )}

        {tomorrow && (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-muted-foreground">
              Tomorrow
            </span>
            <div className="flex items-center gap-3">
              <img
                src={weatherIcon(tomorrow.code, true)}
                alt="Tomorrow"
                className="w-6 h-6"
              />
              <span className="text-sm font-bold text-green-400">
                {tomorrow.max_temp}°
              </span>
              <span className="text-sm text-blue-200">
                {tomorrow.min_temp}°
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
