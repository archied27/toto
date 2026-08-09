import { apiFetch } from "@/hooks/api";
import { useCallback, useState } from "react";

export interface HomePageResult {
    id: number;
    title: string;
    poster_path: string;
    media_type: "movie" | "show";
    release_date: string;
    release_type: number;
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
            const data = await apiFetch(`/mpv/search?query=${query}&media_type=${mediaType}`, {
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
            const data = await apiFetch(`/mpv/movie_details/${movieId}`, {
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
            const data = await apiFetch(`/mpv/full_series_details/${seriesId}`, {
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