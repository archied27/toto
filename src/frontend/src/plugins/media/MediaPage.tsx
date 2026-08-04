import { useState } from "react";
import { SearchBox } from "./components/SearchBox";
import { SearchResults } from "./components/SearchResults";
import { useSearch, type HomePageResult } from "./useMedia";

export function MediaPage() {
    const [results, setResults] = useState<HomePageResult[]>([]);
    const [searchVisible, setSearchVisible] = useState(true);
    const { search, loading } = useSearch();

    const handleSearch = async (query: string) => {
        const searchResults = await search(query);
        if (Array.isArray(searchResults)) {
            setResults(searchResults);
        }
    }

    return (
        <div className="bg-background text-foreground gap-4 min-h-screen flex flex-col pb-35">
            {searchVisible && (
                <div className="pt-5 px-3">
                    <SearchBox onSearch={handleSearch} onClose={() => setResults([])} loading={loading} />
                </div>
            )}
            {results.length > 0 ? (
                <SearchResults setSearchVisible={setSearchVisible} results={results} />
                
            ) : (<></>
            )}
        </div>
    );
}