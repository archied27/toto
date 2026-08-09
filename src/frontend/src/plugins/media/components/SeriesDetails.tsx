import { useEffect, useState } from "react";
import { useGetSeriesDetails, type FullSeriesDetails, type SeasonDetails } from "../useMedia";
import { isEpisodeAvailable, formatDuration, useDominantColor } from "../utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Cast, ChevronDown, Download, Play, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function SeriesDetails({ seriesId, close }: { seriesId: number; close?: () => void }) {
    const { getSeriesDetails, loading } = useGetSeriesDetails(seriesId);
    const [seriesDetails, setSeriesDetails] = useState<FullSeriesDetails | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<SeasonDetails | null>(null);


    useEffect(() => {
        const fetchSeriesDetails = async () => {
            const details = await getSeriesDetails();
            setSeriesDetails(details);
            setSelectedSeason(details?.seasons[0] || null);
        };

        fetchSeriesDetails();
    }, [getSeriesDetails]);

    const posterUrl = seriesDetails?.poster_path
        ? `https://image.tmdb.org/t/p/w200${seriesDetails.poster_path}`
        : undefined;
    const dominantColor = useDominantColor(posterUrl);

    if (loading) {
        return <Skeleton className="w-full h-64" />;
    }

    if (!seriesDetails) {
        return <div>No details available for this series.</div>;
    }

    const releaseYear = selectedSeason?.air_date
        ? new Date(selectedSeason.air_date).getFullYear()
        : null;

    return (
        <div className="relative bg-black min-h-dvh overflow-hidden pb-25 mb-0">
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
                        src={`https://image.tmdb.org/t/p/w1280${seriesDetails.backdrop_path ? seriesDetails.backdrop_path : seriesDetails.poster_path}`}
                        alt={seriesDetails.title}
                        className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

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
                        {seriesDetails.logo_path ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w500${seriesDetails.logo_path}`}
                                alt={seriesDetails.title}
                                className="w-2/3 max-w-[320px] h-auto drop-shadow-lg"
                            />
                        ) : (
                            <h1 className="text-4xl font-bold text-white drop-shadow-lg">{seriesDetails.title}</h1>
                        )}
                    </div>
                </div>
                    
                <div className="relative h-24 bg-gradient-to-b from-black to-transparent pointer-events-none" />

                <div className="relative -mt-26 px-6 text-white">
                    <div className="flex gap-2.5 mb-3 items-center justify-center">
                        <Card
                            className="border-white/10 pt-3 p-3 text-center h-full bg-white/[0.06] rounded-md shadow-sm"
                            style={{
                                background: dominantColor
                                    ? `linear-gradient(160deg, ${dominantColor}33, rgba(255,255,255,0.03) 70%)`
                                    : undefined,
                            }}
                        >
                            <p className="text-md text-muted-foreground font-semibold">Aired {releaseYear}</p>
                        </Card>
                    </div>

                    <div className="flex gap-2.5 mb-6">
                        <Button
                            variant="outline" 
                            className="flex-1 h-auto flex-col gap-1.5 py-3 rounded-2xl bg-white text-black hover:bg-white/90 shadow-sm active:scale-[0.97] transition-transform duration-150"
                        >
                            <Play className="w-[18px] h-[18px]" fill="white" strokeWidth={0} />
                            <span className="text-[13px] text-white font-medium tracking-tight">Play</span>
                        </Button>

                        <Button
                            variant="outline"
                            className="flex-1 h-auto flex-col gap-1.5 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white/90 hover:bg-white/10 hover:text-white active:scale-[0.97] transition-transform duration-150"
                        >
                            <Cast className="w-[18px] h-[18px]" strokeWidth={1.75} />
                            <span className="text-[13px] text-white font-medium tracking-tight">Stream</span>
                        </Button>

                        <Button
                            variant="outline"
                            className="flex-1 h-auto flex-col gap-1.5 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-white/90 hover:bg-white/10 hover:text-white active:scale-[0.97] transition-transform duration-150"
                        >
                            <Download className="w-[18px] h-[18px]" strokeWidth={1.75} />
                            <span className="text-[13px] text-white font-medium tracking-tight">Download</span>
                        </Button>
                    </div>

                    {/* Episode List */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="text-muted-foreground mb-3"
                            >
                                {selectedSeason ? selectedSeason.title : "Select Season"}
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent>
                            {seriesDetails.seasons.map((season) => (
                                <Button
                                    key={season.title}
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => setSelectedSeason(season)}
                                >
                                    {season.title}
                                </Button>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <p className="flex-1 text-lg font-semibold mb-3 text-center">Episodes <span className="text-sm text-muted-foreground">({selectedSeason?.episodes.length})</span> </p>
                    {selectedSeason && selectedSeason.episodes.map((episode) => {
                        const still_path = episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : undefined;
                        const available = isEpisodeAvailable(episode.air_date);
                        
                        return (
                            <Card
                                className={`overflow-hidden mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-0 ${!available ? "opacity-50" : ""}`}
                                style={{
                                    background: dominantColor
                                        ? `linear-gradient(160deg, ${dominantColor}40, rgba(255,255,255,0.03) 70%)`
                                        : undefined,
                                }}
                            >
                                <div className="flex h-24">
                                    <img
                                        src={still_path}
                                        alt={episode.title}
                                        className="h-full w-30 object-cover shrink-0 rounded-r-lg"
                                    />

                                    <div className="flex min-w-0 flex-1 flex-col justify-center px-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="truncate text-sm font-semibold text-white">
                                                {episode.title}
                                            </h3>
                                            {episode.duration_seconds && (
                                                <span className="shrink-0 text-xs text-muted-foreground ml-auto">
                                                    {formatDuration(episode.duration_seconds)}
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                            {episode.description}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}

                </div>
            </div>
        </div>
    );
}