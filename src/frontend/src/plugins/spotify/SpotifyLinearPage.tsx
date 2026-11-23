import { useEffect, useState } from "react";
import { ArrowLeft, Laptop2, LoaderCircle, Pause, Pencil, Play, RefreshCw, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Smartphone, Volume2, WifiOff, Check, X } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Track { is_playing: boolean; track: string; artists: string; album: string; album_image?: string | null; device?: string | null; device_type?: string | null; volume_percent?: number | null; progress_ms?: number; duration_ms?: number; shuffle_state?: boolean; repeat_state?: "off" | "track" | "context" }
interface Device { id: string; name: string; type: string; is_active: boolean }
interface State { connected: boolean; current: Track | null }
interface Album { id: string; name: string; artist: string; cover_image?: string | null; release_date?: string | null }
interface Cluster { id: number; name: string; count: number; cover_image?: string | null }
interface AlbumDetail extends Album { label?: string | null; tracks: Array<{ id: string | null; name: string; duration_ms: number; track_number: number; explicit: boolean }> }

function DeviceIcon({ type }: { type?: string | null }) { return type === "computer" ? <Laptop2 className="size-4" /> : <Smartphone className="size-4" /> }
function time(ms = 0) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }

export function SpotifyLinearPage() {
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

    const refresh = async () => { try { setState(await apiFetch<State>("/spotify/playing")); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Unable to reach Spotify"); } };
    const loadDevices = async () => { try { setDevices(await apiFetch<Device[]>("/spotify/devices")); } catch { setDevices([]); } };
    const loadClusters = async () => { try { setClusters(await apiFetch<Cluster[]>("/spotify/clusters")); } catch { setClusters([]); } };

    useEffect(() => { void refresh(); const interval = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(interval); }, []);
    useEffect(() => { if (!state?.connected) return; void loadDevices(); void loadClusters(); }, [state?.connected]);

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

    if (!state) return <main className="min-h-dvh bg-[#f7f7f5] px-4 pt-5 text-[#1d1d1f]"><div className="mx-auto max-w-md"><div className="h-7 w-28 animate-pulse rounded bg-[#e6e6e2]" /></div></main>;

    if (!state.connected) return <main className="min-h-dvh bg-[#f7f7f5] px-5 pt-5 pb-36 text-[#1d1d1f]"><div className="mx-auto flex min-h-[68dvh] max-w-md flex-col items-center justify-center text-center"><div className="mb-5 flex size-12 items-center justify-center rounded-lg border border-[#e1e1dc] bg-white"><WifiOff className="size-5 text-[#77776f]" /></div><h1 className="text-xl font-semibold">Connect Spotify</h1><p className="mt-2 max-w-xs text-sm leading-6 text-[#77776f]">Link your account to control playback and browse your saved music.</p><Button className="mt-6 h-10 rounded-md bg-[#1d1d1f] px-4 text-sm text-white hover:bg-[#34343a]" onClick={() => void connect()}><Play className="size-4 fill-current" />Connect account</Button>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}</div></main>;

    const current = state.current;

    return (
        <main className="min-h-dvh bg-[#f7f7f5] px-4 pb-36 pt-5 text-[#1d1d1f]">
            <div className="mx-auto max-w-md">
                {selectedCluster ? (
                    <>
                        <header className="mb-5 flex items-center gap-3">
                            <button type="button" className="flex size-9 items-center justify-center rounded-md border border-[#e1e1dc] bg-white" onClick={() => setSelectedCluster(null)} aria-label="Back to collections"><ArrowLeft className="size-4" /></button>
                            <div className="min-w-0 flex-1"><p className="text-[11px] font-medium text-[#77776f]">Collection</p><h1 className="truncate text-lg font-semibold">{selectedCluster.cluster.name}</h1></div>
                            <span className="text-xs text-[#77776f]">{selectedCluster.albums.length}</span>
                        </header>
                        <div className="grid grid-cols-2 gap-3">
                            {selectedCluster.albums.map((album) => <article key={album.id} className="min-w-0 overflow-hidden rounded-lg border border-[#e3e3df] bg-white">
                                <button type="button" className="relative block w-full text-left" onClick={() => void openAlbum(album)}>
                                    {album.cover_image ? <img src={album.cover_image} alt="" className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-[#efefec]" />}
                                    <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); void playAlbum(album); }} onKeyDown={(e) => { if (e.key === "Enter") void playAlbum(album); }} className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-md border border-black/10 bg-white shadow-sm">{playingId === album.id ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="ml-0.5 size-4 fill-current" />}</span>
                                </button>
                                <div className="px-3 py-2.5"><p className="truncate text-[13px] font-semibold">{album.name}</p><p className="mt-0.5 truncate text-xs text-[#77776f]">{album.artist}</p></div>
                            </article>)}
                        </div>
                    </>
                ) : (
                    <>
                        <header className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-medium text-[#77776f]">Library</p><h1 className="mt-0.5 text-[22px] font-semibold tracking-tight">Spotify</h1></div><button type="button" disabled={syncing} className="flex size-9 items-center justify-center rounded-md border border-[#e1e1dc] bg-white" onClick={() => void syncAlbums()} aria-label="Sync saved albums"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /></button></header>

                        <section className="mb-6 rounded-lg border border-[#e1e1dc] bg-white">
                            {current ? <div className="p-3">
                                <div className="flex items-center gap-3">
                                    <button type="button" className="shrink-0" onClick={() => setDevicesOpen(true)}>{current.album_image ? <img src={current.album_image} alt="" className="size-20 rounded-md border border-black/5 object-cover" /> : <div className="size-20 rounded-md bg-[#efefec]" />}</button>
                                    <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{current.track}</p><p className="mt-1 truncate text-sm text-[#77776f]">{current.artists}</p><button type="button" onClick={() => setDevicesOpen(true)} className="mt-3 flex items-center gap-1.5 text-xs text-[#77776f]"><DeviceIcon type={current.device_type} /><span className="truncate">{current.device || "Choose device"}</span></button></div>
                                </div>
                                <div className="mt-4"><input aria-label="Track position" type="range" min={0} max={current.duration_ms || 0} value={current.progress_ms || 0} onChange={(e) => void seek(Number(e.target.value))} className="h-1 w-full accent-[#5b5bd6]" /><div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#96968e]"><span>{time(current.progress_ms)}</span><span>{time(current.duration_ms)}</span></div></div>
                                <div className="mt-3 flex items-center justify-center gap-1">
                                    <button type="button" className="flex size-9 items-center justify-center text-[#77776f]" aria-label="Shuffle" onClick={() => void setShuffle(!current.shuffle_state)}><Shuffle className={`size-4 ${current.shuffle_state ? "text-[#5b5bd6]" : ""}`} /></button>
                                    <button type="button" className="flex size-10 items-center justify-center" aria-label="Previous" disabled={busy} onClick={() => void control("previous")}><SkipBack className="size-5 fill-[#1d1d1f]" /></button>
                                    <button type="button" className="flex size-12 items-center justify-center rounded-full bg-[#1d1d1f] text-white" aria-label={current.is_playing ? "Pause" : "Play"} disabled={busy} onClick={() => void control(current.is_playing ? "pause" : "play")}>{current.is_playing ? <Pause className="size-5 fill-white" /> : <Play className="ml-0.5 size-5 fill-white" />}</button>
                                    <button type="button" className="flex size-10 items-center justify-center" aria-label="Next" disabled={busy} onClick={() => void control("next")}><SkipForward className="size-5 fill-[#1d1d1f]" /></button>
                                    <button type="button" className="flex size-9 items-center justify-center text-[#77776f]" aria-label="Repeat" onClick={() => void setRepeat(current.repeat_state === "off" ? "context" : current.repeat_state === "context" ? "track" : "off")}>{current.repeat_state === "track" ? <Repeat1 className="size-4 text-[#5b5bd6]" /> : <Repeat className={`size-4 ${current.repeat_state === "context" ? "text-[#5b5bd6]" : ""}`} />}</button>
                                </div>
                                <div className="mt-3 flex items-center gap-2 border-t border-[#ededE9] pt-3"><Volume2 className="size-4 text-[#77776f]" /><input aria-label="Volume" type="range" min={0} max={100} value={current.volume_percent ?? 50} onChange={(e) => void setVolume(Number(e.target.value))} className="h-1 min-w-0 flex-1 accent-[#5b5bd6]" /><span className="w-8 text-right text-[11px] tabular-nums text-[#77776f]">{current.volume_percent ?? "-"}%</span></div>
                            </div> : <button type="button" onClick={() => setDevicesOpen(true)} className="flex min-h-36 w-full items-center gap-3 p-4 text-left"><div className="flex size-11 items-center justify-center rounded-md border border-[#e1e1dc]"><Pause className="size-5 text-[#77776f]" /></div><div><p className="text-sm font-semibold">Nothing playing</p><p className="mt-1 text-xs text-[#77776f]">Choose a device to begin</p></div></button>}
                        </section>

                        <section>
                            <div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-medium text-[#77776f]">Saved library</p><h2 className="mt-0.5 text-base font-semibold">Album collections</h2></div>{clusters.length > 0 && <span className="text-xs text-[#77776f]">{clusters.length}</span>}</div>
                            {clusters.length === 0 ? <button type="button" onClick={() => void syncAlbums()} className="flex h-20 w-full items-center gap-3 rounded-lg border border-dashed border-[#d8d8d2] bg-white px-4 text-left"><RefreshCw className={`size-4 text-[#77776f] ${syncing ? "animate-spin" : ""}`} /><div><p className="text-sm font-semibold">Sync saved albums</p><p className="mt-0.5 text-xs text-[#77776f]">Build collections from your library</p></div></button> : <div className="overflow-hidden rounded-lg border border-[#e1e1dc] bg-white">
                                {clusters.map((cluster) => <div key={cluster.id} className="flex items-center gap-3 border-b border-[#ededE9] px-3 py-2.5 last:border-b-0">
                                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void openCluster(cluster)}>{cluster.cover_image ? <img src={cluster.cover_image} alt="" className="size-10 rounded-md object-cover" /> : <div className="size-10 rounded-md bg-[#efefec]" />}<div className="min-w-0"><p className="truncate text-sm font-semibold">{cluster.name}</p><p className="mt-0.5 text-xs text-[#77776f]">{cluster.count} albums</p></div></button>
                                    {editingId === cluster.id ? <div className="flex items-center gap-1"><input autoFocus value={clusterName} onChange={(e) => setClusterName(e.target.value)} className="w-28 rounded border border-[#d8d8d2] bg-white px-2 py-1 text-xs" /><button type="button" onClick={() => void renameCluster(cluster)}><Check className="size-4" /></button><button type="button" onClick={() => setEditingId(null)}><X className="size-4" /></button></div> : <button type="button" className="flex size-8 items-center justify-center rounded-md text-[#77776f] hover:bg-[#f2f2ef]" onClick={() => { setEditingId(cluster.id); setClusterName(cluster.name); }} aria-label={`Rename ${cluster.name}`}><Pencil className="size-3.5" /></button>}
                                </div>)}
                            </div>}
                        </section>
                    </>
                )}
                {error && <p className="mt-4 text-center text-xs text-red-600">{error}</p>}
            </div>

            <Dialog open={devicesOpen} onOpenChange={setDevicesOpen}><DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 rounded-b-none rounded-t-xl border-x-0 border-b-0 bg-[#fdfdfc] px-5 pb-8 pt-5 text-[#1d1d1f]"><DialogHeader><DialogTitle>Playback device</DialogTitle><DialogDescription>Choose where Spotify should play.</DialogDescription></DialogHeader><div className="mt-3 space-y-1">{devices.map((device) => <button key={device.id} type="button" disabled={busy} onClick={() => void transfer(device.id)} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-[#f1f1ee]"><DeviceIcon type={device.type} /><span className="min-w-0 flex-1 text-sm font-medium">{device.name}</span>{device.is_active && <span className="rounded-full bg-[#eeeee9] px-2 py-1 text-[10px] text-[#77776f]">Active</span>}</button>)}</div></DialogContent></Dialog>

            <Dialog open={albumOpen} onOpenChange={setAlbumOpen}>{selectedAlbum && <DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 max-h-[88dvh] overflow-y-auto rounded-b-none rounded-t-xl border-x-0 border-b-0 bg-[#fdfdfc] px-5 pb-8 pt-5 text-[#1d1d1f]"><DialogHeader><DialogTitle>{selectedAlbum.name}</DialogTitle><DialogDescription>{selectedAlbum.artist}</DialogDescription></DialogHeader><div className="mt-4">{selectedAlbum.cover_image && <img src={selectedAlbum.cover_image} alt="" className="mx-auto aspect-square w-[68%] max-w-[240px] rounded-lg border border-black/5 object-cover" />}<div className="mt-5 flex items-center justify-between"><div><p className="text-[10px] text-[#77776f]">Released</p><p className="mt-0.5 text-sm font-medium">{selectedAlbum.release_date || "Unknown"}</p></div><Button size="sm" className="h-9 rounded-md bg-[#1d1d1f] text-white hover:bg-[#34343a]" onClick={() => void playAlbum({ id: selectedAlbum.id, name: selectedAlbum.name, artist: selectedAlbum.artist, cover_image: selectedAlbum.cover_image })}>{playingId === selectedAlbum.id ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}Play album</Button></div><div className="mt-5 border-t border-[#ededE9]">{selectedAlbum.tracks.map((track) => <button key={track.id ?? track.track_number} type="button" disabled={busy || !track.id} onClick={() => track.id && void playTrack(track.id)} className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-[#f2f2ef]"><span className="w-5 text-right text-xs text-[#96968e]">{track.track_number}</span><span className="min-w-0 flex-1 truncate text-sm">{track.name}{track.explicit && <span className="ml-2 text-[9px] text-[#96968e]">E</span>}</span><span className="text-xs tabular-nums text-[#96968e]">{time(track.duration_ms)}</span></button>)}</div></div></DialogContent>}</Dialog>
        </main>
    );
}
