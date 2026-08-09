import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeatherAtTime } from "../useWeather"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,  } from "recharts";
import { tempColour } from "../utils";
import { useRef, useState } from "react";

interface TemperatureGraphProps {
    dayHourlyWeather: WeatherAtTime[] | null;
    currentWeather: WeatherAtTime | null;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const time = new Date(label).toLocaleTimeString("en-GB", {"hour12": true, "hour": "numeric"})
  return (
    <div className="bg-card border border-border rounded-md px-2 py-1 text-sm font-medium flex flex-col">
      <span className="text-muted-foreground">{time}</span> 
      <span>{payload[0].value}°</span>
    </div>
  );
};

export default function TemperatureGraph({ dayHourlyWeather, currentWeather }: TemperatureGraphProps) {
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

    const gradientStops = dayHourlyWeather ? dayHourlyWeather.map((hour, i) => ({
        offset: `${(i / (dayHourlyWeather.length - 1)) * 100}%`,
        color: isPast(hour) ? "#6b7280" : tempColour(hour.temp),
        opacity: isPast(hour) ? 0.5 : 1,  // grey out past hours
    })): null;

    const maxTemp = dayHourlyWeather ? Math.max(...dayHourlyWeather.map(h => h.temp)) : null;

    return (
        <Card className="py-4" onClick={(e) => {
            if (chartRef.current && !chartRef.current.contains(e.target as Node)) {
            setTooltipActive(false);
            }}}
        >
            <CardHeader className="flex flex-row">
                <CardTitle className="text-muted-foreground font-bold flex-1">Temperature <span className="text-[10px]">(°C)</span></CardTitle>
                <CardTitle className="font-bold text-right"
                style={{ color: maxTemp !== null ? tempColour(maxTemp) : undefined }}>{maxTemp ?? "-"}°</CardTitle>
            </CardHeader>

        
            {dayHourlyWeather && gradientStops ?  
            <div ref={chartRef}>
            <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={dayHourlyWeather} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                onClick={() => setTooltipActive(true)}>
                    <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="1" y2="0">
                        {gradientStops.map((stop, i) => (
                            <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                        ))}
                        </linearGradient>
                        <linearGradient id="tempFill" x1="0" y1="0" x2="1" y2="0">
                        {gradientStops.map((stop, i) => (
                            <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity * 0.2} />
                        ))}
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="temp"
                        stroke="url(#tempGradient)"
                        fill="url(#tempFill)"
                        strokeWidth={5}
                        dot={false}
                        activeDot={{r:4, strokeWidth:1.5, fill:"white", stroke:"black", opacity:tooltipActive ? 1: 0}}
                    />
                    <XAxis
                        dataKey="time"
                        tickFormatter={(t) => `${new Date(t).toLocaleTimeString("en-GB", {hour12: true, hour: "numeric"})}`}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12 }}
                        padding={{ left:20, right:20 }}
                        interval={3}

                    />
                    <YAxis hide domain={[-10, 40]} />
                    <Tooltip content={<CustomTooltip />} trigger="click" active={tooltipActive}/>
                    </AreaChart>
                </ResponsiveContainer>
                </div>
: <></>}
        </Card>
    )
}