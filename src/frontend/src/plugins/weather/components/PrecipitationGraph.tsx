import { useState, useRef } from "react";
import type { WeatherAtTime } from "../useWeather";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface PrecipitationGraphProps {
    dayHourlyWeather: WeatherAtTime[] | null;
    currentWeather: WeatherAtTime | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const time = new Date(label).toLocaleTimeString("en-GB", { "hour12": true, "hour": "numeric" })
    const precipData = payload.find((p: any) => p.dataKey === "precip_mm");
    const probData = payload.find((p: any) => p.dataKey === "precip_prob");

    return (
        <div className="bg-card border border-border rounded-md px-2 py-1 text-sm font-medium flex flex-col">
            <span className="text-muted-foreground">{time}</span>
            <span className="text-foreground font-bold">{precipData?.value}mm</span>
            <span className="text-muted-foreground">{probData?.value}% probability</span>
        </div>
    );
};

export default function PrecipitationGraph({ dayHourlyWeather, currentWeather }: PrecipitationGraphProps) {
    const currentHour = currentWeather ? new Date(currentWeather.time).getHours() : null;
    const [tooltipActive, setTooltipActive] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const isPast = (hourEntry: WeatherAtTime) => {
        if (currentHour === null) return false;
        const entryHour = new Date(hourEntry.time).getHours();
        const entryDate = hourEntry.time.slice(0, 10);
        const currentDate = currentWeather!.time.slice(0, 10);

        return entryDate === currentDate && entryHour < currentHour;
    };

    return (
        <Card className="py-4" onClick={(e) => {
            if (chartRef.current && !chartRef.current.contains(e.target as Node)) {
                setTooltipActive(false);
            }
        }}
        >
            <CardHeader className="flex justify-center">
                <CardTitle className="text-muted-foreground font-bold">Precipitation</CardTitle>
            </CardHeader>

            {dayHourlyWeather ?
                <div ref={chartRef}>
                    <ResponsiveContainer width="100%" height={120}>
                        <ComposedChart data={dayHourlyWeather} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                            onClick={() => setTooltipActive(true)}>
                            <XAxis
                                dataKey="time"
                                tickFormatter={(t) => `${new Date(t).toLocaleTimeString("en-GB", { hour12: true, hour: "numeric" })}`}
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                                interval={3}
                            />
                            <YAxis
                                yAxisId="left"
                                orientation="left"
                                domain={[0, 3]}
                                hide={true}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={[0, 75]}
                                hide={true}
                            />
                            <Bar
                                yAxisId="right"
                                dataKey="precip_prob"
                                radius={8}
                                cursor="default"
                                activeBar={false}
                                fill="#3b82f6"
                                fillOpacity={0.2}
                                shape={(props: any) => {
                                    const hour = dayHourlyWeather![props.index];
                                    const past = isPast(hour);
                                    return <rect
                                        {...props}
                                        fill={past ? "#6b7280" : "#3b82f6"}
                                        fillOpacity={past ? 0.1 : 0.2}
                                        rx={8}
                                        ry={8}
                                    />;
                                }}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="precip_mm"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                            <Tooltip content={<CustomTooltip />} trigger="click" active={tooltipActive} cursor={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                : <></>}

        </Card>
    );
}