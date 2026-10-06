import { useEffect, useState } from "react";
import { Monitor, Pause, Play, TriangleAlert } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PlayingItem {
    agent_id: string;
    agent_name: string;
    status: "playing" | "paused";
    media_type: "movie" | "series";
    tmdb_id: number;
    season_number?: number | null;
    episode_number?: number | null;
    browser_url?: string | null;
    position_seconds?: number;
    duration_seconds?: number;
    updated_at?: string;
}

interface PlayingResponse {
    status: string;
    items: PlayingItem[];
}

interface MediaDetails {
    title?: string;
    poster_path?: string | null;
}

export function CurrentlyPlaying({
    item,
    onChanged,
}: {
    item: PlayingItem;
    onChanged: (item: PlayingItem | null) => void;
}) {
    const [details, setDetails] = useState<MediaDetails | null>(null);
    const [controlling, setControlling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setDetails(null);
        apiFetch<MediaDetails>(`/media/items/${item.media_type}/${item.tmdb_id}`)
            .then((result) => {
                if (!cancelled) setDetails(result);
            })
            .catch(() => {
                if (!cancelled) setDetails(null);
            });
        return () => { cancelled = true; };
    }, [item.media_type, item.tmdb_id]);

    const togglePlayback = async () => {
        setControlling(true);
        setError(null);
        try {
            const response = await apiFetch<{ status: string; state?: PlayingItem; message?: string }>(
                `/media/${encodeURIComponent(item.agent_id)}/toggle_pause`,
                { method: "POST", body: JSON.stringify({}) },
            );
            if (response.status !== "success") {
                throw new Error(response.message || "Playback control failed");
            }
            onChanged(response.state ? { ...item, ...response.state } : {
                ...item,
                status: item.status === "playing" ? "paused" : "playing",
            });
        } catch (controlError) {
            setError(controlError instanceof Error ? controlError.message : "Playback control failed");
        } finally {
            setControlling(false);
        }
    };

    const episodeLabel = item.media_type === "series" && item.season_number && item.episode_number
        ? `Season ${item.season_number}, Episode ${item.episode_number}`
        : "Movie";

    const formatTime = (seconds: number | undefined) => {
        if (!seconds) return "0:00";
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const hasProgress = item.position_seconds !== undefined && item.duration_seconds !== undefined && item.duration_seconds > 0;
    const progressPercent = hasProgress
        ? Math.min(((item.position_seconds ?? 0) / (item.duration_seconds ?? 1)) * 100, 100)
        : 0;

    return (
        <Card className="relative mx-2 isolate overflow-hidden rounded-xl border border-border/70 py-0 shadow-sm">
            {details?.poster_path && (
                <img
                    src={`https://image.tmdb.org/t/p/w780${details.poster_path}`}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-105 object-cover opacity-40 blur-xl"
                />
            )}
            <div className="absolute inset-0 bg-background/70" />
            <CardContent className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4">
                {details?.poster_path ? (
                    <img
                        src={`https://image.tmdb.org/t/p/w200${details.poster_path}`}
                        alt={details.title || "Currently playing"}
                        className="h-20 w-14 shrink-0 rounded-md object-cover shadow-sm"
                    />
                ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                        <Monitor className="h-6 w-6" />
                    </div>
                )}

                <div className="min-w-0">
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                        Now playing
                    </p>
                    <h2 className="truncate text-base font-semibold leading-tight text-foreground">
                        {details?.title || `${item.media_type.toUpperCase()} #${item.tmdb_id}`}
                    </h2>
                    <p className="truncate text-xs text-muted-foreground">{episodeLabel}</p>
                    <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground/70">
                        <Monitor className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.agent_name}</span>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={item.status === "playing" ? "Pause" : "Play"}
                    title={item.status === "playing" ? "Pause" : "Play"}
                    disabled={controlling}
                    className="shrink-0 hover:bg-primary/10 hover:text-primary"
                    onClick={togglePlayback}
                >
                    {item.status === "playing" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>

                {hasProgress && (
                    <div className="col-span-3 grid gap-1.5">
                        <div className="flex justify-between text-[11px] text-muted-foreground/70">
                            <span>{formatTime(item.position_seconds)}</span>
                            <span>{formatTime(item.duration_seconds)}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-muted/50">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="col-span-3 flex items-center gap-1 text-xs text-destructive/80">
                        <TriangleAlert className="h-3 w-3" />
                        {error}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export type { PlayingItem, PlayingResponse };