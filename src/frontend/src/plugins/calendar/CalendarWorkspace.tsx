import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, endOfDay, endOfWeek, format, isSameDay, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, Filter, Plus, RefreshCw, Settings2, SlidersHorizontal, X } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCalendarVisibility } from "./useCalendarVisibility";

interface CalendarEvent {
    id: number;
    source_id: number;
    title: string;
    description?: string | null;
    location?: string | null;
    start: string;
    end: string;
    all_day: boolean;
    colour: string;
}

interface CalendarSource {
    id: number;
    name: string;
    colour: string;
    can_write: boolean;
    is_default: boolean;
}

interface CalendarState {
    connected: boolean;
    sync_status: string;
    last_synced_at?: string | null;
    last_error?: string | null;
    next_event?: CalendarEvent | null;
}

type CalendarView = "day" | "week";
const UK_TIMEZONE = "Europe/London";

function dateValue(value: string) {
    return new Date(value);
}

function timeLabel(event: CalendarEvent) {
    if (event.all_day) return "All day";
    return `${format(dateValue(event.start), "HH:mm")} - ${format(dateValue(event.end), "HH:mm")}`;
}

function EventRow({ event }: { event: CalendarEvent }) {
    return (
        <article className="flex gap-3 rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm transition-colors hover:bg-card">
            <div className="mt-1 h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: event.colour }} />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h3 className="truncate text-sm font-semibold">{event.title}</h3>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeLabel(event)}</span>
                </div>
                {event.location && <p className="mt-1 truncate text-xs text-muted-foreground">{event.location}</p>}
            </div>
        </article>
    );
}

function DateRail({ date, view, events, onSelect }: { date: Date; view: CalendarView; events: CalendarEvent[]; onSelect: (date: Date) => void }) {
    const start = view === "day" ? date : startOfWeek(date, { weekStartsOn: 1 });
    const days = Array.from({ length: view === "day" ? 1 : 7 }, (_, index) => addDays(start, index));
    return (
        <div className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-1", view === "day" && "sm:grid sm:grid-cols-7 sm:overflow-visible")}>
            {days.map((day) => {
                const selected = isSameDay(day, date);
                const today = isSameDay(day, new Date());
                const count = events.filter((event) => isSameDay(dateValue(event.start), day)).length;
                return <button key={day.toISOString()} type="button" onClick={() => onSelect(day)} className={cn("min-w-[4.75rem] rounded-xl border px-3 py-2 text-center transition-colors", selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/60 bg-card/45 hover:bg-card", today && !selected && "border-primary/50")}><span className="block text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">{format(day, "EEE")}</span><span className="mt-1 block text-lg font-bold">{format(day, "d")}</span><span className="mt-0.5 block text-[11px] opacity-75">{count} event{count === 1 ? "" : "s"}</span></button>;
            })}
        </div>
    );
}

export default function CalendarWorkspace() {
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>("day");
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [sources, setSources] = useState<CalendarSource[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const { isVisible, toggleSource } = useCalendarVisibility();
    const [state, setState] = useState<CalendarState | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const range = useMemo(() => {
        if (view === "day") return { start: startOfDay(date), end: endOfDay(date) };
        const start = startOfWeek(date, { weekStartsOn: 1 });
        return { start, end: endOfWeek(date, { weekStartsOn: 1 }) };
    }, [date, view]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [nextState, nextSources, nextEvents] = await Promise.all([
                apiFetch<CalendarState>("/calendar/state"),
                apiFetch<CalendarSource[]>("/calendar/sources"),
                apiFetch<CalendarEvent[]>(`/calendar/events?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`),
            ]);
            setState(nextState);
            setSources(nextSources);
            setEvents(nextEvents);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load calendar");
        } finally {
            setLoading(false);
        }
    }, [range.end, range.start]);

    useEffect(() => { void load(); }, [load]);
    useWebSocketEvent("calendar.state_updated", () => { void load(); });

    const sourceIds = sources.map((source) => source.id);
    const displayedEvents = events.filter((event) => isVisible(event.source_id, sourceIds));
    const selectedDayEvents = displayedEvents.filter((event) => isSameDay(dateValue(event.start), date));
    const heading = view === "day" ? format(date, "EEEE, d MMMM") : `${format(range.start, "d MMM")} - ${format(range.end, "d MMM yyyy")}`;
    const syncLabel = state?.sync_status === "synced" ? "Synced" : state?.sync_status === "error" ? "Sync needs attention" : "Not connected";

    function move(direction: number) {
        setDate((current) => view === "day" ? addDays(current, direction) : direction > 0 ? addWeeks(current, 1) : subWeeks(current, 1));
    }

    async function syncNow() {
        setSyncing(true);
        try {
            await apiFetch("/calendar/sync", { method: "POST" });
            await load();
        } finally {
            setSyncing(false);
        }
    }

    return (
        <main className="min-h-screen bg-background px-3 pb-35 text-foreground">
            <div className="flex flex-col gap-5 pt-5">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div><div className="flex items-center gap-2 text-primary"><CalendarDays className="size-4" /><p className="text-xs font-semibold uppercase tracking-[0.18em]">Calendar</p></div><h1 className="mt-1 text-2xl font-bold tracking-tight">{heading}</h1><p className="mt-1 text-xs text-muted-foreground">{UK_TIMEZONE} · {syncLabel}</p></div>
                    <div className="flex items-center gap-2"><Button variant="outline" size="icon-sm" aria-label="Previous period" title="Previous period" onClick={() => move(-1)}><ChevronLeft /></Button><Button variant="outline" size="icon-sm" aria-label="Next period" title="Next period" onClick={() => move(1)}><ChevronRight /></Button><Button variant="outline" size="icon-sm" aria-label="Sync calendar" title="Sync calendar" onClick={() => void syncNow()} disabled={syncing}><RefreshCw className={cn(syncing && "animate-spin")} /></Button><Button size="icon-sm" aria-label="Create event" title="Create event"><Plus /></Button></div>
                </header>

                {!state?.connected && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Connect Google Calendar</p><p className="mt-1 text-xs text-muted-foreground">Sync your calendars into Toto and create events from here.</p></div></div><Button variant="outline" size="sm" onClick={async () => { const result = await apiFetch<{ authorization_url: string }>("/calendar/connect"); window.location.href = result.authorization_url; }}><Settings2 /> Connect</Button></div>}
                {state?.last_error && <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-xs text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" /><span>Some calendars could not sync: {state.last_error}</span></div>}
                {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</div>}

                <section className="flex items-center justify-between gap-3"><div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 p-1">{(["day", "week"] as CalendarView[]).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize", view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{option}</button>)}</div><Button variant="outline" size="sm" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><SlidersHorizontal /> Calendars</Button></section>

                {filtersOpen && <section className="rounded-xl border border-border/70 bg-card/35 p-3 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><Filter className="size-4 text-primary" /> Visible calendars</div><Button variant="ghost" size="icon-sm" onClick={() => setFiltersOpen(false)} aria-label="Close calendar filters" title="Close calendar filters"><X /></Button></div><div className="flex flex-wrap gap-2">{sources.map((source) => <button key={source.id} type="button" onClick={() => void toggleSource(source.id, sourceIds)} className={cn("flex items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-xs transition-opacity", !isVisible(source.id, sourceIds) && "opacity-35")}><span className="size-2 rounded-full" style={{ backgroundColor: source.colour }} />{source.name}</button>)}{sources.length === 0 && <span className="text-xs text-muted-foreground">Calendars will appear here after the first sync.</span>}</div></section>}

                <DateRail date={date} view={view} events={displayedEvents} onSelect={setDate} />

                <section className="rounded-xl border border-border/70 bg-card/35 p-3 shadow-sm sm:p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{view === "day" ? "Day agenda" : "Selected day"}</p><h2 className="mt-1 text-lg font-bold">{format(date, "EEEE, d MMMM")}</h2></div><span className="text-xs text-muted-foreground">{selectedDayEvents.length} event{selectedDayEvents.length === 1 ? "" : "s"}</span></div>{loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading calendar...</div> : selectedDayEvents.length ? <div className="flex flex-col gap-2">{selectedDayEvents.map((event) => <EventRow key={event.id} event={event} />)}</div> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing scheduled for this day.</div>}</section>

                {view === "week" && <section className="hidden gap-3 md:grid md:grid-cols-2">{Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date, { weekStartsOn: 1 }), index)).filter((day) => !isSameDay(day, date)).map((day) => { const dayEvents = displayedEvents.filter((event) => isSameDay(dateValue(event.start), day)); return <button key={day.toISOString()} type="button" onClick={() => setDate(day)} className="rounded-xl border border-border/60 bg-card/45 p-3 text-left transition-colors hover:bg-card"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{format(day, "EEE d")}</span><span className="text-xs text-muted-foreground">{dayEvents.length}</span></div><p className="mt-2 truncate text-sm font-medium">{dayEvents[0]?.title ?? "Nothing scheduled"}</p>{dayEvents.length > 1 && <p className="mt-1 text-xs text-muted-foreground">+{dayEvents.length - 1} more</p>}</button>; })}</section>}

                <footer className="flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-2"><Clock3 className="size-3.5" />{state?.last_synced_at ? `Last synced ${format(dateValue(state.last_synced_at), "d MMM, HH:mm")}` : "Waiting for first sync"}</span><span>{displayedEvents.length} event{displayedEvents.length === 1 ? "" : "s"} in range</span></footer>
            </div>
        </main>
    );
}
