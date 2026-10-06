import { useEffect, useState, useRef } from "react";
import { SearchBox } from "./components/SearchBox";
import { SearchResults } from "./components/SearchResults";
import { useSearch, type HomePageResult } from "./useMedia";
import { useContinueWatching, useWatchlist } from "./useMedia";
import type { MediaType } from "./components/MediaFilter";
import { apiFetch } from "@/hooks/api";
import { CurrentlyPlaying, type PlayingItem, type PlayingResponse } from "./components/CurrentlyPlaying";
import { ContinueWatchingSection } from "./components/ContinueWatchingSection";
import { WatchlistSection } from "./components/WatchlistSection";
import { MovieDetails } from "./components/MovieDetails";
import { SeriesDetails } from "./components/SeriesDetails";

type DetailView =
    | { type: "movie"; id: number }
    | { type: "series"; id: number }
    | null;

export function MediaPage() {
    const [results, setResults] = useState<HomePageResult[]>([]);
    const [searchVisible, setSearchVisible] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [mediaType, setMediaType] = useState<MediaType>("all");
    const [playing, setPlaying] = useState<PlayingItem | null>(null);
    const [estimatedPlaying, setEstimatedPlaying] = useState<PlayingItem | null>(null);
    const [detailView, setDetailView] = useState<DetailView>(null);
    const lastUpdateRef = useRef<number>(0);
    const estimatedPlayingRef = useRef<PlayingItem | null>(null);
    const { search, loading } = useSearch();
    const { continueWatching: continueWatchingData, loading: continueWatchingLoading } = useContinueWatching();
    const { watchlist: watchlistData, loading: watchlistLoading } = useWatchlist();

    const refreshPlaying = async () => {
        try {
            const response = await apiFetch<PlayingResponse>("/media/playing");
            const now = Date.now();

            if (response.items[0]) {
                setPlaying(response.items[0]);
                setEstimatedPlaying((current) => {
                    const serverItem = response.items[0];
                    const currentPosition = current?.position_seconds ?? 0;
                    const serverPosition = serverItem.position_seconds ?? 0;
                    const isSameMedia = current?.agent_id === serverItem.agent_id &&
                        current?.tmdb_id === serverItem.tmdb_id &&
                        current?.media_type === serverItem.media_type;

                    if (isSameMedia && serverItem.status === "playing" && serverPosition < currentPosition) {
                        return { ...serverItem, position_seconds: currentPosition };
                    }
                    return serverItem;
                });
                lastUpdateRef.current = now;
            } else {
                setPlaying(null);
                setEstimatedPlaying(null);
            }
        } catch (error) {
            console.error("Failed to fetch current playback", error);
        }
    };

    useEffect(() => {
        refreshPlaying();
        const interval = window.setInterval(refreshPlaying, 5000);
        return () => window.clearInterval(interval);
    }, []);

    // Update estimated position every second when media is playing
    useEffect(() => {
        if (!estimatedPlaying?.position_seconds || !estimatedPlaying?.duration_seconds) return;

        estimatedPlayingRef.current = estimatedPlaying;

        const interval = window.setInterval(() => {
            const current = estimatedPlayingRef.current;

            // Only estimate if media is playing (not paused/stopped)
            if (current?.status === "playing" &&
                current.position_seconds !== undefined &&
                current.duration_seconds !== undefined &&
                current.duration_seconds > 0) {

                const estimatedPosition = Math.min(
                    current.position_seconds + 1,
                    current.duration_seconds
                );

                setEstimatedPlaying(prev => {
                    if (!prev) return prev;
                    const next = {
                        ...prev,
                        position_seconds: estimatedPosition
                    };
                    estimatedPlayingRef.current = next;
                    return next;
                });
            }
        }, 1000);

        return () => window.clearInterval(interval);
    }, [estimatedPlaying]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setResults([]);
            return;
        }

        const searchResults = await search(query, mediaType);
        if (Array.isArray(searchResults)) {
            setResults(searchResults);
        }
    }

    const handleMediaTypeChange = (type: MediaType) => {
        setMediaType(type);

        if (searchQuery.trim()) {
            search(searchQuery, type).then(searchResults => {
                if (Array.isArray(searchResults)) {
                    setResults(searchResults);
                }
            });
        }
    };

    return (
        <div className="bg-background text-foreground gap-4 min-h-screen flex flex-col pb-35">
            {detailView ? (
                // Show only the detail view when an item is selected
                detailView.type === "movie" ? (
                    <MovieDetails movieId={detailView.id} close={() => setDetailView(null)} />
                ) : (
                    <SeriesDetails seriesId={detailView.id} close={() => setDetailView(null)} />
                )
            ) : (
                <>
                    {searchVisible && (
                        <div className="pt-5 px-3">
                            <SearchBox query={searchQuery} onSearch={handleSearch} onClose={() => setResults([])} loading={loading} />
                        </div>
                    )}
                    {estimatedPlaying && playing && (
                        <CurrentlyPlaying
                            item={estimatedPlaying}
                            onChanged={(item) => {
                                setPlaying(item);
                                setEstimatedPlaying(item);
                                lastUpdateRef.current = Date.now();
                            }}
                        />
                    )}
                    {results.length > 0 ? (
                        <SearchResults setSearchVisible={setSearchVisible} results={results} query={searchQuery} mediaType={mediaType} onMediaTypeChange={handleMediaTypeChange} />
                    ) : !(searchVisible && searchQuery.trim() !== "") ? (
                        <>
                            <ContinueWatchingSection
                                continueWatching={continueWatchingData}
                                loading={continueWatchingLoading}
                                onItemClick={(item) => {
                                    if (item.media_type === "movie") {
                                        setDetailView({ type: "movie", id: item.id });
                                    } else if (item.series_tmdb_id) {
                                        setDetailView({ type: "series", id: item.series_tmdb_id });
                                    }
                                }}
                            />
                            <WatchlistSection
                                watchlist={watchlistData}
                                loading={watchlistLoading}
                                onItemClick={(item) => {
                                    setDetailView({
                                        type: item.media_type === "movie" ? "movie" : "series",
                                        id: item.tmdb_id
                                    });
                                }}
                            />
                        </>
                    ) : null}
                </>
            )}
        </div>
    );
}