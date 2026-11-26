import { useEffect, useState } from "react";
import { Album, ArrowLeft, Check, LoaderCircle, Pause, Pencil, Play, Repeat, Repeat1, RefreshCw, Shuffle, SkipBack, SkipForward, WifiOff, X } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WidgetContainer } from "@/components/WidgetContainer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SpotifyTrack {
    is_playing: boolean;
    track: string;
    artists: string;
    album: string;
    album_image?: string | null;
    device?: string | null;
    device_type?: string | null;
    volume_percent?: number | null;
    progress_ms?: number;
    duration_ms?: number;
    shuffle_state?: boolean;
    repeat_state?: "off" | "track" | "context";
}

interface SpotifyDevice {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    is_restricted: boolean;
    volume_percent?: number | null;
}

interface SpotifyState {
    connected: boolean;
    current: SpotifyTrack | null;
}

interface SpotifyCluster {
    id: number;
    name: string;
    count: number;
    cover_image?: string | null;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    artist: string;
    cover_image?: string | null;
    release_date?: string | null;
}

interface SpotifyAlbumDetail {
    id: string;
    name: string;
    artist: string;
    cover_image?: string | null;
    release_date?: string | null;
    label?: string | null;
    popularity?: number;
    tracks: Array<{ id: string | null; name: string; duration_ms: number; track_number: number; explicit: boolean }>;
}

export function SpotifyPage() {
    return <SpotifySurface fullPage />;
}

export function SpotifyWidget() {
    return <SpotifySurface />;
}

export function SpotifyWideWidget() {
    return <SpotifySurface wide />;
}

export function SpotifyHeroWidget() {
    return <SpotifySurface hero />;
}


function SpotifySurface({ fullPage = false, hero = false, wide = false }: { fullPage?: boolean; hero?: boolean; wide?: boolean }) {
    const [state, setState] = useState<SpotifyState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [clusters, setClusters] = useState<SpotifyCluster[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<{ cluster: SpotifyCluster; albums: SpotifyAlbum[] } | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
    const [clusterName, setClusterName] = useState("");
    const [devices, setDevices] = useState<SpotifyDevice[]>([]);
    const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbumDetail | null>(null);
    const [albumDialogOpen, setAlbumDialogOpen] = useState(false);
    const [playingAlbumId, setPlayingAlbumId] = useState<string | null>(null);

    const refresh = async () => {
        try {
            setState(await apiFetch<SpotifyState>("/spotify/playing"));
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to reach Spotify");
        }
    };

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => void refresh(), 5000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!fullPage || !state?.connected) return;
        void apiFetch<SpotifyCluster[]>("/spotify/clusters").then(setClusters).catch(() => undefined);
    }, [fullPage, state?.connected]);

    useEffect(() => {
        if (!state?.connected) return;
        void apiFetch<SpotifyDevice[]>("/spotify/devices").then(setDevices).catch(() => undefined);
    }, [state?.connected]);

    if (wide) {
        return (
            <WidgetContainer className="bg-card/60 p-0">
                {!state?.connected ? (
                    <div className="flex h-full items-center px-4 text-sm text-muted-foreground">Spotify is not connected</div>
                ) : !state.current ? null : (
                    <div className="flex h-full min-w-0 items-center gap-3 px-3 py-2">
                        {state.current.album_image && (
                            <img src={state.current.album_image} alt={`${state.current.album} album art`} className="size-12 shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{state.current.track}</p>
                            <p className="truncate text-xs text-muted-foreground">{state.current.artists}</p>
                            <p className="truncate text-[11px] text-muted-foreground/80">{state.current.album}</p>
                        </div>
                    </div>
                )}
            </WidgetContainer>
        );
    }

    const connect = async () => {
        try {
            const result = await apiFetch<{ authorization_url: string }>("/spotify/connect");
            window.location.href = result.authorization_url;
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Spotify is not configured");
        }
    };

    const control = async (action: "previous" | "play" | "pause" | "next") => {
        setBusy(true);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/control/${action}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Playback control failed");
        } finally {
            setBusy(false);
        }
    };

    const syncAlbums = async () => {
        setSyncing(true);
        try {
            const result = await apiFetch<{ clusters: SpotifyCluster[] }>('/spotify/albums/sync', { method: 'POST' });
            setClusters(result.clusters);
            setSelectedCluster(null);
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Album sync failed');
        } finally {
            setSyncing(false);
        }
    };

    const setShuffle = async (shuffleState: boolean) => {
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/shuffle?shuffle_state=${shuffleState}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Shuffle change failed");
        }
    };

    const setRepeat = async (repeatState: "off" | "track" | "context") => {
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/repeat?repeat_state=${repeatState}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Repeat change failed");
        }
    };

    const openCluster = async (cluster: SpotifyCluster) => {
        try {
            const albums = await apiFetch<SpotifyAlbum[]>(`/spotify/clusters/${cluster.id}`);
            setSelectedCluster({ cluster, albums });
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load cluster");
        }
    };

    const startRenaming = (cluster: SpotifyCluster) => {
        setEditingClusterId(cluster.id);
        setClusterName(cluster.name);
    };

    const cancelRenaming = () => {
        setEditingClusterId(null);
        setClusterName("");
    };

    const renameCluster = async (cluster: SpotifyCluster) => {
        try {
            const renamed = await apiFetch<{ id: number; name: string }>(`/spotify/clusters/${cluster.id}/name`, {
                method: "PUT",
                body: JSON.stringify({ name: clusterName }),
            });
            setClusters((current) => current.map((item) => item.id === renamed.id ? { ...item, name: renamed.name } : item));
            cancelRenaming();
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to rename cluster");
        }
    };

    const openAlbum = async (album: SpotifyAlbum) => {
        setPlayingAlbumId(null);
        try {
            setSelectedAlbum(await apiFetch<SpotifyAlbumDetail>(`/spotify/albums/${album.id}`));
            setAlbumDialogOpen(true);
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load album");
        }
    };

    const playAlbum = async (album: SpotifyAlbum, deviceId?: string) => {
        setBusy(true);
        setPlayingAlbumId(album.id);
        try {
            const suffix = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
            setState(await apiFetch<SpotifyState>(`/spotify/albums/${album.id}/play${suffix}`, { method: "POST" }));
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Album playback failed");
        } finally {
            setBusy(false);
            window.setTimeout(() => setPlayingAlbumId(null), 700);
        }
    };

    const playTrack = async (trackId: string) => {
        setBusy(true);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/tracks/${trackId}/play`, { method: "POST" }));
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Track playback failed");
        } finally {
            setBusy(false);
        }
    };

    const transferPlayback = async (deviceId: string) => {
        setBusy(true);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/devices/${deviceId}/transfer`, { method: "POST" }));
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to transfer playback");
        } finally {
            setBusy(false);
        }
    };

    const content = !state?.connected ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <WifiOff className="size-5 text-muted-foreground" />
            <div>
                <p className="font-medium">Spotify is not connected</p>
                <p className="mt-1 text-xs text-muted-foreground">Connect your account to see and control playback.</p>
            </div>
            <Button size="sm" onClick={() => void connect()}>Connect Spotify</Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    ) : !state.current ? null : (
        <div className="relative flex h-full min-h-0 overflow-hidden rounded-md">
            {state.current.album_image && (
                <img src={state.current.album_image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-90 blur-lg" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />

            <div
                className={`relative z-10 flex min-h-0 min-w-0 flex-1 ${
                    hero
                        ? "w-full flex-col items-center justify-start gap-[3cqh] overflow-hidden p-[4cqh] text-center"
                        : "flex-col items-center justify-between gap-4 p-3 text-center sm:flex-row sm:items-stretch sm:text-left"
                }`}
                style={hero ? { containerType: "size" } : undefined}
            >
                {state.current.album_image && (
                    <img
                        src={state.current.album_image}
                        alt={`${state.current.album} album art`}
                        className={`shrink-0 rounded-md object-cover object-center shadow-lg ${
                            hero
                                ? "w-auto h-auto max-w-full max-h-[65cqh] aspect-square"
                                : "aspect-square size-40 sm:size-36"
                        }`}
                        style={hero ? {
                            width: "min(65cqh, 65cqw)",
                            height: "min(65cqh, 65cqw)",
                        } : undefined}
                    />
                )}

                <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${
                    hero ? "w-full items-center justify-center gap-[2cqh]" : "justify-between"
                }`}>
                    <div className={`min-w-0 ${hero ? "w-full text-center" : ""}`}>
                        <p
                            className={`truncate font-semibold text-white drop-shadow-md ${
                                hero ? "text-[5.5cqh]" : "text-sm"
                            }`}
                        >
                            {state.current.track}
                        </p>
                        <p
                            className={`truncate text-white/75 drop-shadow-md ${
                                hero ? "text-[3.8cqh]" : "text-xs"
                            }`}
                        >
                            {state.current.artists}
                        </p>
                        <p
                            className={`mt-1 truncate text-white/65 drop-shadow-md ${
                                hero ? "text-[3cqh]" : "text-[11px]"
                            }`}
                        >
                            {state.current.album}
                        </p>
                    </div>

                    <div className={hero ? "w-full" : ""}>
                        <div className={`flex items-center ${
                            hero ? "justify-center gap-[2cqw]" : "gap-3"
                        }`}>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Shuffle"
                                title="Shuffle"
                                onClick={() => void setShuffle(!state.current?.shuffle_state)}
                            >
                                <Shuffle className={state.current?.shuffle_state ? "text-primary" : "text-muted-foreground"} />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Previous track"
                                title="Previous track"
                                disabled={busy}
                                onClick={() => void control("previous")}
                            >
                                <SkipBack />
                            </Button>

                            <Button
                                variant="default"
                                size="icon-sm"
                                aria-label={state.current.is_playing ? "Pause" : "Play"}
                                title={state.current.is_playing ? "Pause" : "Play"}
                                disabled={busy}
                                onClick={() => void control(state.current?.is_playing ? "pause" : "play")}
                            >
                                {state.current.is_playing ? <Pause /> : <Play />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Next track"
                                title="Next track"
                                disabled={busy}
                                onClick={() => void control("next")}
                            >
                                <SkipForward />
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Repeat"
                                title="Repeat"
                                onClick={() => void setRepeat(
                                    state.current?.repeat_state === "off"
                                        ? "context"
                                        : state.current?.repeat_state === "context"
                                            ? "track"
                                            : "off"
                                )}
                            >
                                {state.current?.repeat_state === "track"
                                    ? <Repeat1 />
                                    : <Repeat className={state.current?.repeat_state === "context" ? "text-primary" : "text-muted-foreground"} />
                                }
                            </Button>
                        </div>

                        {(state.current.progress_ms ?? 0) >= 0 && (state.current.duration_ms ?? 0) > 0 && (
                            <div
                                aria-label="Track progress"
                                className={`mt-2 h-1 overflow-hidden rounded-full bg-white/20 ${
                                    hero ? "mx-auto w-[85%]" : "w-full"
                                }`}
                            >
                                <div
                                    className="h-full rounded-full bg-white/90 transition-[width]"
                                    style={{
                                        width: `${Math.max(0, Math.min(100, ((state.current.progress_ms ?? 0) / (state.current.duration_ms || 1)) * 100))}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (!fullPage) return <WidgetContainer className="bg-card/60 p-0">{content}</WidgetContainer>;

    return (
        <main className="min-h-screen bg-background px-3 pb-35 pt-5 text-foreground">
            <div className="mx-auto max-w-4xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">Spotify</h1>
                    {state?.connected && (
                        <Button variant="outline" size="sm" disabled={syncing} onClick={() => void syncAlbums()}>
                            <RefreshCw className={syncing ? "animate-spin" : ""} />
                            {syncing ? "Clustering..." : "Sync saved albums"}
                        </Button>
                    )}
                </div>

                <Card className="mb-6 min-h-56 p-0">{content}</Card>

                {state?.connected && (
                    <section aria-label="Saved album clusters">
                        {selectedCluster ? (
                            <>
                                <Button variant="ghost" size="sm" className="mb-3" onClick={() => setSelectedCluster(null)}>
                                    <ArrowLeft />All clusters
                                </Button>
                                <div className="mb-3">
                                    <h2 className="text-lg font-semibold">{selectedCluster.cluster.name}</h2>
                                    <p className="text-sm text-muted-foreground">{selectedCluster.albums.length} albums</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {selectedCluster.albums.map((album) => (
                                        <button key={album.id} type="button" disabled={busy} onClick={() => void openAlbum(album)} className="group relative min-w-0 text-left">
                                            {album.cover_image ? (
                                                <img src={album.cover_image} alt={`${album.name} album art`} className="aspect-square w-full rounded-md object-cover shadow-sm transition group-hover:brightness-75" />
                                            ) : (
                                                <div className="flex aspect-square items-center justify-center rounded-md bg-muted">
                                                    <Album className="size-8 text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="absolute left-2 top-2 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                                                <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); void playAlbum(album); }} onKeyDown={(event) => { if (event.key === "Enter") void playAlbum(album); }} className="flex size-9 items-center justify-center rounded-full bg-black/75 text-white shadow-lg backdrop-blur">
                                                    {playingAlbumId === album.id ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                                                </span>
                                            </div>
                                            <p className="mt-2 truncate text-sm font-medium">{album.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">{album.artist}</p>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-3">
                                    <h2 className="text-lg font-semibold">Your album clusters</h2>
                                    <p className="text-sm text-muted-foreground">Sync your saved albums to group them by sound, era, and artist genres.</p>
                                </div>
                                {clusters.length === 0 ? (
                                    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No clusters yet. Sync your saved albums to begin.</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {clusters.map((cluster) => (
                                            <div key={cluster.id} className="group relative aspect-square min-w-0 overflow-hidden rounded-md shadow-sm">
                                                <button type="button" onClick={() => void openCluster(cluster)} className="absolute inset-0 text-left">
                                                    {cluster.cover_image ? (
                                                        <img src={cluster.cover_image} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover transition group-hover:brightness-75" />
                                                    ) : (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                                            <Album className="size-8 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/45 transition group-hover:bg-black/55" />
                                                </button>
                                                {editingClusterId === cluster.id ? (
                                                    <div className="pointer-events-none relative z-10 flex items-center gap-1 p-2">
                                                        <input autoFocus value={clusterName} onChange={(event) => setClusterName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameCluster(cluster); if (event.key === "Escape") cancelRenaming(); }} className="pointer-events-auto min-w-0 flex-1 rounded bg-black/70 px-2 py-1 text-sm text-white outline-none ring-1 ring-white/60" aria-label="Cluster name" />
                                                        <button type="button" onClick={() => void renameCluster(cluster)} className="pointer-events-auto rounded p-1 text-white hover:bg-white/20" aria-label="Save cluster name" title="Save cluster name"><Check className="size-4" /></button>
                                                        <button type="button" onClick={cancelRenaming} className="pointer-events-auto rounded p-1 text-white hover:bg-white/20" aria-label="Cancel renaming" title="Cancel renaming"><X className="size-4" /></button>
                                                    </div>
                                                ) : (
                                                    <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center p-3 text-center text-white">
                                                        <p className="max-w-full truncate text-lg font-bold drop-shadow-md sm:text-xl">{cluster.name}</p>
                                                        <p className="mt-1 text-xs text-white/85 drop-shadow-sm">{cluster.count} albums</p>
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); startRenaming(cluster); }} className="pointer-events-auto absolute right-2 top-2 rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-white/20" aria-label={`Rename ${cluster.name}`} title="Rename cluster"><Pencil className="size-3.5" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>
                )}

                {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

                {selectedAlbum && (
                    <Dialog open={albumDialogOpen} onOpenChange={setAlbumDialogOpen}>
                        <DialogContent className="max-w-2xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-semibold">{selectedAlbum.name}</DialogTitle>
                                <DialogDescription className="mt-1 text-sm text-muted-foreground">{selectedAlbum.artist}</DialogDescription>
                            </DialogHeader>
                            <div className="mt-4">
                                {selectedAlbum.cover_image && <img src={selectedAlbum.cover_image} alt={`${selectedAlbum.name} album art`} className="mb-4 aspect-square w-full rounded-md object-cover" />}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-muted-foreground">Release date</span>
                                        <span className="mt-1 text-sm font-medium">{selectedAlbum.release_date ?? "Unknown"}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm text-muted-foreground">Label</span>
                                        <span className="mt-1 text-sm font-medium">{selectedAlbum.label ?? "Unknown"}</span>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <Button variant="default" size="sm" onClick={() => void playAlbum({ id: selectedAlbum.id, name: selectedAlbum.name, artist: selectedAlbum.artist, cover_image: selectedAlbum.cover_image, release_date: selectedAlbum.release_date })}>
                                        {playingAlbumId === selectedAlbum.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}Play album
                                    </Button>
                                    {devices.length > 0 && (
                                        <select aria-label="Playback device" className="h-8 rounded-md border border-border bg-background px-2 text-xs" defaultValue={devices.find((device) => device.is_active)?.id || devices[0]?.id} onChange={(event) => void transferPlayback(event.target.value)}>
                                            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                {selectedAlbum.tracks.length > 0 && (
                                    <div className="mt-5 max-h-64 space-y-1 overflow-y-auto">
                                        {selectedAlbum.tracks.map((track) => (
                                            <button key={track.id ?? track.track_number} type="button" disabled={busy || !track.id} onClick={() => track.id && void playTrack(track.id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted">
                                                <span className="w-5 text-right text-xs text-muted-foreground">{track.track_number}</span>
                                                <span className="min-w-0 flex-1 truncate text-sm">{track.name}{track.explicit && <span className="ml-2 text-[10px] text-muted-foreground">E</span>}</span>
                                                <span className="text-xs text-muted-foreground">{Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, "0")}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </main>
    );
}
