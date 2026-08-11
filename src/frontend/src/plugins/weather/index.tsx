import { useNavigation } from "@/hooks/NavigationContext";
import type { PluginManifest } from "../types";
import WeatherPage from "./WeatherPage";
import { pollenColour, pollenLabel, weatherColour, weatherIcon } from "./utils";
import { Card } from "@/components/ui/card";
import type { WeatherDaily } from "./useWeather";
import { CloudSunIcon } from "lucide-react";

export default {
    id: 'weather',
    label: 'Weather',
    icon: CloudSunIcon,
    page: WeatherPage,
    widgets: {
        hero: null,
        small: null,
        wide: null
    },
    commandRenderers: {
        show_pollen: ({ data }) => {
            const { pollen } = data;
            return (
                <Card className="border-none shadow-none flex p-5 justify-between items-center gap-2 opacity-80">
                    <p className="font-medium text-muted-foreground">The Pollen Is Currently: </p>
                    <p className="font-bold" style={{ color: pollen ? pollenColour(pollen) : undefined }}>
                        {pollen ? pollen.toFixed() : "-"} g/m3
                    </p>
                </Card>
            )
        },

        show_weather: () => {
            const { navigate } = useNavigation();
            navigate("weather", { today: true });
        },

        show_current_weather: ({ data }) => {
            const { temperature, code, is_day } = data;
            return (
                <Card className="border-none shadow-none p-5 flex justify-between items-center gap-2 opacity-80">
                    <img src={weatherIcon(code, is_day)} alt="Weather Icon" className="w-10 h-10" />
                    <p className="font-medium text-muted-foreground">The Current Temperature Is:</p>
                    <p className="font-bold" style={{ color: weatherColour(code) }}>
                            {temperature}°C
                    </p>
                </Card>
            )
        },

        forecast_for_date: ({ data }) => {
            const { date, forecast } = data;
            const day = forecast?.[0];
            const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

            if (!day) {
                return (
                    <Card className="p-5 border-none shadow-none flex flex-col gap-2 opacity-80">
                        <p className="text-lg font-bold text-muted-foreground">{dateLabel}</p>
                        <p className="text-sm text-muted-foreground">No forecast available</p>
                    </Card>
                );
            }

            return (
                <Card className="border-none shadow-none p-5 flex flex-col gap-2 opacity-80">
                    <p className="text-lg font-bold text-muted-foreground">{dateLabel}</p>
                    <div className="flex items-center gap-3">
                        <img src={weatherIcon(day.code, true)} alt="Weather Icon" className="w-10 h-10" />
                        <div className="flex flex-col">
                            <p className="text-sm font-medium" style={{ color: weatherColour(day.code) }}>
                                {day.precip > 0 ? `${day.precip}mm rain` : "No rain"}
                            </p>
                            <div className="flex gap-2">
                                <span className="text-sm font-bold text-green-400">{day.max_temp}°</span>
                                <span className="text-sm text-blue-200">{day.min_temp}°</span>
                                <span className="text-sm text-muted-foreground">UV {day.max_uv}</span>
                            </div>
                        </div>
                    </div>
                </Card>
            );
        },

        forecast_range: ({ data }) => {
            const { start_date, end_date, forecast } = data;
            const startLabel = new Date(start_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            const endLabel = new Date(end_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

            if (!forecast?.length) {
                return (
                    <Card className="p-5 border-none shadow-none flex flex-col gap-2 opacity-80">
                        <p className="text-lg font-bold text-muted-foreground">{startLabel} – {endLabel}</p>
                        <p className="text-sm text-muted-foreground">No forecast available</p>
                    </Card>
                );
            }

            return (
                <Card className="border-none shadow-none flex flex-col p-5 gap-3 opacity-80">
                    <p className="text-lg font-bold text-muted-foreground">{startLabel} – {endLabel}</p>
                    <div className="flex flex-col gap-2">
                        {forecast.map((day: WeatherDaily) => {
                            const dayName = new Date(day.time + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                            return (
                                <div key={day.time} className="flex items-center gap-3">
                                    <img src={weatherIcon(day.code, true)} alt="Weather Icon" className="w-7 h-7" />
                                    <span className="text-sm text-muted-foreground w-24 shrink-0">{dayName}</span>
                                    <span className="text-sm font-bold text-green-400">{day.max_temp}°</span>
                                    <span className="text-sm text-blue-200">{day.min_temp}°</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            );
        },

        pollen_forecast: ({ data }) => {
            const { date, grass_pollen } = data;
            const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

            return (
                <Card className="border-none shadow-none flex p-5 justify-between items-center gap-2 opacity-80">
                    <div className="flex flex-col">
                        <p className="font-medium text-muted-foreground">Grass Pollen</p>
                        <p className="text-xs text-muted-foreground">{dateLabel}</p>
                    </div>
                    {grass_pollen != null ? (
                        <p className="font-bold" style={{ color: pollenColour(grass_pollen) }}>
                            {grass_pollen.toFixed()} g/m3 — {pollenLabel(grass_pollen)}
                        </p>
                    ) : (
                        <p className="font-medium text-muted-foreground">No data</p>
                    )}
                </Card>
            );
        }

    }
    
} satisfies PluginManifest