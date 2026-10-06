import { apiFetch } from "@/hooks/api";
import { useCallback, useEffect, useState } from "react";

export interface HomePageResult {
    id: number;
    title: string;
    poster_path: string;
    media_type: "movie" | "series";
    release_date: string;
    release_type: number;
}

export interface ContinueWatchingItem {
    id: number;
    title: string;
    poster_path: string;
    media_type: "movie" | "episode";
    duration_seconds: number;
    progress_seconds: number;
    last_watched: string | null;
    file_path: string;
    // Episode-specific fields
    season_number?: number;
    episode_number?: number;
    series_tmdb_id?: number;
}

export interface MovieDetails {
    title: string;
    description: string;
    release_date: string;
    poster_path: string;
    backdrop_path: string;
    logo_path: string;
    duration_seconds: number;
    release_type: number;
    position_seconds?: number;
    completed?: number;
}

export interface SeriesDetails {
    title: string;
    poster_path: string;
    logo_path: string;
    backdrop_path: string;
    id: number;
    number_of_seasons: number;
}

export interface EpisodeDetails {
    episode_num: number;
    title: string;
    description: string;
    still_path: string;
    air_date: string;
    duration_seconds: number;
    position_seconds?: number;
    completed?: number;
}

export interface SeasonDetails {
    title: string;
    air_date: string;
    poster_path: string;
    episodes: EpisodeDetails[];
}

export interface FullSeriesDetails {
    title: string;
    poster_path: string;
    logo_path: string;
    backdrop_path: string;
    id: number;
    number_of_seasons: number;
    seasons: SeasonDetails[];
}

export function useSearch() {
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (query: string, mediaType: "all" | "movie" | "tv" = "all"): Promise<HomePageResult[]> => {
        setLoading(true);
        try {
            const data = await apiFetch(`/media/search?query=${encodeURIComponent(query)}&media_type=${mediaType}`, {
                method: "GET",
            });
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Failed to search media", error);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    return { search, loading };
}

export function useGetMovieDetails(movieId: number) {
    const [loading, setLoading] = useState(false);

    const getMovieDetails = useCallback(async (): Promise<MovieDetails | null> => {
        setLoading(true);
        try {
            const data = await apiFetch(`/media/items/movie/${movieId}`, {
                method: "GET",
            });
            return data ? (data as MovieDetails) : null;
        } catch (error) {
            console.error("Failed to fetch movie details", error);
            return null;
        } finally {
            setLoading(false);
        }
    }, [movieId]);

    return { getMovieDetails, loading };
}

export function useGetSeriesDetails(seriesId: number) {
    const [loading, setLoading] = useState(false);

    const getSeriesDetails = useCallback(async (): Promise<FullSeriesDetails | null> => {
        setLoading(true);
        try {
            const data = await apiFetch(`/media/items/series/${seriesId}`, {
                method: "GET",
            });
            console.log("Fetched series details:", data);
            return data ? (data as FullSeriesDetails) : null;
        } catch (error) {
            console.error("Failed to fetch series details", error);
            return null;
        } finally {
            setLoading(false);
        }
    }, [seriesId]);

    return { getSeriesDetails, loading };
}

export function useContinueWatching() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ContinueWatchingItem[]>([]);

    const fetchContinueWatching = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiFetch<ContinueWatchingItem[]>("/media/continue-watching", {
                method: "GET",
            });
            setData(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error("Failed to fetch continue watching", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchContinueWatching();
    }, [fetchContinueWatching]);

    return { continueWatching: data, loading, refetch: fetchContinueWatching };
}

export interface WatchlistItem {
    media_type: "movie" | "series";
    tmdb_id: number;
    title: string;
    poster_path?: string;
    backdrop_path?: string;
    release_date?: string;
    added_at: string;
}

export function useWatchlist() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<WatchlistItem[]>([]);

    const fetchWatchlist = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiFetch<WatchlistItem[]>("/media/watchlist", {
                method: "GET",
            });
            setData(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error("Failed to fetch watchlist", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addToWatchlist = useCallback(async (mediaType: "movie" | "series", tmdbId: number) => {
        try {
            await apiFetch("/media/watchlist", {
                method: "POST",
                body: JSON.stringify({ media_type: mediaType, tmdb_id: tmdbId }),
            });
            await fetchWatchlist();
        } catch (error) {
            console.error("Failed to add to watchlist", error);
        }
    }, [fetchWatchlist]);

    const removeFromWatchlist = useCallback(async (mediaType: "movie" | "series", tmdbId: number) => {
        try {
            await apiFetch(`/media/watchlist/${mediaType}/${tmdbId}`, {
                method: "DELETE",
            });
            await fetchWatchlist();
        } catch (error) {
            console.error("Failed to remove from watchlist", error);
        }
    }, [fetchWatchlist]);

    const checkWatchlistStatus = useCallback(async (mediaType: "movie" | "series", tmdbId: number): Promise<boolean> => {
        try {
            const result = await apiFetch<{ in_watchlist: boolean }>(`/media/watchlist/${mediaType}/${tmdbId}/status`, {
                method: "GET",
            });
            return result?.in_watchlist ?? false;
        } catch (error) {
            console.error("Failed to check watchlist status", error);
            return false;
        }
    }, []);

    useEffect(() => {
        void fetchWatchlist();
    }, [fetchWatchlist]);

    return {
        watchlist: data,
        loading,
        refetch: fetchWatchlist,
        addToWatchlist,
        removeFromWatchlist,
        checkWatchlistStatus,
    };
}