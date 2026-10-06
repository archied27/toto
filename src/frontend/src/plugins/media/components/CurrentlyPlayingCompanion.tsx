import { useEffect, useState } from "react";
import { apiFetch } from "@/hooks/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Pause, Play } from "lucide-react";

interface PlayingState {
  status: "playing" | "paused";
  title: string;
  media_type: "movie" | "series";
  position_seconds: number;
  duration_seconds: number;
  agent_id: string;
  agent_name: string;
  tmdb_id: number;
  season_number?: number;
  episode_number?: number;
}

export function CurrentlyPlayingCompanion() {
  const [playing, setPlaying] = useState<PlayingState | null>(null);
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [mediaTitle, setMediaTitle] = useState<string | null>(null);
  const [controlling, setControlling] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaying = async () => {
      try {
        const result = await apiFetch<{ items: PlayingState[] }>(
          "/media/playing",
          { method: "GET" }
        );
        const items = result?.items || [];
        setPlaying(items.length > 0 ? items[0] : null);
      } catch (error) {
        console.error("Failed to fetch playing media", error);
        setPlaying(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaying();
    const interval = setInterval(fetchPlaying, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPosterPath(null);
    setMediaTitle(null);
    if (!playing) return;

    apiFetch<{ title?: string; poster_path?: string | null }>(
      `/media/items/${playing.media_type}/${playing.tmdb_id}`,
    ).then((details) => {
      if (!cancelled) {
        setPosterPath(details.poster_path ?? null);
        setMediaTitle(details.title ?? null);
      }
    }).catch(() => {
      if (!cancelled) setPosterPath(null);
    });

    return () => { cancelled = true; };
  }, [playing?.media_type, playing?.tmdb_id]);

  const togglePlayback = async () => {
    if (!playing) return;

    setControlling(true);
    setControlError(null);
    try {
      const response = await apiFetch<{ status: string; state?: PlayingState; message?: string }>(
        `/media/${encodeURIComponent(playing.agent_id)}/toggle_pause`,
        { method: "POST", body: JSON.stringify({}) },
      );
      if (response.status !== "success") {
        throw new Error(response.message || "Playback control failed");
      }
      setPlaying(response.state ? { ...playing, ...response.state } : {
        ...playing,
        status: playing.status === "playing" ? "paused" : "playing",
      });
    } catch (error) {
      setControlError(error instanceof Error ? error.message : "Playback control failed");
    } finally {
      setControlling(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-full bg-card/50">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  if (!playing) {
    return (
      <Card className="flex items-center justify-center h-full bg-card/50">
        <p className="text-muted-foreground">No media playing</p>
      </Card>
    );
  }

  const hasProgress = playing.position_seconds !== undefined && playing.duration_seconds !== undefined && playing.duration_seconds > 0;
  const progress = hasProgress
    ? Math.min((playing.position_seconds / playing.duration_seconds) * 100, 100)
    : 0;

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const episodeLabel = playing.media_type === "series" && playing.season_number && playing.episode_number
    ? `Season ${playing.season_number}, Episode ${playing.episode_number}`
    : "Movie";

  return (
    <Card className="relative isolate h-full overflow-hidden rounded-xl border border-border/70 py-0 shadow-sm">
      {posterPath && (
        <img
          src={`https://image.tmdb.org/t/p/w780${posterPath}`}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-105 object-cover opacity-40 blur-xl"
        />
      )}
      <div className="absolute inset-0 bg-background/70" />
      <CardContent className="relative flex h-full flex-col justify-between gap-4 p-4">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
          {posterPath ? (
            <img
              src={`https://image.tmdb.org/t/p/w200${posterPath}`}
              alt={mediaTitle ?? playing.title}
              className="h-full min-h-48 w-full rounded-lg object-cover object-top shadow-lg"
            />
          ) : (
            <div className="flex min-h-48 h-full w-full items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
              <Monitor className="h-6 w-6" />
            </div>
          )}
          <div className="flex min-w-0 flex-col justify-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Now playing</p>
            <h3 className="break-words text-2xl font-semibold leading-tight text-foreground">
              {mediaTitle ?? playing.title ?? `${playing.media_type.toUpperCase()} #${playing.tmdb_id}`}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{episodeLabel}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <Monitor className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{playing.agent_name}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={playing.status === "playing" ? "Pause" : "Play"}
              title={playing.status === "playing" ? "Pause" : "Play"}
              disabled={controlling}
              className="mt-6 self-start hover:bg-primary/10 hover:text-primary"
              onClick={togglePlayback}
            >
              {playing.status === "playing" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {hasProgress && (
          <div className="grid gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground/70">
              <span>{formatTime(playing.position_seconds)}</span>
              <span>{formatTime(playing.duration_seconds)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {controlError && <p className="text-xs text-destructive/80">{controlError}</p>}
      </CardContent>
    </Card>
  );
}
