import { apiFetch } from "@/hooks/api";
import { useCallback, useState } from "react";

export interface HomePageResult {
    id: number;
    title: string;
    poster_path: string;
    media_type: string;
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

export function useSearch() {
    const [loading, setLoading] = useState(false);

    const search = useCallback(async (query: string): Promise<HomePageResult[]> => {
        setLoading(true);
        try {
            const data = await apiFetch(`/mpv/search?query=${query}`, {
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
            console.log("Fetched movie details:", data);
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