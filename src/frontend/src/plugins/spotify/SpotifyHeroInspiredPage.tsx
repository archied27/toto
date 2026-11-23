import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Laptop2, ListMusic, LoaderCircle, Pause, Play, RefreshCw, Repeat, Repeat1, Search, Shuffle, SkipBack, SkipForward, Smartphone, Volume2, WifiOff, Check, X, Pencil } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDominantColor } from "@/plugins/media/utils";
import { SpotifyHeroWidget } from "./SpotifyPage";

interface Track { track_id?: string; is_playing: boolean; track: string; artists: string; album: string; album_image?: string | null; device?: string | null; device_type?: string | null; volume_percent?: number | null; progress_ms?: number; duration_ms?: number; shuffle_state?: boolean; repeat_state?: "off" | "track" | "context" }
interface Device { id: string; name: string; type: string; is_active: boolean }
interface State { connected: boolean; current: Track | null }
interface Album { id: string; name: string; artist: string; cover_image?: string | null; release_date?: string | null }
interface Cluster { id: number; name: string; count: number; cover_image?: string | null }
interface AlbumTag { name: string; weight: number }
interface AlbumDetail extends Album { tags?: AlbumTag[]; tracks: Array<{ id: string | null; name: string; duration_ms: number; track_number: number; explicit: boolean }> }
interface Playlist { id: string; name: string; owner?: string | null; count: number; cover_image?: string | null }
interface PlaylistTrack { id: string; name: string; duration_ms: number; artist: string; album: string }
interface PlaylistDetail extends Playlist { description?: string | null; artist: string; tracks: PlaylistTrack[] }
interface Result { id: string; name: string; artist: string; album?: string; cover_image?: string | null; duration_ms?: number }
interface SearchResults { tracks: Result[]; albums: Result[]; playlists: Result[]; artists: Result[] }

function DeviceIcon({ type }: { type?: string | null }) { return type === "computer" ? <Laptop2 className="size-4" /> : <Smartphone className="size-4" /> }
function time(ms = 0) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }

export function SpotifyHeroInspiredPage() {
    const [state, setState] = useState<State | null>(null);
    const [devices, setDevices] = useState<Device[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [queue, setQueue] = useState<Result[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
    const [searching, setSearching] = useState(false);
    const [contentTab, setContentTab] = useState<"search" | "playlists" | "albums">("albums");
    const [searchTab, setSearchTab] = useState<"tracks" | "albums" | "playlists" | "artists">("tracks");
    const [selectedCluster, setSelectedCluster] = useState<{ cluster: Cluster; albums: Album[] } | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<AlbumDetail | null>(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null);
    const [selectedTag, setSelectedTag] = useState<{ name: string; albums: (Album & { weight?: number })[] } | null>(null);
    const [albumOpen, setAlbumOpen] = useState(false);
    const [playlistOpen, setPlaylistOpen] = useState(false);
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
    const heroColor = useDominantColor(state?.current?.album_image || undefined);
    const accentColor = heroColor ?? undefined;

    const refresh = async () => { try { setState(await apiFetch<State>("/spotify/playing")); await loadQueue(); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Unable to reach Spotify"); } };
    const loadDevices = async () => { try { setDevices(await apiFetch<Device[]>("/spotify/devices")); } catch { setDevices([]); } };
    const loadClusters = async () => { try { setClusters(await apiFetch<Cluster[]>("/spotify/clusters")); } catch { setClusters([]); } };
    const loadPlaylists = async () => { try { setPlaylists(await apiFetch<Playlist[]>("/spotify/playlists")); } catch { setPlaylists([]); } };
    const loadQueue = async () => { try { setQueue(await apiFetch<Result[]>("/spotify/queue")); } catch { setQueue([]); } };

    useEffect(() => { void refresh(); const interval = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(interval); }, []);
    useEffect(() => { if (!state?.connected) return; void loadDevices(); void loadClusters(); void loadPlaylists(); void loadQueue(); }, [state?.connected]);

    useEffect(() => {
        const current = state?.current;
        if (!current) { setProgressMs(0); progressRef.current = 0; progressTrackRef.current = ""; return; }
        const key = current.track_id || current.track;
        const server = current.progress_ms || 0;
        if (progressTrackRef.current !== key) { progressTrackRef.current = key; progressRef.current = server; setProgressMs(server); return; }
        if (Math.abs(progressRef.current - server) > 1500) { progressRef.current = server; setProgressMs(server); }
    }, [state?.current?.track_id, state?.current?.track, state?.current?.progress_ms]);

    useEffect(() => {
        const current = state?.current;
        if (!current?.is_playing) return;
        const duration = current.duration_ms || 0;
        const interval = window.setInterval(() => { progressRef.current = duration > 0 ? Math.min(progressRef.current + 250, duration) : progressRef.current + 250; setProgressMs(progressRef.current); }, 250);
        return () => window.clearInterval(interval);
    }, [state?.current?.is_playing, state?.current?.track_id, state?.current?.track, state?.current?.duration_ms]);

    const connect = async () => { try { window.location.href = (await apiFetch<{ authorization_url: string }>("/spotify/connect")).authorization_url; } catch (e) { setError(e instanceof Error ? e.message : "Spotify is not configured"); } };
    const control = async (action: "previous" | "play" | "pause" | "next") => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/control/${action}`, { method: "POST" })); await loadQueue(); } catch (e) { setError(e instanceof Error ? e.message : "Playback control failed"); } finally { setBusy(false); } };
    const setShuffle = async (value: boolean) => { try { setState(await apiFetch<State>(`/spotify/shuffle?shuffle_state=${value}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Shuffle change failed"); } };
    const setRepeat = async (value: "off" | "track" | "context") => { try { setState(await apiFetch<State>(`/spotify/repeat?repeat_state=${value}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Repeat change failed"); } };
    const seek = async (positionMs: number) => { try { setState(await apiFetch<State>(`/spotify/seek?position_ms=${positionMs}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Seek failed"); } };
    const setVolume = async (volume: number) => { try { setState(await apiFetch<State>(`/spotify/volume?volume_percent=${volume}`, { method: "POST" })); } catch (e) { setError(e instanceof Error ? e.message : "Volume change failed"); } };
    const transfer = async (deviceId: string) => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/devices/${deviceId}/transfer`, { method: "POST" })); await loadDevices(); await loadQueue(); setDevicesOpen(false); } catch (e) { setError(e instanceof Error ? e.message : "Unable to transfer playback"); } finally { setBusy(false); } };
    const syncAlbums = async () => { setSyncing(true); try { const result = await apiFetch<{ clusters: Cluster[] }>("/spotify/albums/sync", { method: "POST" }); setClusters(result.clusters); setSelectedCluster(null); } catch (e) { setError(e instanceof Error ? e.message : "Album sync failed"); } finally { setSyncing(false); } };
    const openCluster = async (cluster: Cluster) => { try { setSelectedCluster({ cluster, albums: await apiFetch<Album[]>(`/spotify/clusters/${cluster.id}`) }); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load collection"); } };
    const openAlbum = async (album: Album) => { try { setSelectedAlbum(await apiFetch<AlbumDetail>(`/spotify/albums/${album.id}`)); setAlbumOpen(true); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load album"); } };
    const openPlaylist = async (playlist: Playlist | Result) => { try { setSelectedPlaylist(await apiFetch<PlaylistDetail>(`/spotify/playlists/${playlist.id}`)); setPlaylistOpen(true); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load playlist"); } };
    const playAlbum = async (album: Album) => { setBusy(true); setPlayingId(album.id); try { setState(await apiFetch<State>(`/spotify/albums/${album.id}/play`, { method: "POST" })); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Album playback failed"); } finally { setBusy(false); window.setTimeout(() => setPlayingId(null), 700); } };
    const playPlaylist = async (playlist: Playlist | Result) => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/playlists/${playlist.id}/play`, { method: "POST" })); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Playlist playback failed"); } finally { setBusy(false); } };
    const playTrack = async (trackId: string) => { setBusy(true); try { setState(await apiFetch<State>(`/spotify/tracks/${trackId}/play`, { method: "POST" })); await loadQueue(); } catch (e) { setError(e instanceof Error ? e.message : "Track playback failed"); } finally { setBusy(false); } };
    const search = async (event: FormEvent) => { event.preventDefault(); const query = searchQuery.trim(); if (!query) { setSearchResults(null); return; } setSearching(true); setSearchTab("tracks"); try { setSearchResults(await apiFetch<SearchResults>(`/spotify/search?q=${encodeURIComponent(query)}`)); } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); } finally { setSearching(false); } };
    const renameCluster = async (cluster: Cluster) => { const name = clusterName.trim(); if (!name) return; try { const renamed = await apiFetch<{ id: number; name: string }>(`/spotify/clusters/${cluster.id}/name`, { method: "PUT", body: JSON.stringify({ name }) }); setClusters((items) => items.map((item) => item.id === renamed.id ? { ...item, name: renamed.name } : item)); setEditingId(null); } catch (e) { setError(e instanceof Error ? e.message : "Unable to rename collection"); } };
    const openTag = async (tag: string) => { try { const albums = await apiFetch<(Album & { weight?: number })[]>(`/spotify/albums/by-tag/${encodeURIComponent(tag)}`); setSelectedTag({ name: tag, albums: albums.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)) }); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tagged albums"); } };
    const openRandomAlbum = (albums: Album[]) => { if (albums.length === 0) return; const album = albums[Math.floor(Math.random() * albums.length)]; void openAlbum(album); };

    if (!state) return <main className="min-h-dvh bg-[#0d0d0e]" />;
    if (!state.connected) return <main className="flex min-h-dvh items-center justify-center bg-[#0d0d0e] px-6 text-white"><div className="max-w-xs text-center"><div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full border border-white/10"><WifiOff className="size-5 text-white/55" /></div><h1 className="text-xl font-semibold">Connect Spotify</h1><p className="mt-2 text-sm leading-6 text-white/45">Connect your account to control playback and browse your library.</p><Button className="mt-6 rounded-full bg-white px-5 text-[#111] hover:bg-white/90" onClick={() => void connect()}><Play className="size-4 fill-current" />Connect account</Button></div></main>;

    const current = state.current ?? {
        is_playing: false,
        track: "",
        artists: "",
        album: "",
        album_image: undefined,
        device: undefined,
        device_type: undefined,
        volume_percent: 50,
        progress_ms: 0,
        duration_ms: 0,
        shuffle_state: false,
        repeat_state: "off" as const,
    };

    return (
        <main className="min-h-dvh w-full min-w-0 max-w-full overflow-x-clip bg-[#09090a] pb-36 text-white" style={heroColor ? { background: `linear-gradient(145deg, ${heroColor}20 0%, #09090a 38%, #09090a 100%)` } : undefined}>
            {selectedTag ? (
                <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
                    <header className="mb-8 flex items-center gap-3"><button type="button" className="flex size-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white" onClick={() => setSelectedTag(null)} aria-label="Back"><ArrowLeft className="size-5" /></button><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Tag</p><h1 className="truncate text-xl font-semibold">{selectedTag.name}</h1></div><button type="button" disabled={selectedTag.albums.length === 0} onClick={() => openRandomAlbum(selectedTag.albums)} className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Open random album from tag"><Shuffle className="size-3.5" />Random</button></header>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6">{selectedTag.albums.map((album) => <AlbumCard key={album.id} album={album} playing={playingId === album.id} onOpen={() => void openAlbum(album)} onPlay={() => void playAlbum(album)} />)}</div>
                </div>
            ) : selectedCluster ? (
                <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
                    <header className="mb-8 flex items-center gap-3"><button type="button" className="flex size-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white" onClick={() => setSelectedCluster(null)} aria-label="Back"><ArrowLeft className="size-5" /></button><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Collection</p><h1 className="truncate text-xl font-semibold">{selectedCluster.cluster.name}</h1></div><button type="button" disabled={selectedCluster.albums.length === 0} onClick={() => openRandomAlbum(selectedCluster.albums)} className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Open random album from collection"><Shuffle className="size-3.5" />Random</button></header>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6">{selectedCluster.albums.map((album) => <AlbumCard key={album.id} album={album} playing={playingId === album.id} onOpen={() => void openAlbum(album)} onPlay={() => void playAlbum(album)} />)}</div>
                </div>
            ) : (
                <>
                    <section className="relative isolate min-h-0 w-full min-w-0 overflow-hidden pb-2" style={heroColor && current?.album_image ? { background: `linear-gradient(160deg, ${heroColor}99 0%, ${heroColor}35 38%, #09090a 100%)` } : { background: "#151516" }}>
                        {current?.album_image && <><img src={current.album_image} alt="" aria-hidden="true" className="absolute -inset-[18%] h-[136%] w-[136%] scale-110 object-cover opacity-45 blur-[110px]" /><img src={current.album_image} alt="" aria-hidden="true" className="absolute -inset-[8%] h-[116%] w-[116%] scale-110 object-cover opacity-20 blur-[36px]" /><div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#151516]/30 to-[#09090a]" /></>}
                        <div className="relative z-10 mx-auto max-w-xl px-5 pt-6 sm:px-8">
                            <header className="flex items-center justify-between"><h1 className="text-[20px] font-semibold tracking-tight">Spotify</h1><button type="button" disabled={syncing} className="flex size-9 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white" onClick={() => void syncAlbums()} aria-label="Sync albums"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /></button></header>
                            {state.current && <div className="relative mt-6 rounded-lg bg-black/10 p-1 backdrop-blur-[2px]"><SpotifyHeroWidget /></div>}
                            {false && current && <div className="pt-7">
                                <button type="button" className="mx-auto block w-[88%] max-w-[390px]" onClick={() => setDevicesOpen(true)}>{current.album_image ? <img src={current.album_image || undefined} alt={`${current.album} cover`} className="aspect-square w-full rounded-[26px] object-cover shadow-[0_34px_90px_rgba(0,0,0,.62)]" /> : <div className="aspect-square w-full rounded-[26px] bg-white/8" />}</button>
                                <div className="mt-7 text-center"><h2 className="truncate text-[24px] font-semibold tracking-tight">{current.track}</h2><p className="mt-1 truncate text-sm text-white/55">{current.artists}</p><p className="mt-1 truncate text-xs text-white/35">{current.album}</p></div>
                                <div className="mt-5"><input aria-label="Track position" type="range" min={0} max={current.duration_ms || 0} value={progressMs} onChange={(event) => { const value = Number(event.target.value); progressRef.current = value; setProgressMs(value); }} onPointerUp={() => void seek(progressRef.current)} onKeyUp={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") void seek(progressRef.current); }} className="h-1 w-full" style={{ accentColor: heroColor || "white" }} /><div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-white/45"><span>{time(progressMs)}</span><span>{time(current.duration_ms)}</span></div></div>
                                <div className="mt-4 flex items-center justify-center gap-6"><button type="button" className="text-white/45 transition hover:text-white" aria-label="Shuffle" onClick={() => void setShuffle(!current.shuffle_state)}><Shuffle className={`size-5 ${current.shuffle_state ? "text-white" : ""}`} style={accentColor ? { color: accentColor } : undefined} /></button><button type="button" disabled={busy} aria-label="Previous" onClick={() => void control("previous")}><SkipBack className="size-6 fill-white" /></button><button type="button" disabled={busy} aria-label={current.is_playing ? "Pause" : "Play"} onClick={() => void control(current.is_playing ? "pause" : "play")} className="flex size-16 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105" style={{ backgroundColor: accentColor || "white", color: accentColor ? "white" : "black" }}>{current.is_playing ? <Pause className="size-7 fill-current" /> : <Play className="ml-0.5 size-7 fill-current" />}</button><button type="button" disabled={busy} aria-label="Next" onClick={() => void control("next")}><SkipForward className="size-6 fill-white" /></button><button type="button" className="text-white/45 transition hover:text-white" aria-label="Repeat" onClick={() => void setRepeat(current.repeat_state === "off" ? "context" : current.repeat_state === "context" ? "track" : "off")}>{current.repeat_state === "track" ? <Repeat1 className="size-5 text-white" /> : <Repeat className={`size-5 ${current.repeat_state === "context" ? "text-white" : ""}`} style={accentColor ? { color: accentColor } : undefined} />}</button></div>
                                <div className="mx-auto mt-5 flex max-w-[280px] items-center gap-2 rounded-full bg-black/15 px-3 py-2 backdrop-blur-md">
                                    <button type="button" onClick={() => setDevicesOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 text-xs text-white/65">
                                        <DeviceIcon type={current.device_type} />
                                        <span className="truncate">{current.device || "Choose device"}</span>
                                    </button>
                                    <Volume2 className="size-3.5 shrink-0 text-white/45" />
                                    <input aria-label="Volume" type="range" min={0} max={100} value={current.volume_percent ?? 50} onChange={(event) => void setVolume(Number(event.target.value))} className="h-1 w-16 accent-white" />
                                </div>
                            </div>}
                        </div>
                    </section>

                    {state.current && queue.length > 0 && <section className="mx-auto w-full min-w-0 max-w-xl px-5 pt-2 sm:px-8">
                        <div className="mb-3 flex items-center gap-2"><ListMusic className="size-4 text-white/60" /><div><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Coming up</p><h2 className="mt-1 text-lg font-semibold">Next up</h2></div></div>
                        <div className="relative overflow-hidden rounded-[18px] bg-white/5 p-2">
                            {queue[0]?.cover_image && <img src={queue[0].cover_image} alt="" aria-hidden="true" className="absolute -inset-8 h-[calc(100%+4rem)] w-[calc(100%+4rem)] object-cover opacity-25 blur-[42px]" />}
                            <div className="relative space-y-1">{queue.slice(0, 5).map((track) => <button key={track.id} type="button" disabled={busy} onClick={() => void playTrack(track.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10"><img src={track.cover_image || ""} alt="" className="size-11 shrink-0 rounded-lg bg-white/10 object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{track.name}</span><span className="block truncate text-xs text-white/50">{track.artist} · {track.album}</span></span><Play className="size-4 shrink-0 text-white/50" /></button>)}</div>
                        </div>
                    </section>}

                    <section className="mx-auto w-full min-w-0 max-w-xl px-5 pt-7 sm:px-8">
                        <div className="mb-5 flex rounded-full bg-white/5 p-1">
                            {(["search", "playlists", "albums"] as const).map((tab) => <button key={tab} type="button" onClick={() => setContentTab(tab)} className={`flex-1 rounded-full px-3 py-2 text-xs font-medium capitalize transition ${contentTab === tab ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>{tab}</button>)}
                        </div>

                        {contentTab === "search" && <>
                            <form onSubmit={search} className="flex items-center gap-3 rounded-full bg-white/10 px-4 py-3 focus-within:bg-white/15"><Search className="size-4 shrink-0 text-white/50" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search Spotify" aria-label="Search Spotify" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40" /><button type="submit" disabled={searching} className="text-xs font-medium text-white/70 hover:text-white">{searching ? "Searching" : "Search"}</button></form>
                            {searchResults && <div className="mt-5">
                                <div className="mb-4 flex rounded-full bg-white/5 p-1">
                                    {(["tracks", "albums", "playlists", "artists"] as const).map((tab) => {
                                        const count = searchResults[tab].length;
                                        return <button key={tab} type="button" onClick={() => setSearchTab(tab)} className={`flex-1 rounded-full px-2 py-2 text-[10px] font-medium capitalize transition ${searchTab === tab ? "bg-white/90 text-black" : "text-white/50 hover:text-white"}`}><span>{tab}</span>{count > 0 && <span className="ml-1 opacity-60">{count}</span>}</button>;
                                    })}
                                </div>
                                {searchTab === "tracks" && (searchResults.tracks.length > 0 ? <SearchSection title="Tracks">{searchResults.tracks.slice(0, 8).map((item) => <SearchRow key={item.id} item={item} onClick={() => void playTrack(item.id)} />)}</SearchSection> : <p className="py-4 text-center text-sm text-white/45">No tracks found</p>)}
                                {searchTab === "albums" && (searchResults.albums.length > 0 ? <SearchSection title="Albums">{searchResults.albums.slice(0, 8).map((item) => <SearchRow key={item.id} item={item} onClick={() => void openAlbum(item)} />)}</SearchSection> : <p className="py-4 text-center text-sm text-white/45">No albums found</p>)}
                                {searchTab === "playlists" && (searchResults.playlists.length > 0 ? <SearchSection title="Playlists">{searchResults.playlists.slice(0, 8).map((item) => <SearchRow key={item.id} item={item} onClick={() => void playPlaylist(item)} />)}</SearchSection> : <p className="py-4 text-center text-sm text-white/45">No playlists found</p>)}
                                {searchTab === "artists" && (searchResults.artists.length > 0 ? <SearchSection title="Artists">{searchResults.artists.slice(0, 8).map((item) => <ArtistRow key={item.id} item={item} />)}</SearchSection> : <p className="py-4 text-center text-sm text-white/45">No artists found</p>)}
                            </div>}
                        </>}

                        {contentTab === "playlists" && (playlists.length > 0 ? <div className="grid min-w-0 grid-cols-2 gap-3 pb-2 sm:grid-cols-3">{playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} busy={busy} onOpen={() => void openPlaylist(playlist)} onPlay={() => void playPlaylist(playlist)} />)}</div> : <p className="py-8 text-center text-sm text-white/45">No playlists found</p>)}

                        {contentTab === "albums" && (clusters.length === 0 ? <button type="button" onClick={() => void syncAlbums()} className="flex h-16 w-full items-center gap-3 text-left text-white/60 transition hover:text-white"><RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /><div><p className="text-sm font-medium text-white">Sync saved albums</p><p className="mt-1 text-xs text-white/40">Build collections from your library</p></div></button> : <div className="grid grid-cols-2 gap-3 pb-3 sm:grid-cols-3">{clusters.map((cluster) => <ClusterCard key={cluster.id} cluster={cluster} editing={editingId === cluster.id} clusterName={clusterName} onOpen={() => void openCluster(cluster)} onRename={() => { setEditingId(cluster.id); setClusterName(cluster.name); }} onSaveName={() => void renameCluster(cluster)} onCancelEdit={() => setEditingId(null)} onNameChange={setClusterName} />)}</div>)}
                    </section>
                </>
            )}
            {error && <p className="mx-auto mt-4 max-w-md px-4 text-center text-xs text-red-400">{error}</p>}

            <Dialog open={devicesOpen} onOpenChange={setDevicesOpen}><DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 rounded-b-none rounded-t-[24px] border-x-0 border-b-0 bg-[#171719] px-5 pb-8 pt-5 text-white"><DialogHeader><DialogTitle>Playback device</DialogTitle><DialogDescription>Choose where Spotify should play.</DialogDescription></DialogHeader><div className="mt-4 space-y-1">{devices.map((device) => <button key={device.id} type="button" disabled={busy} onClick={() => void transfer(device.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"><DeviceIcon type={device.type} /><span className="min-w-0 flex-1 text-sm font-medium">{device.name}</span>{device.is_active && <span className="text-[10px] text-white/45">Active</span>}</button>)}</div></DialogContent></Dialog>

            <Dialog open={albumOpen} onOpenChange={setAlbumOpen}>{selectedAlbum && <AlbumDialog album={selectedAlbum} busy={busy} playing={playingId === selectedAlbum.id} onPlay={() => void playAlbum(selectedAlbum)} onPlayTrack={(trackId) => void playTrack(trackId)} onOpenTag={(tag) => { setAlbumOpen(false); void openTag(tag); }} />}</Dialog>
            <Dialog open={playlistOpen} onOpenChange={setPlaylistOpen}>{selectedPlaylist && <PlaylistDialog playlist={selectedPlaylist} busy={busy} onPlay={() => void playPlaylist(selectedPlaylist)} onPlayTrack={(trackId) => void playTrack(trackId)} />}</Dialog>
        </main>
    );
}

function AlbumCard({ album, playing, onOpen, onPlay }: { album: Album; playing: boolean; onOpen: () => void; onPlay: () => void }) {
    const color = useDominantColor(album.cover_image || undefined);
    return <article className="min-w-0 rounded-[14px] p-1 pb-3" style={color ? { background: `linear-gradient(145deg, ${color}48, transparent 70%)` } : undefined}>
        <button type="button" className="relative block w-full overflow-hidden rounded-[14px]" onClick={onOpen}>
            {album.cover_image ? <img src={album.cover_image} alt={`${album.name} cover`} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-white/5" />}
            <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onPlay(); }} onKeyDown={(event) => { if (event.key === "Enter") onPlay(); }} className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full text-white shadow-xl" style={{ backgroundColor: color || "white", color: color ? "white" : "black" }}>
                {playing ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="ml-0.5 size-4 fill-current" />}
            </span>
        </button>
        <p className="mt-2 truncate px-1 text-sm font-semibold">{album.name}</p>
        <p className="mt-0.5 truncate px-1 text-xs text-white/40">{album.artist}</p>
    </article>;
}

function SearchSection({ title, children }: { title: string; children: ReactNode }) {
    return <div><h3 className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">{title}</h3><div className="space-y-1">{children}</div></div>;
}

function SearchRow({ item, onClick }: { item: Result; onClick: () => void }) {
    return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10"><img src={item.cover_image || ""} alt="" className="size-11 shrink-0 rounded-lg bg-white/10 object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.name}</span><span className="block truncate text-xs text-white/50">{item.artist}{item.album ? ` · ${item.album}` : ""}</span></span><Play className="size-4 shrink-0 text-white/45" /></button>;
}

function ArtistRow({ item }: { item: Result }) {
    return <div className="flex w-full items-center gap-3 rounded-xl px-2 py-2"><img src={item.cover_image || ""} alt="" className="size-11 shrink-0 rounded-full bg-white/10 object-cover" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span><span className="text-xs text-white/45">Artist</span></div>;
}

function PlaylistCard({ playlist, busy, onOpen, onPlay }: { playlist: Playlist; busy: boolean; onOpen: () => void; onPlay: () => void }) {
    const color = useDominantColor(playlist.cover_image || undefined);
    return <article className="min-w-0 w-full text-left"><button type="button" disabled={busy} onClick={onOpen} className="block w-full min-w-0 text-left"><div className="relative min-w-0 overflow-hidden rounded-[16px]" style={{ background: `linear-gradient(145deg, ${color || "#ffffff22"}, #09090a)` }}><img src={playlist.cover_image || ""} alt={`${playlist.name} playlist cover`} className="aspect-square w-full object-cover" /></div><p className="mt-2 truncate text-sm font-semibold">{playlist.name}</p><p className="mt-0.5 truncate text-xs text-white/45">{playlist.count} tracks</p></button><button type="button" disabled={busy} onClick={onPlay} className="mt-2 flex w-full items-center justify-center gap-1 rounded-full bg-white/10 py-2 text-xs text-white/70 transition hover:bg-white/15 hover:text-white"><Play className="size-3.5 fill-current" />Play</button></article>;
}

function ClusterCard({ cluster, editing, clusterName, onOpen, onRename, onSaveName, onCancelEdit, onNameChange }: { cluster: Cluster; editing: boolean; clusterName: string; onOpen: () => void; onRename: () => void; onSaveName: () => void; onCancelEdit: () => void; onNameChange: (value: string) => void }) {
    const color = useDominantColor(cluster.cover_image || undefined);
    return <article className="relative aspect-square min-w-0 w-full overflow-hidden rounded-[18px]">
        <button type="button" className="absolute inset-0 block h-full w-full text-left" onClick={onOpen}>
            {cluster.cover_image ? <img src={cluster.cover_image} alt={`${cluster.name} collection cover`} className="absolute inset-0 h-full w-full object-cover opacity-60 brightness-75" /> : <div className="absolute inset-0 bg-white/5" />}
            <div className="absolute inset-0" style={color ? { background: `linear-gradient(145deg, ${color}25, rgba(0,0,0,.58))` } : { background: "linear-gradient(145deg, rgba(0,0,0,.15), rgba(0,0,0,.58))" }} />
        </button>
        {editing ? <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-black/75 p-1.5 backdrop-blur"><input autoFocus value={clusterName} onChange={(event) => onNameChange(event.target.value)} className="min-w-0 flex-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white outline-none" /><button type="button" onClick={onSaveName} aria-label="Save name"><Check className="size-4" /></button><button type="button" onClick={onCancelEdit} aria-label="Cancel rename"><X className="size-4" /></button></div> : <>
            <button type="button" className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center" onClick={onOpen}><div className="min-w-0 max-w-full"><p className="mx-auto max-w-full truncate px-2 text-[15px] font-semibold tracking-wide text-white drop-shadow-lg sm:text-base">{cluster.name}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/65 drop-shadow-sm">{cluster.count} albums</p></div></button>
            <button type="button" className="absolute right-2 bottom-2 z-20 flex size-8 items-center justify-center rounded-full bg-black/30 text-white/75 backdrop-blur transition hover:bg-black/50 hover:text-white" onClick={onRename} aria-label={`Rename ${cluster.name}`}><Pencil className="size-3.5" /></button>
        </>}
    </article>;
}

function AlbumDialog({ album, busy, playing, onPlay, onPlayTrack, onOpenTag }: { album: AlbumDetail; busy: boolean; playing: boolean; onPlay: () => void; onPlayTrack: (trackId: string) => void; onOpenTag: (tag: string) => void }) {
    const color = useDominantColor(album.cover_image || undefined);
    return <DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 max-h-[90dvh] w-full max-w-[100vw] overflow-x-hidden overflow-y-auto rounded-b-none rounded-t-[28px] border-x-0 border-b-0 bg-[#101011] p-0 text-white" style={{ background: color ? `linear-gradient(160deg, ${color}66 0%, #101011 48%)` : "#101011" }}>
        {album.cover_image && <><img src={album.cover_image} alt="" aria-hidden="true" className="absolute -inset-12 h-[420px] w-[calc(100%+6rem)] object-cover opacity-45 blur-[70px]" /><img src={album.cover_image} alt="" aria-hidden="true" className="absolute -inset-4 h-[360px] w-[calc(100%+2rem)] object-cover opacity-20 blur-2xl" /></>}
        <div className="relative z-10 px-5 pb-8 pt-6 sm:mx-auto sm:max-w-xl">
            <DialogHeader className="sr-only"><DialogTitle>{album.name}</DialogTitle><DialogDescription>{album.artist}</DialogDescription></DialogHeader>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] items-end gap-4 sm:grid-cols-[144px_minmax(0,1fr)]">
                {album.cover_image && <img src={album.cover_image} alt={`${album.name} cover`} className="size-28 shrink-0 rounded-[14px] object-cover shadow-[0_18px_50px_rgba(0,0,0,.5)] sm:size-36" />}
                <div className="min-w-0 pb-1"><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/55">Album</p><h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl" title={album.name}>{album.name}</h2><p className="mt-1 truncate text-sm text-white/60" title={album.artist}>{album.artist}</p><p className="mt-1 truncate text-xs text-white/40">{album.release_date || "Unknown release"} · {album.tracks.length} tracks</p></div>
            </div>
            <Button className="mt-6 h-11 w-full rounded-full text-white shadow-lg hover:brightness-110" style={{ backgroundColor: color || "white", color: color ? "white" : "black" }} onClick={onPlay}>{playing ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}Play album</Button>
            {album.tags && album.tags.length > 0 && <section className="mt-5" aria-label="Top album tags">
                <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Top tags</h3><span className="text-[10px] text-white/35">Weight ranked</span></div>
                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto pr-1">
                    {[...album.tags].sort((a, b) => b.weight - a.weight).slice(0, 8).map((tag) => <button key={tag.name} type="button" onClick={() => onOpenTag(tag.name)} className="flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:border-white/40 hover:bg-white/20"><span className="max-w-36 truncate">{tag.name}</span><span className="border-l border-white/15 pl-2 tabular-nums text-[9px] text-white/45">{tag.weight.toFixed(2)}</span></button>)}
                </div>
            </section>}
            <div className="mt-5 min-w-0 border-t border-white/15 pt-2">{album.tracks.map((track) => <button key={track.id ?? track.track_number} type="button" disabled={busy || !track.id} onClick={() => track.id && onPlayTrack(track.id)} className="group grid w-full min-w-0 grid-cols-[20px_minmax(0,1fr)_44px] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-white/10"><span className="text-right text-xs tabular-nums text-white/35">{track.track_number}</span><span className="block min-w-0 truncate text-sm text-white/85 group-hover:text-white" title={track.name}>{track.name}</span><span className="text-right text-xs tabular-nums text-white/40">{time(track.duration_ms)}</span></button>)}</div>
        </div>
    </DialogContent>;
}

function PlaylistDialog({ playlist, busy, onPlay, onPlayTrack }: { playlist: PlaylistDetail; busy: boolean; onPlay: () => void; onPlayTrack: (trackId: string) => void }) {
    const color = useDominantColor(playlist.cover_image || undefined);
    return <DialogContent className="!bottom-0 !left-0 !top-auto !w-full !max-w-none !translate-x-0 !translate-y-0 max-h-[90dvh] w-full max-w-[100vw] overflow-y-auto overflow-x-hidden rounded-b-none rounded-t-[28px] border-x-0 border-b-0 bg-[#101011] p-0 text-white" style={{ background: color ? `linear-gradient(160deg, ${color}66 0%, #101011 48%)` : "#101011" }}>
        {playlist.cover_image && <img src={playlist.cover_image} alt="" aria-hidden="true" className="absolute -inset-12 h-[420px] w-[calc(100%+6rem)] object-cover opacity-35 blur-[70px]" />}
        <div className="relative z-10 mx-auto w-full min-w-0 max-w-xl px-5 pb-8 pt-6">
            <DialogHeader className="sr-only"><DialogTitle>{playlist.name}</DialogTitle><DialogDescription>{playlist.artist}</DialogDescription></DialogHeader>
            <div className="flex min-w-0 items-end gap-4"><img src={playlist.cover_image || ""} alt={`${playlist.name} cover`} className="size-28 shrink-0 rounded-[14px] bg-white/10 object-cover shadow-[0_18px_50px_rgba(0,0,0,.5)] sm:size-36" /><div className="min-w-0 pb-1"><p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/55">Playlist</p><h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{playlist.name}</h2><p className="mt-1 truncate text-sm text-white/60">{playlist.artist || playlist.owner || "Spotify"}</p><p className="mt-1 text-xs text-white/40">{playlist.tracks.length} tracks</p></div></div>
            {playlist.description && <p className="mt-4 line-clamp-2 text-sm text-white/55">{playlist.description}</p>}
            <Button className="mt-6 h-11 w-full rounded-full text-white shadow-lg hover:brightness-110" style={{ backgroundColor: color || "white", color: color ? "white" : "black" }} onClick={onPlay}><Play className="size-4 fill-current" />Play playlist</Button>
            <div className="mt-7 min-w-0 border-t border-white/15 pt-2">{playlist.tracks.map((track, index) => <button key={track.id} type="button" disabled={busy} onClick={() => void onPlayTrack(track.id)} className="group flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-white/10"><span className="w-5 shrink-0 text-right text-xs tabular-nums text-white/35">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white/85 group-hover:text-white">{track.name}</span><span className="block truncate text-xs text-white/40">{track.artist}{track.album ? ` · ${track.album}` : ""}</span></span><span className="shrink-0 text-xs tabular-nums text-white/40">{time(track.duration_ms)}</span></button>)}</div>
        </div>
    </DialogContent>;
}
