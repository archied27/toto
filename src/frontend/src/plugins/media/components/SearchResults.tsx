import { useState } from "react";
import type { HomePageResult } from "../useMedia";
import { MovieDetails } from "./MovieDetails";
import { SeriesDetails } from "./SeriesDetails";
import { getReleaseTypeDescription } from "../utils";

export function SearchResults({ results, setSearchVisible }: { results: HomePageResult[]; setSearchVisible: (visible: boolean) => void }) {
    const [mediaSelected, setMediaSelected] = useState<number | null>(null);
    const [mediaSelectedType, setMediaSelectedType] = useState<"movie" | "show" | null>(null);

    if (mediaSelected !== null) {
        if (mediaSelectedType === "movie") {
            return <MovieDetails movieId={mediaSelected} 
                    close={() => {
                        setMediaSelected(null)
                        setSearchVisible(true)
                    }} />;
        }

        if (mediaSelectedType === "show") {
            return <SeriesDetails seriesId={mediaSelected} 
                    close={() => {
                        setMediaSelected(null)
                        setSearchVisible(true)
                    }} />;
        }
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2">
            {results.map((result) => {
                const releaseStatus = getReleaseTypeDescription(result.release_type, result.release_date);
                const available = releaseStatus !== "Not Released" || "Premiered" || "Currently In Theaters";

                return (
                    <div key={result.id} className="flex flex-col items-center"
                        onClick={() => {
                            setMediaSelectedType(result.media_type);
                            setMediaSelected(result.id)
                            setSearchVisible(false);
                        }}>
                        {result.poster_path ? (
                            <img
                                src={`https://image.tmdb.org/t/p/w400${result.poster_path}`}
                                alt={result.title}
                                loading="lazy"
                                decoding="async"
                                className={`w-full aspect-[2/3] object-cover rounded-lg bg-muted ${available ? "" : "opacity-50"}`}
                            />
                        ) : (
                            <div className="w-full aspect-[2/3] rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                <p className="text-center font-medium text-muted-foreground">{result.title}</p>
                            </div>
                        )}
                        <div className={`text-center ${available ? "" : "opacity-50"}`}>
                            <h3 className="text-sm font-bold text-center mt-2">{result.title}</h3>
                            <p className="text-[0.725rem] font-bold text-muted-foreground">
                                <span className="capitalize">{result.media_type}</span> | {result.release_date?.slice(0, 4)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    )
}