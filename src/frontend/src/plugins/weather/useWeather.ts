import { useState, useEffect } from "react";
import { apiFetch } from "@/hooks/api";
import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";


export interface WeatherAtTime {
  time: string;
  temp: number;
  precip_mm: number;
  precip_prob: number;
  uv: number;
  grass_pollen: number;
  code: number;
  is_day: boolean;
}

export interface WeatherDaily {
  time: string;
  max_temp: number;
  min_temp: number;
  avg_temp: number;
  max_uv: number;
  precip: number;
  code: number;
}

export interface WeatherData {
  current_weather: WeatherAtTime;
  two_week_overview: WeatherDaily[];
  two_week_hourly: WeatherAtTime[];
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<WeatherData>("/weather/current")
        .then(data =>  {
            setWeather(data);
            setLoading(false);
        })
        .catch(() => {
            setError(true);
            setLoading(false);
        })
  }, []);

  useWebSocketEvent<WeatherData>("weather.updated", (newWeather) => {
    setWeather(newWeather);
    setRefreshing(false);
  });

  return { weather, loading, error, refreshing, setRefreshing };
}