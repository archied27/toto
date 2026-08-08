import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SearchBox({
    query: externalQuery,
    onSearch,
    onClose,
    loading,
}: {
    query: string;
    onSearch: (query: string) => void;
    onClose: () => void;
    loading: boolean;
}) {
    const [query, setQuery] = useState(externalQuery);
    const [searchOpen, setSearchOpen] = useState(externalQuery.length > 0);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setQuery(externalQuery);
        if (externalQuery.length > 0) {
            setSearchOpen(true);
        }
    }, [externalQuery]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onSearch(newQuery);
        }, 500);
    };

    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const openSearch = () => {
        setSearchOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const collapseSearch = () => {
        setSearchOpen(false);
        setQuery("");
        onSearch("");
        onClose();
    };

    const handleXClick = () => {
        if (query) {
            setQuery("");
            onSearch("");
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            inputRef.current?.focus();
        } else {
            collapseSearch();
        }
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (debounceRef.current) {
                    clearTimeout(debounceRef.current);
                }
                onSearch(query);
            }}
            className="flex justify-end px-2"
        >
            <InputGroup
                className={`flex items-center transition-[width] duration-300 ease-in-out overflow-hidden ${
                    searchOpen ? "w-full max-w-md pl-0" : "w-9"
                }`}
            >
                <button
                    type="button"
                    onClick={searchOpen ? undefined : openSearch}
                    className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full"
                    aria-label="Open search"
                >
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                </button>

                <InputGroupInput
                    ref={inputRef}
                    placeholder="Search"
                    value={query}
                    onChange={handleInputChange}
                    className={`w-full transition-opacity duration-200 pl-0 ${searchOpen ? "opacity-100" : "opacity-0"}`}
                />

                <Loader2Icon
                    className={`h-4 w-4 text-muted-foreground flex-shrink-0 mr-2 ${
                        searchOpen && loading ? "animate-spin" : "hidden"
                    }`}
                />
                <button
                    type="button"
                    onClick={handleXClick}
                    className={`flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full ${
                        searchOpen && !loading ? "visible" : "hidden"
                    }`}
                    aria-label={query ? "Clear search" : "Close search"}
                >
                    <XIcon className="h-4 w-4 text-muted-foreground" />
                </button>
            </InputGroup>
        </form>
    );
}