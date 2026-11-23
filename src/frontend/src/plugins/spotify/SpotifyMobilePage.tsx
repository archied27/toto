import { useEffect, useState } from "react";
import { ArrowLeft, Laptop2, LoaderCircle, Pause, Play, RefreshCw, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Smartphone, Volume2, WifiOff, Check, Pencil, X } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
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
}

interface SpotifyState {
    connected: boolean;
    current: SpotifyTrack | null;
}

interface SpotifyAlbum {
    id: string;
    name: string;
    artist: string;
    cover_image?: string | null;
    release_date?: string | null;
}

interface SpotifyCluster {
    id: number;
    name: string;
    count: number;
    cover_image?: string | null;
}

interface SpotifyAlbumDetail extends SpotifyAlbum {
    label?: string | null;
    popularity?: number;
    tracks: Array<{ id: string | null; name: string; duration_ms: number; track_number: number; explicit: boolean }>;
}

function DeviceIcon({ type, className = "size-4" }: { type?: string | null; className?: string }) {
    return type === "computer" ? <Laptop2 className={className} /> : <Smartphone className={className} />;
}

function formatTime(milliseconds = 0) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SpotifyMobilePage() {
    const [state, setState] = useState<SpotifyState | null>(null);
    const [devices, setDevices] = useState<SpotifyDevice[]>([]);
    const [clusters, setClusters] = useState<SpotifyCluster[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<{ cluster: SpotifyCluster; albums: SpotifyAlbum[] } | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<SpotifyAlbumDetail | null>(null);
    const [albumOpen, setAlbumOpen] = useState(false);
    const [devicesOpen, setDevicesOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
    const [clusterName, setClusterName] = useState("");

    const refresh = async () => {
        try {
            setState(await apiFetch<SpotifyState>("/spotify/playing"));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to reach Spotify");
        }
    };

    const loadDevices = async () => {
        try {
            setDevices(await apiFetch<SpotifyDevice[]>("/spotify/devices"));
        } catch {
            setDevices([]);
        }
    };

    const loadClusters = async () => {
        try {
            setClusters(await apiFetch<SpotifyCluster[]>("/spotify/clusters"));
        } catch {
            setClusters([]);
        }
    };

    useEffect(() => {
        void refresh();
        const interval = window.setInterval(() => void refresh(), 5000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!state?.connected) return;
        void loadDevices();
        void loadClusters();
    }, [state?.connected]);

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

    const setShuffle = async (value: boolean) => {
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/shuffle?shuffle_state=${value}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Shuffle change failed");
        }
    };

    const setRepeat = async (value: "off" | "track" | "context") => {
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/repeat?repeat_state=${value}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Repeat change failed");
        }
    };

    const seek = async (positionMs: number) => {
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/seek?position_ms=${positionMs}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Seek failed");
        }
    };

    const setVolume = async (volume: number) => {
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/volume?volume_percent=${volume}`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Volume change failed");
        }
    };

    const transfer = async (deviceId: string) => {
        setBusy(true);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/devices/${deviceId}/transfer`, { method: "POST" }));
            await loadDevices();
            setDevicesOpen(false);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to transfer playback");
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
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Album sync failed");
        } finally {
            setSyncing(false);
        }
    };

    const openCluster = async (cluster: SpotifyCluster) => {
        try {
            setSelectedCluster({ cluster, albums: await apiFetch<SpotifyAlbum[]>(`/spotify/clusters/${cluster.id}`) });
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load cluster");
        }
    };

    const openAlbum = async (album: SpotifyAlbum) => {
        try {
            setSelectedAlbum(await apiFetch<SpotifyAlbumDetail>(`/spotify/albums/${album.id}`));
            setAlbumOpen(true);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load album");
        }
    };

    const playAlbum = async (album: SpotifyAlbum) => {
        setBusy(true);
        setPlayingId(album.id);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/albums/${album.id}/play`, { method: "POST" }));
            await refresh();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Album playback failed");
        } finally {
            setBusy(false);
            window.setTimeout(() => setPlayingId(null), 700);
        }
    };

    const playTrack = async (trackId: string) => {
        setBusy(true);
        try {
            setState(await apiFetch<SpotifyState>(`/spotify/tracks/${trackId}/play`, { method: "POST" }));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Track playback failed");
        } finally {
            setBusy(false);
        }
    };

    const renameCluster = async (cluster: SpotifyCluster) => {
        const name = clusterName.trim();
        if (!name) return;
        try {
            const renamed = await apiFetch<{ id: number; name: string }>(`/spotify/clusters/${cluster.id}/name`, { method: "PUT", body: JSON.stringify({ name }) });
            setClusters((current) => current.map((item) => item.id === renamed.id ? { ...item, name: renamed.name } : item));
            setEditingClusterId(null);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to rename cluster");
        }
    };

    if (!state) {
        return <main className="min-h-dvh bg-[#090a09] px-5 pt-5 pb-36 text-white"><div className="mx-auto max-w-md"><div className="h-8 w-32 animate-pulse rounded-full bg-white/10" /></div></main>;
    }

    if (!state.connected) {
        return (
            <main className="min-h-dvh bg-[#090a09] px-5 pt-5 pb-36 text-white">
                <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center text-center">
                    <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-[#1ed760]/10"><WifiOff className="size-8 text-[#1ed760]" /></div>
                    <h1 className="text-2xl font-bold">Connect Spotify</h1>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/55">Link your account to control playback and browse your saved music.</p>
                    <Button className="mt-7 h-12 rounded-full bg-[#1ed760] px-7 text-sm font-bold text-black hover:bg-[#1ed760]/90" onClick={() => void connect()}><Play className="size-4 fill-current" />Connect account</Button>
                    {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
                </div>
            </main>
        );
    }

    const current = state.current;

    return (
        <main className="min-h-dvh bg-[#090a09] px-4 pb-36 pt-5 text-white">
            <div className="mx-auto max-w-md">
                {selectedCluster ? (
                    <>
                        <header className="mb-5 flex items-center gap-3">
                            <button type="button" className="flex size-10 items-center justify-center rounded-full bg-white/7" onClick={() => setSelectedCluster(null)} aria-label="Back to library"><ArrowLeft className="size-5" /></button>
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Collection</p>
                                <h1 className="truncate text-xl font-bold">{selectedCluster.cluster.name}</h1>
                            </div>
                            <p className="text-xs text-white/45">{selectedCluster.albums.length} albums</p>
                        </header>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                            {selectedCluster.albums.map((album) => (
                                <article key={album.id} className="min-w-0">
                                    <button type="button" className="group relative block w-full text-left" onClick={() => void openAlbum(album)}>
                                        {album.cover_image ? <img src={album.cover_image} alt="" className="aspect-square w-full rounded-[18px] object-cover shadow-[0_12px_30px_rgba(0,0,0,.35)]" /> : <div className="aspect-square w-full rounded-[18px] bg-white/7" />}
                                        <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); void playAlbum(album); }} onKeyDown={(event) => { if (event.key === "Enter") void playAlbum(album); }} className="absolute bottom-2 right-2 flex size-11 items-center justify-center rounded-full bg-[#1ed760] text-black shadow-xl">
                                            {playingId === album.id ? <LoaderCircle className="size-5 animate-spin" /> : <Play className="ml-0.5 size-5 fill-current" />}
                                        </span>
                                    </button>
                                    <p className="mt-2.5 truncate text-sm font-bold">{album.name}</p>
                                    <p className="mt-0.5 truncate text-xs text-white/45">{album.artist}</p>
                                </article>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <header className="mb-5 flex items-end justify-between">
                            <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1ed760]">Now listening</p><h1 className="mt-1 text-[28px] font-bold leading-none tracking-tight">Spotify</h1></div>
                            <button type="button" disabled={syncing} className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5" onClick={() => void syncAlbums()} aria-label="Sync saved albums"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /></button>
                        </header>

                        <section className="relative mb-8 overflow-hidden rounded-[28px] border border-white/8 bg-[#151714] p-4 shadow-[0_18px_60px_rgba(0,0,0,.28)]">
                            {current?.album_image && <img src={current.album_image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-20 blur-3xl" />}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#151714]/30 to-[#151714]" />
                            {current ? (
                                <div className="relative z-10">
                                    <button type="button" className="mx-auto block w-[78%] max-w-[280px]" onClick={() => void setDevicesOpen(true)}>
                                        <img src={current.album_image || ""} alt={`${current.album} cover`} className="aspect-square w-full rounded-[20px] object-cover shadow-[0_18px_36px_rgba(0,0,0,.45)]" />
                                    </button>
                                    <div className="mt-5 px-1 text-center">
                                        <h2 className="truncate text-xl font-bold">{current.track}</h2>
                                        <p className="mt-1 truncate text-sm text-white/52">{current.artists}</p>
                                    </div>
                                    <div className="mt-5 px-1">
                                        <input aria-label="Track position" type="range" min={0} max={current.duration_ms || 0} value={current.progress_ms || 0} onChange={(event) => void seek(Number(event.target.value))} className="h-1 w-full accent-[#1ed760]" />
                                        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-white/40"><span>{formatTime(current.progress_ms)}</span><span>{formatTime(current.duration_ms)}</span></div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-center gap-5">
                                        <button type="button" className="text-white/60" aria-label="Shuffle" onClick={() => void setShuffle(!current.shuffle_state)}><Shuffle className={`size-5 ${current.shuffle_state ? "text-[#1ed760]" : ""}`} /></button>
                                        <button type="button" className="flex size-11 items-center justify-center" aria-label="Previous" disabled={busy} onClick={() => void control("previous")}><SkipBack className="size-7 fill-white" /></button>
                                        <button type="button" className="flex size-16 items-center justify-center rounded-full bg-white text-black shadow-xl" aria-label={current.is_playing ? "Pause" : "Play"} disabled={busy} onClick={() => void control(current.is_playing ? "pause" : "play")}>{current.is_playing ? <Pause className="size-7 fill-black" /> : <Play className="ml-1 size-7 fill-black" />}</button>
                                        <button type="button" className="flex size-11 items-center justify-center" aria-label="Next" disabled={busy} onClick={() => void control("next")}><SkipForward className="size-7 fill-white" /></button>
                                        <button type="button" className="text-white/60" aria-label="Repeat" onClick={() => void setRepeat(current.repeat_state === "off" ? "context" : current.repeat_state === "context" ? "track" : "off")}>{current.repeat_state === "track" ? <Repeat1 className="size-5 text-[#1ed760]" /> : <Repeat className={`size-5 ${current.repeat_state === "context" ? "text-[#1ed760]" : ""}`} />}</button>
                                    </div>
                                    <button type="button" className="mt-4 flex h-11 w-full items-center gap-2 rounded-full bg-white/6 px-3 text-left" onClick={() => setDevicesOpen(true)}>
                                        <DeviceIcon type={current.device_type} className="size-4 text-[#1ed760]" />
                                        <span className="min-w-0 flex-1 truncate text-xs text-white/70">{current.device || "Choose a device"}</span>
                                        <Volume2 className="size-4 text-white/40" />
                                        <span className="w-8 text-right text-[11px] text-white/45">{current.volume_percent ?? "-"}%</span>
                                    </button>
                                    <input aria-label="Volume" type="range" min={0} max={100} value={current.volume_percent ?? 50} onChange={(event) => void setVolume(Number(event.target.value))} className="mt-3 h-1 w-full accent-[#1ed760]" />
                                </div>
                            ) : (
                                <div className="relative z-10 flex min-h-[360px] flex-col items-center justify-center text-center">
                                    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-white/7"><Pause className="size-7 text-white/45" /></div>
                                    <h2 className="text-lg font-bold">Nothing playing</h2>
                                    <p className="mt-1 text-sm text-white/45">Choose a device or play an album below.</p>
                                    {devices.length > 0 && <button type="button" className="mt-5 rounded-full bg-[#1ed760] px-5 py-3 text-sm font-bold text-black" onClick={() => setDevicesOpen(true)}>Choose device</button>}
                                </div>
                            )}
                        </section>

                        <section>
                            <div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Your library</p><h2 className="mt-1 text-lg font-bold">Album mixes</h2></div>{clusters.length > 0 && <span className="text-xs text-white/40">{clusters.length} collections</span>}</div>
                            {clusters.length === 0 ? (
                                <button type="button" onClick={() => void syncAlbums()} className="flex h-28 w-full items-center gap-4 rounded-[20px] border border-dashed border-white/12 px-5 text-left"><RefreshCw className={`size-5 text-[#1ed760] ${syncing ? "animate-spin" : ""}`} /><div><p className="text-sm font-bold">Build your album mixes</p><p className="mt-1 text-xs text-white/45">Sync saved albums to start</p></div></button>
                            ) : (
                                <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
                                    {clusters.map((cluster) => (
                                        <div key={cluster.id} className="group relative h-36 w-36 shrink-0 overflow-hidden rounded-[20px] bg-white/7">
                                            <button type="button" className="absolute inset-0 text-left" onClick={() => void openCluster(cluster)}>
                                                {cluster.cover_image && <img src={cluster.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10" />
                                            </button>
                                            {editingClusterId === cluster.id ? <div className="absolute inset-x-2 bottom-2 z-10 flex items-center gap-1 rounded-lg bg-black/80 p-1"><input autoFocus value={clusterName} onChange={(event) => setClusterName(event.target.value)} className="min-w-0 flex-1 bg-transparent px-1 text-xs text-white outline-none" /><button type="button" onClick={() => void renameCluster(cluster)}><Check className="size-4" /></button><button type="button" onClick={() => setEditingClusterId(null)}><X className="size-4" /></button></div> : <><button type="button" className="absolute inset-x-0 bottom-0 z-[5] p-3 text-left" onClick={() => void openCluster(cluster)}><p className="truncate text-sm font-bold text-white">{cluster.name}</p><p className="mt-0.5 text-[10px] text-white/60">{cluster.count} albums</p></button><button type="button" className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/50" onClick={() => { setEditingClusterId(cluster.id); setClusterName(cluster.name); }} aria-label={`Rename ${cluster.name}`}><Pencil className="size-3.5" /></button></>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {error && <p className="mt-4 text-center text-xs text-red-400">{error}</p>}
            </div>

            <Dialog open={devicesOpen} onOpenChange={setDevicesOpen}>
                <DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 rounded-b-none rounded-t-[28px] border-x-0 border-b-0 px-5 pb-8 pt-5">
                    <DialogHeader><DialogTitle>Choose a device</DialogTitle><DialogDescription>Playback can start directly on an available phone or speaker.</DialogDescription></DialogHeader>
                    <div className="mt-2 space-y-2">
                        {devices.map((device) => <button key={device.id} type="button" disabled={busy} onClick={() => void transfer(device.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left"><DeviceIcon type={device.type} className="size-5 text-[#1ed760]" /><span className="min-w-0 flex-1 text-sm font-semibold">{device.name}</span>{device.is_active && <span className="text-[10px] font-bold uppercase tracking-wider text-[#1ed760]">Active</span>}</button>)}
                        {devices.length === 0 && <p className="py-6 text-center text-sm text-white/45">No active Spotify devices found.</p>}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={albumOpen} onOpenChange={setAlbumOpen}>
                {selectedAlbum && <DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 max-h-[88dvh] overflow-y-auto rounded-b-none rounded-t-[28px] border-x-0 border-b-0 px-5 pb-8 pt-5">
                    <DialogHeader><DialogTitle className="pr-10">{selectedAlbum.name}</DialogTitle><DialogDescription>{selectedAlbum.artist}</DialogDescription></DialogHeader>
                    <div className="mt-4">
                        {selectedAlbum.cover_image && <img src={selectedAlbum.cover_image} alt={`${selectedAlbum.name} cover`} className="mx-auto aspect-square w-[72%] max-w-[260px] rounded-[20px] object-cover shadow-2xl" />}
                        <div className="mt-5 flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-wider text-white/40">Released</p><p className="mt-1 text-sm font-semibold">{selectedAlbum.release_date || "Unknown"}</p></div><Button size="sm" className="h-11 rounded-full bg-[#1ed760] px-5 font-bold text-black hover:bg-[#1ed760]/90" onClick={() => void playAlbum({ id: selectedAlbum.id, name: selectedAlbum.name, artist: selectedAlbum.artist, cover_image: selectedAlbum.cover_image })}>{playingId === selectedAlbum.id ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}Play album</Button></div>
                        <div className="mt-5 border-t border-white/8 pt-2">
                            {selectedAlbum.tracks.map((track) => <button key={track.id ?? track.track_number} type="button" disabled={busy || !track.id} onClick={() => track.id && void playTrack(track.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-white/5"><span className="w-5 text-right text-xs text-white/35">{track.track_number}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{track.name}{track.explicit && <span className="ml-2 text-[9px] text-white/35">E</span>}</span><span className="text-xs tabular-nums text-white/35">{formatTime(track.duration_ms)}</span></button>)}
                        </div>
                    </div>
                </DialogContent>}
            </Dialog>
        </main>
    );
}
