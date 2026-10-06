import { type ContinueWatchingItem } from "../useMedia";

interface ContinueWatchingSectionProps {
  continueWatching: ContinueWatchingItem[];
  loading: boolean;
  onItemClick: (item: ContinueWatchingItem) => void;
}

export function ContinueWatchingSection({
  continueWatching,
  loading,
  onItemClick,
}: ContinueWatchingSectionProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full border-4 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading continue watching...</span>
      </div>
    );
  }

  const formatTimeLeft = (item: ContinueWatchingItem) => {
    const secondsLeft = Math.max(0, Math.round(item.duration_seconds - item.progress_seconds));
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-3 text-lg font-semibold text-foreground">Continue Watching</h2>
      <div className="swiper-no-swiping flex max-w-full gap-3 overflow-x-auto overscroll-x-contain px-3 pb-2 touch-pan-x scrollbar-none">
        {continueWatching.map((item) => {
          const episodeLabel = item.media_type === "episode"
            ? `S${String(item.season_number ?? 0).padStart(2, "0")}E${String(item.episode_number ?? 0).padStart(2, "0")}`
            : "Movie";

          return (
            <button
              key={`${item.media_type}-${item.id}`}
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
              <p className="truncate text-[0.725rem] font-bold text-muted-foreground">
                {episodeLabel} <span className="font-normal">| {formatTimeLeft(item)}</span>
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}