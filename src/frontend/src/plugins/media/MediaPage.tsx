import { useState } from "react";
import { SearchBox } from "./components/SearchBox";
import { SearchResults } from "./components/SearchResults";
import { useSearch, type HomePageResult } from "./useMedia";
import type { MediaType } from "./components/MediaFilter";

export function MediaPage() {
    const [results, setResults] = useState<HomePageResult[]>([]);
    const [searchVisible, setSearchVisible] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [mediaType, setMediaType] = useState<MediaType>("all");
    const { search, loading } = useSearch();

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
    }

    return (
        <div className="bg-background text-foreground gap-4 min-h-screen flex flex-col pb-35">
            {searchVisible && (
                <div className="pt-5 px-3">
                    <SearchBox query={searchQuery} onSearch={handleSearch} onClose={() => setResults([])} loading={loading} />
                </div>
            )}
            {results.length > 0 ? (
                <SearchResults setSearchVisible={setSearchVisible} results={results} query={searchQuery} mediaType={mediaType} onMediaTypeChange={handleMediaTypeChange} />

            ) : (<></>
            )}
        </div>
    );
}