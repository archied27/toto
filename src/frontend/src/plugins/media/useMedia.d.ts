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
export declare function useSearch(): {
    search: (query: string) => Promise<HomePageResult[]>;
    loading: boolean;
};
export declare function useGetMovieDetails(movieId: number): {
    getMovieDetails: () => Promise<MovieDetails | null>;
    loading: boolean;
};
