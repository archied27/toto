import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Laptop2, LoaderCircle, Pause, Pencil, Play, RefreshCw, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Smartphone, Volume2, WifiOff, Check, X } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDominantColor } from "@/plugins/media/utils";

interface Track { track_id?: string; is_playing: boolean; track: string; artists: string; album: string; album_image?: string | null; device?: string | null; device_type?: string | null; volume_percent?: number | null; progress_ms?: number; duration_ms?: number; shuffle_state?: boolean; repeat_state?: "off" | "track" | "context" }
interface Device { id: string; name: string; type: string; is_active: boolean }
interface State { connected: boolean; current: Track | null }
interface Album { id: string; name: string; artist: string; cover_image?: string | null; release_date?: string | null }
interface Cluster { id: number; name: string; count: number; cover_image?: string | null }
interface AlbumDetail extends Album { tracks: Array<{ id: string | null; name: string; duration_ms: number; track_number: number; explicit: boolean }> }

function DeviceIcon({ type }: { type?: string | null }) { return type === "computer" ? <Laptop2 className="size-4" /> : <Smartphone className="size-4" /> }
function time(ms = 0) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }

function AlbumGridCard({ album, playing, onOpen, onPlay }: { album: Album; playing: boolean; onOpen: () => void; onPlay: () => void }) {
    const dominantColor = useDominantColor(album.cover_image || undefined);
    return (
        <article className="relative min-w-0">
            <button type="button" className="relative block w-full overflow-hidden rounded-lg text-left" style={dominantColor ? { background: `radial-gradient(circle at 50% 20%, ${dominantColor}55, #18181b 78%)` } : undefined} onClick={onOpen}>
                {album.cover_image ? <img src={album.cover_image} alt={`${album.name} cover`} className="aspect-square w-full p-3 pb-2 object-cover" /> : <div className="aspect-square w-full bg-white/5" />}
                <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onPlay(); }} onKeyDown={(event) => { if (event.key === "Enter") onPlay(); }} className="absolute bottom-4 right-4 flex size-10 items-center justify-center rounded-full border border-white/10 bg-[#f4f4f5] text-[#18181b] shadow-xl">
                    {playing ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="ml-0.5 size-4 fill-current" />}
                </span>
            </button>
            <p className="mt-2.5 truncate text-[13px] font-semibold">{album.name}</p>
            <p className="mt-0.5 truncate text-xs text-[#77777f]">{album.artist}</p>
        </article>
    );
}

function ClusterCard({ cluster, editing, clusterName, onOpen, onRename, onSaveName, onCancelEdit, onNameChange }: { cluster: Cluster; editing: boolean; clusterName: string; onOpen: () => void; onRename: () => void; onSaveName: () => void; onCancelEdit: () => void; onNameChange: (value: string) => void }) {
    const dominantColor = useDominantColor(cluster.cover_image || undefined);
    return (
        <article className="overflow-hidden rounded-lg border border-white/8" style={dominantColor ? { background: `linear-gradient(145deg, ${dominantColor}38, #18181b 72%)` } : { background: "#18181b" }}>
            <button type="button" className="block w-full text-left" onClick={onOpen}>{cluster.cover_image ? <img src={cluster.cover_image} alt="" className="aspect-square w-full object-cover p-2 pb-0" /> : <div className="aspect-square w-full bg-white/5" />}</button>
            {editing ? <div className="flex items-center gap-1 p-2"><input autoFocus value={clusterName} onChange={(event) => onNameChange(event.target.value)} className="min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white" /><button type="button" onClick={onSaveName}><Check className="size-4" /></button><button type="button" onClick={onCancelEdit}><X className="size-4" /></button></div> : <div className="flex items-center gap-2 px-2.5 py-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}><p className="truncate text-sm font-semibold">{cluster.name}</p><p className="mt-0.5 text-xs text-white/45">{cluster.count} albums</p></button><button type="button" className="flex size-8 items-center justify-center rounded-md text-white/45" onClick={onRename} aria-label={`Rename ${cluster.name}`}><Pencil className="size-3.5" /></button></div>}
        </article>
    );
}

export function SpotifyDarkPage() {
    const [state, setState] = useState<State | null>(null);
    const [devices, setDevices] = useState<Device[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<{ cluster: Cluster; albums: Album[] } | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetail | null>(null);
    const [albumOpen, setAlbumOpen] = useState(false);
    const [devicesOpen, setDevicesOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [clusterName, setClusterName] = useState("");
    const [progressMs, setProgressMs] = useState(0);
    const progressRef = useRef(0);
    const progressTrackRef = useRef("");
    const currentCoverColor = useDominantColor(state?.current?.album_image || undefined);

    const refresh = async () => {
        try { setState(await apiFetch<State>("/spotify/playing")); setError(null); }
        catch (e) { setError(e instanceof Error ? e.message : "Unable to reach Spotify"); }
    };
    const loadDevices = async () => { try { setDevices(await apiFetch<Device[]>("/spotify/devices")); } catch { setDevices([]); } };
    const loadClusters = async () => { try { setClusters(await apiFetch<Cluster[]>("/spotify/clusters")); } catch { setClusters([]); } };

    useEffect(() => { void refresh(); const interval = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(interval); }, []);
    useEffect(() => { if (!state?.connected) return; void loadDevices(); void loadClusters(); }, [state?.connected]);

    useEffect(() => {
        const current = state?.current;
        if (!current) { setProgressMs(0); progressRef.current = 0; progressTrackRef.current = ""; return; }
        const trackKey = current.track_id || current.track;
        const serverPosition = current.progress_ms || 0;
        if (progressTrackRef.current !== trackKey) {
            progressTrackRef.current = trackKey;
            progressRef.current = serverPosition;
            setProgressMs(serverPosition);
            return;
        }
        const difference = Math.abs(progressRef.current - serverPosition);
        if (difference > 1500) {
            progressRef.current = serverPosition;
            setProgressMs(serverPosition);
        }
    }, [state?.current?.track_id, state?.current?.track, state?.current?.progress_ms]);

    useEffect(() => {
        const current = state?.current;
        if (!current?.is_playing) return;
        const duration = current.duration_ms || 0;
        const interval = window.setInterval(() => {
            progressRef.current = duration > 0 ? Math.min(progressRef.current + 250, duration) : progressRef.current + 250;
            setProgressMs(progressRef.current);
        }, 250);
        return () => window.clearInterval(interval);
    }, [state?.current?.is_playing, state?.current?.track_id, state?.current?.track, state?.current?.duration_ms]);

    const connect = async () => { try { window.location.href = (await apiFetch<{ authorization_url: string }>("/spotify/connect")).authorization_url; } catch (e) { setError(e instanceof Error ? e.message : "Spotify is not configured"); } };
    const control = async (action: "previous" | "play" | "pause" | "next") => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/control/${action}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Playback control failed"); } finally { setBusy(false); } };
    const setShuffle = async (value: boolean) => { try { setState(await apiFetch<State>(`/spotify/shuffle?shuffle_state=${value}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Shuffle change failed"); } };
    const setRepeat = async (value: "off" | "track" | "context") => { try { setState(await apiFetch<State>(`/spotify/repeat?repeat_state=${value}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Repeat change failed"); } };
    const seek = async (positionMs: number) => { try { setState(await apiFetch<State>(`/spotify/seek?position_ms=${positionMs}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Seek failed"); } };
    const setVolume = async (volume: number) => { try { setState(await apiFetch<State>(`/spotify/volume?volume_percent=${volume}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Volume change failed"); } };
    const transfer = async (deviceId: string) => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/devices/${deviceId}/transfer`, { method: "POST" })); await loadDevices(); setDevicesOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "Unable to transfer playback"); } finally { setBusy(false); } };

    const syncAlbums = async () => { setSyncing(true); try { const result = await apiFetch<{ clusters: Cluster[] }>("/spotify/albums/sync", { method: "POST" }); setClusters(result.clusters); setSelectedCluster(null); } catch (e) { setError(e instanceof Error ? e.message : "Album sync failed"); } finally { setSyncing(false); } };
    const openCluster = async (cluster: Cluster) => { try { setSelectedCluster({ cluster, albums: await apiFetch<Album[]>(`/spotify/clusters/${cluster.id}`) }); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load collection"); } };
    const openAlbum = async (album: Album) => { try { setSelectedAlbum(await apiFetch<AlbumDetail>(`/spotify/albums/${album.id}`)); setAlbumOpen(true); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load album"); } };
    const playAlbum = async (album: Album) => { setBusy(true); setPlayingId(album.id); try { setState(await apiFetch<State>(`/spotify/albums/${album.id}/play`, { method: "POST" })); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Album playback failed"); } finally { setBusy(false); window.setTimeout(() => setPlayingId(null), 700); } };
    const playTrack = async (trackId: string) => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/tracks/${trackId}/play`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Track playback failed"); } finally { setBusy(false); } };
    const renameCluster = async (cluster: Cluster) => { const name = clusterName.trim(); if (!name) return; try { const renamed = await apiFetch<{ id: number; name: string }>(`/spotify/clusters/${cluster.id}/name`, { method: "PUT", body: JSON.stringify({ name }) }); setClusters((items) => items.map((item) => item.id === renamed.id ? { ...item, name: renamed.name } : item)); setEditingId(null); } catch (e) { setError(e instanceof Error ? e.message : "Unable to rename collection"); } };

    if (!state) return <main className="min-h-dvh bg-[#111113] px-4 pt-5 text-[#f4f4f5]"><div className="mx-auto max-w-md"><div className="h-7 w-28 animate-pulse rounded-md bg-white/5" /></div></main>;

    if (!state.connected) return <main className="min-h-dvh bg-[#111113] px-5 pt-5 pb-36 text-[#f4f4f5]"><div className="mx-auto flex min-h-[68dvh] max-w-md flex-col items-center justify-center text-center"><div className="mb-5 flex size-11 items-center justify-center rounded-md border border-white/8 bg-white/[0.035]"><WifiOff className="size-5 text-[#a1a1aa]" /></div><h1 className="text-lg font-semibold">Connect Spotify</h1><p className="mt-2 max-w-xs text-sm leading-6 text-[#8b8b92]">Link your account to control playback and your library.</p><Button className="mt-6 h-10 rounded-md bg-[#ededf0] px-4 text-sm text-[#18181b] hover:bg-white" onClick={() => void connect()}><Play className="size-4 fill-current" />Connect account</Button>{error && <p className="mt-4 text-sm text-red-400">{error}</p>}</div></main>;

    const current = state.current;

    return (
        <main className="min-h-dvh bg-[#111113] px-4 pb-36 pt-5 text-[#f4f4f5]">
            <div className="mx-auto max-w-md">
                {selectedCluster ? (
                    <>
                        <header className="mb-5 flex items-center gap-3"><button type="button" className="flex size-9 items-center justify-center rounded-md border border-white/8 bg-white/[0.035]" onClick={() => setSelectedCluster(null)} aria-label="Back"><ArrowLeft className="size-4" /></button><div className="min-w-0 flex-1"><p className="text-[10px] text-[#77777f]">Collection</p><h1 className="truncate text-lg font-semibold">{selectedCluster.cluster.name}</h1></div><span className="text-xs text-[#77777f]">{selectedCluster.albums.length}</span></header>
                        <div className="grid grid-cols-2 gap-3">{selectedCluster.albums.map((album) => <AlbumGridCard key={album.id} album={album} playing={playingId === album.id} onOpen={() => void openAlbum(album)} onPlay={() => void playAlbum(album)} />)}</div>
                    </>
                ) : (
                    <>
                        <header className="mb-5 flex items-center justify-between"><div><p className="hidden">Library</p><h1 className="text-[22px] font-semibold tracking-tight">Spotify</h1></div><button type="button" disabled={syncing} className="flex size-9 items-center justify-center rounded-md border border-white/8 bg-white/[0.035]" onClick={() => void syncAlbums()} aria-label="Sync saved albums"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /></button></header>

                        <section className="mb-7 border-b border-white/8 pb-5" style={current && currentCoverColor ? { background: `radial-gradient(circle at 12% 12%, ${currentCoverColor}35, transparent 42%)` } : undefined}>
                            {current ? <><div className="flex items-end gap-4"><button type="button" className="shrink-0" onClick={() => setDevicesOpen(true)}>{current.album_image ? <img src={current.album_image} alt="" className="size-28 rounded-lg object-cover shadow-2xl" /> : <div className="size-28 rounded-lg bg-white/5" />}</button><div className="min-w-0 flex-1 pb-1"><p className="truncate text-[15px] font-semibold">{current.track}</p><p className="mt-1 truncate text-sm text-[#b1b1b8]">{current.artists}</p><button type="button" onClick={() => setDevicesOpen(true)} className="mt-3 flex items-center gap-1.5 text-xs text-[#77777f]"><DeviceIcon type={current.device_type} /><span className="truncate">{current.device || "Choose device"}</span></button></div></div>
                            <div className="mt-5"><input aria-label="Track position" type="range" min={0} max={current.duration_ms || 0} value={progressMs} onChange={(e) => { const value = Number(e.target.value); progressRef.current = value; setProgressMs(value); }} onPointerUp={() => void seek(progressRef.current)} onKeyUp={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") void seek(progressRef.current); }} className="h-1 w-full cursor-pointer accent-[#b9b9ff]" /><div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-[#77777f]"><span>{time(progressMs)}</span><span>{time(current.duration_ms)}</span></div></div>
                            <div className="mt-3 flex items-center justify-between"><button type="button" className="flex size-9 items-center justify-center text-[#77777f]" aria-label="Shuffle" onClick={() => void setShuffle(!current.shuffle_state)}><Shuffle className={`size-4 ${current.shuffle_state ? "text-[#b9b9ff]" : ""}`} /></button><button type="button" className="flex size-9 items-center justify-center" aria-label="Previous" disabled={busy} onClick={() => void control("previous")}><SkipBack className="size-5 fill-[#f4f4f5]" /></button><button type="button" className="flex size-12 items-center justify-center rounded-full bg-[#f4f4f5] text-[#18181b]" aria-label={current.is_playing ? "Pause" : "Play"} disabled={busy} onClick={() => void control(current.is_playing ? "pause" : "play")}>{current.is_playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}</button><button type="button" className="flex size-9 items-center justify-center" aria-label="Next" disabled={busy} onClick={() => void control("next")}><SkipForward className="size-5 fill-[#f4f4f5]" /></button><button type="button" className="flex size-9 items-center justify-center text-[#77777f]" aria-label="Repeat" onClick={() => void setRepeat(current.repeat_state === "off" ? "context" : current.repeat_state === "context" ? "track" : "off")}>{current.repeat_state === "track" ? <Repeat1 className="size-4 text-[#b9b9ff]" /> : <Repeat className={`size-4 ${current.repeat_state === "context" ? "text-[#b9b9ff]" : ""}`} />}</button></div>
                            <div className="mt-4 flex items-center gap-2"><Volume2 className="size-4 text-[#77777f]" /><input aria-label="Volume" type="range" min={0} max={100} value={current.volume_percent ?? 50} onChange={(e) => void setVolume(Number(e.target.value))} className="h-1 min-w-0 flex-1 accent-[#b9b9ff]" /><span className="w-8 text-right text-[10px] tabular-nums text-[#77777f]">{current.volume_percent ?? "-"}%</span></div></> : <button type="button" onClick={() => setDevicesOpen(true)} className="flex min-h-28 w-full items-center gap-3 text-left"><div className="flex size-11 items-center justify-center rounded-md border border-white/8"><Pause className="size-5 text-[#77777f]" /></div><div><p className="text-sm font-semibold">Nothing playing</p><p className="mt-1 text-xs text-[#77777f]">Choose a device to begin</p></div></button>}
                        </section>

                        <section><div className="mb-3 flex items-end justify-between"><div><p className="hidden">Saved library</p><h2 className="text-base font-semibold">Album collections</h2></div>{clusters.length > 0 && <span className="text-xs text-[#77777f]">{clusters.length}</span>}</div>{clusters.length === 0 ? <button type="button" onClick={() => void syncAlbums()} className="flex h-16 w-full items-center gap-3 border-t border-b border-white/8 text-left"><RefreshCw className={`size-4 text-[#77777f] ${syncing ? "animate-spin" : ""}`} /><div><p className="text-sm font-medium">Sync saved albums</p><p className="mt-0.5 text-xs text-[#77777f]">Build collections from your library</p></div></button> : <div className="grid grid-cols-2 gap-3">{clusters.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} editing={editingId === cluster.id} clusterName={clusterName} onOpen={() => void openCluster(cluster)} onRename={() => setEditingId(cluster.id)} onSaveName={() => void renameCluster(cluster)} onCancelEdit={() => setEditingId(null)} onNameChange={setClusterName} />)}</div>}</section>
                    </>
                )}
                {error && <p className="mt-4 text-center text-xs text-red-400">{error}</p>}
            </div>

            <Dialog open={devicesOpen} onOpenChange={setDevicesOpen}><DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 rounded-b-none rounded-t-xl border-x-0 border-b-0 bg-[#18181b] px-5 pb-8 pt-5 text-[#f4f4f5]"><DialogHeader><DialogTitle>Playback device</DialogTitle><DialogDescription>Choose where Spotify should play.</DialogDescription></DialogHeader><div className="mt-3 space-y-1">{devices.map((device) => <button key={device.id} type="button" disabled={busy} onClick={() => void transfer(device.id)} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-white/5"><DeviceIcon type={device.type} /><span className="min-w-0 flex-1 text-sm font-medium">{device.name}</span>{device.is_active && <span className="text-[10px] text-[#b9b9ff]">Active</span>}</button>)}</div></DialogContent></Dialog>

            <Dialog open={albumOpen} onOpenChange={setAlbumOpen}>{selectedAlbum && <DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 max-h-[88dvh] overflow-y-auto rounded-b-none rounded-t-xl border-x-0 border-b-0 bg-[#18181b] px-5 pb-8 pt-5 text-[#f4f4f5]"><DialogHeader><DialogTitle>{selectedAlbum.name}</DialogTitle><DialogDescription>{selectedAlbum.artist}</DialogDescription></DialogHeader><div className="mt-4">{selectedAlbum.cover_image && <img src={selectedAlbum.cover_image} alt="" className="mx-auto aspect-square w-[68%] max-w-[240px] rounded-md object-cover" />}<div className="mt-5 flex items-center justify-between"><div><p className="text-[10px] text-[#77777f]">Released</p><p className="mt-0.5 text-sm">{selectedAlbum.release_date || "Unknown"}</p></div><Button size="sm" className="h-9 rounded-md bg-[#f4f4f5] text-[#18181b] hover:bg-white" onClick={() => void playAlbum({ id: selectedAlbum.id, name: selectedAlbum.name, artist: selectedAlbum.artist, cover_image: selectedAlbum.cover_image })}>{playingId === selectedAlbum.id ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}Play album</Button></div><div className="mt-5 border-t border-white/8">{selectedAlbum.tracks.map((track) => <button key={track.id ?? track.track_number} type="button" disabled={busy || !track.id} onClick={() => track.id && void playTrack(track.id)} className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-white/[0.035]"><span className="w-5 text-right text-xs text-[#77777f]">{track.track_number}</span><span className="min-w-0 flex-1 truncate text-sm">{track.name}{track.explicit && <span className="ml-2 text-[9px] text-[#77777f]">E</span>}</span><span className="text-xs tabular-nums text-[#77777f]">{time(track.duration_ms)}</span></button>)}</div></div></DialogContent>}</Dialog>
        </main>
    );
}
