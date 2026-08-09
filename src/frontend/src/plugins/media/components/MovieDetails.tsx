import { useState, useEffect } from "react";
import { X, Play, Download, Cast } from "lucide-react";
import { useGetMovieDetails, type MovieDetails } from "../useMedia";
import { getReleaseTypeDescription, useDominantColor } from "../utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function MovieDetails({ movieId, close }: { movieId: number; close?: () => void }) {
    const { getMovieDetails, loading } = useGetMovieDetails(movieId);
    const [movieDetails, setMovieDetails] = useState<MovieDetails | null>(null);

    useEffect(() => {
        const fetchMovieDetails = async () => {
            const details = await getMovieDetails();
            setMovieDetails(details);
        };

        fetchMovieDetails();
    }, [getMovieDetails]);

    const posterUrl = movieDetails?.poster_path
        ? `https://image.tmdb.org/t/p/w200${movieDetails.poster_path}`
        : undefined;
    const dominantColor = useDominantColor(posterUrl);
    const release_type = getReleaseTypeDescription(movieDetails?.release_type || 6, movieDetails?.release_date);

    if (loading) {
        return <Skeleton className="w-full h-64" />;
    }

    if (!movieDetails) {
        return <div>No details available for this movie.</div>;
    }

    const releaseYear = movieDetails.release_date
        ? new Date(movieDetails.release_date).getFullYear()
        : null;

    const durationString = `${Math.floor(movieDetails.duration_seconds / 3600)}h ${Math.floor((movieDetails.duration_seconds % 3600) / 60)}mins`;

    return (
        <div className="relative bg-black min-h-dvh overflow-hidden">
            {/* Ambient color glow, derived from poster */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[110dvh] opacity-60 blur-[100px]"
                style={{
                    background: dominantColor
                        ? `radial-gradient(ellipse 100% 100% at 50% 0%, ${dominantColor}, transparent 100%)`
                        : undefined,
                }}
            />

            <div className="relative">
                {/* Hero */}
                <div className="relative w-full h-[40dvh] overflow-hidden">
                    <img
                        src={`https://image.tmdb.org/t/p/w1280${movieDetails.backdrop_path ? movieDetails.backdrop_path : movieDetails.poster_path}`}
                        alt={movieDetails.title}
                        className="w-full h-full object-cover"
                    />
                    {/* Gradient still lives inside the image bounds for the image-darkening effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />

                    {close && (
                        <Button
                            onClick={close}
                            variant="ghost"
                            size="icon"
                            aria-label="Close"
                            className="absolute right-4 z-10 h-9 w-9 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
                            style={{ top: "calc(env(safe-area-inset-top))" }}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}

                    <div className="absolute bottom-6 left-6 right-6 flex flex-col items-center justify-center text-center">
                        {movieDetails.logo_path ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w500${movieDetails.logo_path}`}
                                alt={movieDetails.title}
                                className="w-2/3 max-w-[320px] h-auto drop-shadow-lg"
                            />
                        ) : (
                            <h1 className="text-4xl font-bold text-white drop-shadow-lg">{movieDetails.title}</h1>
                        )}
                    </div>
                </div>

                {/* Overlap fade — extends the darkening past the image edge into the content zone */}
                <div className="relative h-24 bg-gradient-to-b from-black to-transparent pointer-events-none" />

                {/* Content below hero — pulled up to sit under the overlap fade */}
                <div className="relative -mt-24 px-6 text-white">
                    {/* Action buttons */}
                    <div className="flex gap-2.5 mb-6">
                        <Button className="flex-1 h-auto flex-col gap-1.5 py-3 rounded-2xl bg-white text-black hover:bg-white/90 shadow-sm active:scale-[0.97] transition-transform duration-150">
                            <Play className="w-[18px] h-[18px]" fill="currentColor" strokeWidth={0} />
                            <span className="text-[13px] font-medium tracking-tight">Play</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 h-auto flex-col gap-1.5 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white/90 hover:bg-white/10 hover:text-white active:scale-[0.97] transition-transform duration-150"
                        >
                            <Cast className="w-[18px] h-[18px]" strokeWidth={1.75} />
                            <span className="text-[13px] font-medium tracking-tight">Stream</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 h-auto flex-col gap-1.5 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white/90 hover:bg-white/10 hover:text-white active:scale-[0.97] transition-transform duration-150"
                        >
                            <Download className="w-[18px] h-[18px]" strokeWidth={1.75} />
                            <span className="text-[13px] font-medium tracking-tight">Download</span>
                        </Button>
                    </div>

                    <Card
                        className="border-white/10 pt-3 bg-white/[0.06] rounded-2xl shadow-sm"
                        style={{
                            background: dominantColor
                                ? `linear-gradient(160deg, ${dominantColor}33, rgba(255,255,255,0.03) 70%)`
                                : undefined,
                        }}
                    >
                        <CardContent className="px-3 justify-center items-center flex flex-col gap-1">
                            {releaseYear && (
                                <p className="text-center text-sm text-muted-foreground mb-3">Movie | {releaseYear} | {durationString}</p>
                            )}
                            {release_type && (
                                <Button className="mb-3 bg-white/[0.06] border border-white/10 text-white/90 hover:bg-white/10 hover:text-white active:scale-[0.97] transition-transform duration-150">
                                    <p className="text-sm text-foreground">{release_type}</p>
                                </Button>
                            )}
                            <p className="text-sm leading-relaxed text-gray-300">
                                {movieDetails.description || "No description available for this movie."}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}