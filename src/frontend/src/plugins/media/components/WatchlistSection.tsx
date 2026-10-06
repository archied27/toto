import { type WatchlistItem } from "../useMedia";

interface WatchlistSectionProps {
  watchlist: WatchlistItem[];
  loading: boolean;
  onItemClick: (item: WatchlistItem) => void;
}

export function WatchlistSection({
  watchlist,
  loading,
  onItemClick,
}: WatchlistSectionProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full border-4 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading watchlist...</span>
      </div>
    );
  }

  if (watchlist.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-3 text-lg font-semibold text-foreground">My Watchlist</h2>
      <div className="swiper-no-swiping flex max-w-full gap-3 overflow-x-auto overscroll-x-contain px-3 pb-2 touch-pan-x [scrollbar-width:thin]">
        {watchlist.map((item) => {
          const releaseYear = item.release_date
            ? new Date(item.release_date).getFullYear()
            : null;

          return (
            <button
              key={`${item.media_type}-${item.tmdb_id}`}
              type="button"
              className="group flex w-[8.5rem] shrink-0 flex-col text-left sm:w-36"
              onClick={() => onItemClick(item)}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted">
                {item.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w400${item.poster_path}`}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-3 text-center text-xs font-medium text-muted-foreground">
                    {item.title}
                  </div>
                )}
              </div>
              <h3 className="mt-2 truncate text-sm font-bold text-foreground">{item.title}</h3>
              {releaseYear && (
                <p className="truncate text-[0.725rem] text-muted-foreground">
                  {releaseYear} • {item.media_type === "movie" ? "Movie" : "Series"}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
