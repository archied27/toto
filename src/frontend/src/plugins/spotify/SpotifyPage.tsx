import { useEffect, useState } from "react";
import { Album, ArrowLeft, Check, Laptop2, Pause, Pencil, Play, RefreshCw, SkipBack, SkipForward, Smartphone, Volume2, WifiOff, X } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WidgetContainer } from "@/components/WidgetContainer";

interface SpotifyTrack {
    is_playing: boolean;
    track: string;
    artists: string;
    album: string;
    album_image?: string | null;
    device?: string | null;
    device_type?: string | null;
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

function DeviceIcon({ type }: { type?: string | null }) {
    return type === "computer" ? <Laptop2 className="size-4" /> : <Smartphone className="size-4" />;
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

    if (wide) {
        return (
            <WidgetContainer className="bg-card/60 p-0">
                {!state?.connected ? (
                    <div className="flex h-full items-center px-4 text-sm text-muted-foreground">Spotify is not connected</div>
                ) : !state.current ? (
                    <div className="flex h-full items-center px-4 text-sm text-muted-foreground">Nothing playing</div>
                ) : (
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
            const result = await apiFetch<{ clusters: SpotifyCluster[] }>("/spotify/albums/sync", { method: "POST" });
            setClusters(result.clusters);
            setSelectedCluster(null);
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Album sync failed");
        } finally {
            setSyncing(false);
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

    const playAlbum = async (album: SpotifyAlbum) => {
        setBusy(true);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/albums/${album.id}/play`, { method: "POST" }));
            setError(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Album playback failed");
        } finally {
            setBusy(false);
        }
    };

    const content = !state?.connected ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <WifiOff className="size-5 text-muted-foreground" />
            <div><p className="font-medium">Spotify is not connected</p><p className="mt-1 text-xs text-muted-foreground">Connect your account to see and control playback.</p></div>
            <Button size="sm" onClick={() => void connect()}>Connect Spotify</Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    ) : !state.current ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Nothing playing</div>
    ) : (
        <div className="relative flex h-full min-h-0 overflow-hidden rounded-md">
            {state.current.album_image && <img src={state.current.album_image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-90 blur-lg" />}
            <div className="absolute inset-0 bg-black/25" />
            <div className={`relative z-10 flex min-h-0 min-w-0 flex-1 ${hero ? "flex-col items-center gap-2 p-3 text-center sm:gap-4 sm:p-6" : "flex-col items-center justify-between gap-4 p-3 text-center sm:flex-row sm:items-stretch sm:text-left"}`}>
                {state.current.album_image && <img src={state.current.album_image} alt={`${state.current.album} album art`} className={`aspect-square shrink-0 rounded-md object-cover shadow-lg ${hero ? "h-auto max-h-[65%] w-auto max-w-full sm:size-52 sm:max-h-none" : "size-40 sm:size-36"}`} />}
                <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${hero ? "w-full items-center gap-0" : "justify-between"}`}>
                <div className={`min-w-0 ${hero ? "w-full text-center" : ""}`}>
                    <p className="truncate text-sm font-semibold">{state.current.track}</p>
                    <p className="truncate text-xs text-muted-foreground">{state.current.artists}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground/80">{state.current.album}</p>
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon-sm" aria-label="Previous track" title="Previous track" disabled={busy} onClick={() => void control("previous")}><SkipBack /></Button>
                        <Button variant="default" size="icon-sm" aria-label={state.current.is_playing ? "Pause" : "Play"} title={state.current.is_playing ? "Pause" : "Play"} disabled={busy} onClick={() => void control(state.current?.is_playing ? "pause" : "play")}>{state.current.is_playing ? <Pause /> : <Play />}</Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Next track" title="Next track" disabled={busy} onClick={() => void control("next")}><SkipForward /></Button>
                    </div>
                    {!hero && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><DeviceIcon type={state.current.device_type} /><span className="truncate">{state.current.device || "Unknown device"}</span><Volume2 className="ml-auto size-3.5" /><span>{state.current.volume_percent ?? "-"}%</span></div>}
                </div>
            </div>
            </div>
        </div>
    );

    if (!fullPage) return <WidgetContainer className="bg-card/60 p-0">{content}</WidgetContainer>;

    return <main className="min-h-screen bg-background px-3 pb-35 pt-5 text-foreground"><div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight">Spotify</h1>{state?.connected && <Button variant="outline" size="sm" disabled={syncing} onClick={() => void syncAlbums()}><RefreshCw className={syncing ? "animate-spin" : ""} />{syncing ? "Clustering..." : "Sync saved albums"}</Button>}</div>
        <Card className="mb-6 min-h-56 p-0">{content}</Card>
        {state?.connected && <section aria-label="Saved album clusters">
            {selectedCluster ? <>
                <Button variant="ghost" size="sm" className="mb-3" onClick={() => setSelectedCluster(null)}><ArrowLeft />All clusters</Button>
                <div className="mb-3"><h2 className="text-lg font-semibold">{selectedCluster.cluster.name}</h2><p className="text-sm text-muted-foreground">{selectedCluster.albums.length} albums</p></div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {selectedCluster.albums.map((album) => <button key={album.id} type="button" disabled={busy} onClick={() => void playAlbum(album)} className="group min-w-0 text-left">
                        {album.cover_image ? <img src={album.cover_image} alt={`${album.name} album art`} className="aspect-square w-full rounded-md object-cover shadow-sm transition group-hover:brightness-75" /> : <div className="flex aspect-square items-center justify-center rounded-md bg-muted"><Album className="size-8 text-muted-foreground" /></div>}
                        <p className="mt-2 truncate text-sm font-medium">{album.name}</p><p className="truncate text-xs text-muted-foreground">{album.artist}</p>
                    </button>)}
                </div>
            </> : <>
                <div className="mb-3"><h2 className="text-lg font-semibold">Your album clusters</h2><p className="text-sm text-muted-foreground">Sync your saved albums to group them by sound, era, and artist genres.</p></div>
                {clusters.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No clusters yet. Sync your saved albums to begin.</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {clusters.map((cluster) => <div key={cluster.id} className="group relative aspect-square min-w-0 overflow-hidden rounded-md shadow-sm">
                        <button type="button" onClick={() => void openCluster(cluster)} className="absolute inset-0 text-left">
                            {cluster.cover_image ? <img src={cluster.cover_image} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover transition group-hover:brightness-75" /> : <div className="absolute inset-0 flex items-center justify-center bg-muted"><Album className="size-8 text-muted-foreground" /></div>}
                            <div className="absolute inset-0 bg-black/45 transition group-hover:bg-black/55" />
                        </button>
                        {editingClusterId === cluster.id ? <div className="pointer-events-none relative z-10 flex items-center gap-1 p-2">
                            <input autoFocus value={clusterName} onChange={(event) => setClusterName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameCluster(cluster); if (event.key === "Escape") cancelRenaming(); }} className="pointer-events-auto min-w-0 flex-1 rounded bg-black/70 px-2 py-1 text-sm text-white outline-none ring-1 ring-white/60" aria-label="Cluster name" />
                            <button type="button" onClick={() => void renameCluster(cluster)} className="pointer-events-auto rounded p-1 text-white hover:bg-white/20" aria-label="Save cluster name" title="Save cluster name"><Check className="size-4" /></button>
                            <button type="button" onClick={cancelRenaming} className="pointer-events-auto rounded p-1 text-white hover:bg-white/20" aria-label="Cancel renaming" title="Cancel renaming"><X className="size-4" /></button>
                        </div> : <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center p-3 text-center text-white">
                            <p className="max-w-full truncate text-lg font-bold drop-shadow-md sm:text-xl">{cluster.name}</p>
                            <p className="mt-1 text-xs text-white/85 drop-shadow-sm">{cluster.count} albums</p>
                            <button type="button" onClick={(event) => { event.stopPropagation(); startRenaming(cluster); }} className="pointer-events-auto absolute right-2 top-2 rounded p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-white/20" aria-label={`Rename ${cluster.name}`} title="Rename cluster"><Pencil className="size-3.5" /></button>
                        </div>}
                    </div>)}
                </div>}
            </>}
        </section>}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div></main>;
}