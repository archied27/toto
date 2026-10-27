import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, endOfDay, endOfWeek, format, isSameDay, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, Plus, RefreshCw, Settings2 } from "lucide-react";
import { apiFetch } from "@/hooks/api";
import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";
import { Button } from "@/components/ui/button";
import { WidgetContainer } from "@/components/WidgetContainer";
import { useNavigation } from "@/hooks/NavigationContext";
import { cn } from "@/lib/utils";
import CalendarWorkspace from "./CalendarWorkspace";
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
    next_event?: CalendarEvent | null;
}

type CalendarView = "day" | "week";

const UK_TIMEZONE = "Europe/London";

function localDate(value: string) {
    return new Date(value);
}

function eventTime(event: CalendarEvent) {
    if (event.all_day) return "All day";
    return `${format(localDate(event.start), "HH:mm")} - ${format(localDate(event.end), "HH:mm")}`;
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
    return (
        <article className="group rounded-lg border-l-2 bg-card/60 px-3 py-2.5 shadow-sm transition-colors hover:bg-card" style={{ borderColor: event.colour }}>
            <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-sm font-semibold text-foreground">{event.title}</h3>
                <span className="shrink-0 text-[11px] text-muted-foreground">{eventTime(event)}</span>
            </div>
            {event.location && <p className="mt-1 truncate text-xs text-muted-foreground">{event.location}</p>}
        </article>
    );
}

function DayColumn({ date, events }: { date: Date; events: CalendarEvent[] }) {
    const allDay = events.filter((event) => event.all_day);
    const timed = events.filter((event) => !event.all_day);
    return (
        <section className="min-h-[28rem] border-l border-border/60 first:border-l-0">
            <header className={cn("border-b border-border/60 px-3 py-3", isSameDay(date, new Date()) && "bg-primary/10")}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{format(date, "EEE")}</p>
                <p className={cn("mt-1 text-2xl font-semibold", isSameDay(date, new Date()) && "text-primary")}>{format(date, "d")}</p>
            </header>
            <div className="space-y-2 p-2">
                {allDay.map((event) => <CalendarEventCard key={event.id} event={event} />)}
                {timed.map((event) => <CalendarEventCard key={event.id} event={event} />)}
                {events.length === 0 && <p className="px-2 py-4 text-xs text-muted-foreground/70">Nothing scheduled</p>}
            </div>
        </section>
    );
}

export function LegacyCalendarPage() {
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>("week");
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [sources, setSources] = useState<CalendarSource[]>([]);
    const [visibleSources, setVisibleSources] = useState<number[]>([]);
    const [state, setState] = useState<CalendarState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const range = useMemo(() => {
        if (view === "day") return { start: startOfDay(date), end: endOfDay(date), days: [date] };
        const start = startOfWeek(date, { weekStartsOn: 1 });
        return { start, end: endOfWeek(date, { weekStartsOn: 1 }), days: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
    }, [date, view]);
    const rangeStart = range.start.getTime();
    const rangeEnd = range.end.getTime();

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
            setVisibleSources((current) => current.length ? current.filter((id) => nextSources.some((source) => source.id === id)) : nextSources.map((source) => source.id));
            setEvents(nextEvents);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load calendar");
        } finally {
            setLoading(false);
        }
    }, [range.end, range.start]);

    useEffect(() => { void load(); }, [load, rangeEnd, rangeStart]);
    useWebSocketEvent("calendar.state_updated", () => { void load(); });

    const displayedEvents = events.filter((event) => visibleSources.includes(event.source_id));
    const heading = view === "day" ? format(date, "EEEE, d MMMM") : `${format(range.start, "d MMM")} - ${format(range.end, "d MMM yyyy")}`;

    function move(direction: number) {
        setDate((current) => view === "day" ? addDays(current, direction) : direction > 0 ? addWeeks(current, 1) : subWeeks(current, 1));
    }

    function toggleSource(sourceId: number) {
        setVisibleSources((current) => current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]);
    }

    return (
        <main className="min-h-screen bg-background px-3 pb-35 text-foreground">
            <div className="flex flex-col gap-5 pt-5">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-primary"><CalendarDays className="size-4" /><p className="text-xs font-semibold uppercase tracking-[0.18em]">Calendar</p></div>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight">{heading}</h1>
                        <p className="mt-1 text-xs text-muted-foreground">{UK_TIMEZONE} · Google Calendar sync</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon-sm" aria-label="Previous period" title="Previous period" onClick={() => move(-1)}><ChevronLeft /></Button>
                        <Button variant="outline" size="icon-sm" aria-label="Next period" title="Next period" onClick={() => move(1)}><ChevronRight /></Button>
                        <Button variant="outline" size="icon-sm" aria-label="Sync calendar" title="Sync calendar" onClick={() => void load()}><RefreshCw /></Button>
                        <Button size="icon-sm" aria-label="Create event" title="Create event"><Plus /></Button>
                    </div>
                </header>

                {!state?.connected && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm">
                        <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Connect Google Calendar</p><p className="mt-1 text-xs text-muted-foreground">Sync your calendars into Toto and create events from here.</p></div></div>
                        <Button variant="outline" size="sm" onClick={async () => { const result = await apiFetch<{ authorization_url: string }>("/calendar/connect"); window.location.href = result.authorization_url; }}><Settings2 /> Connect</Button>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/45 px-3 py-3 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        {sources.map((source) => (
                            <button key={source.id} type="button" onClick={() => toggleSource(source.id)} className={cn("flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-xs transition-opacity", !visibleSources.includes(source.id) && "opacity-35")}>
                                <span className="size-2 rounded-full" style={{ backgroundColor: source.colour }} />{source.name}
                            </button>
                        ))}
                        {sources.length === 0 && <span className="text-xs text-muted-foreground">All calendars will appear here after the first Google sync.</span>}
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 p-1">
                        {(["day", "week"] as CalendarView[]).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize", view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{option}</button>)}
                    </div>
                </div>

                {error && <p className="text-sm text-rose-300">{error}</p>}
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card/35 shadow-sm">
                    {loading ? <div className="flex min-h-[28rem] items-center justify-center text-sm text-muted-foreground">Loading calendar...</div> : <div className={cn("grid", view === "day" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-7")}>{range.days.map((day) => <DayColumn key={day.toISOString()} date={day} events={displayedEvents.filter((event) => isSameDay(localDate(event.start), day))} />)}</div>}
                </div>

                <footer className="flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-2"><Clock3 className="size-3.5" />{state?.last_synced_at ? `Last synced ${format(localDate(state.last_synced_at), "d MMM, HH:mm")}` : "Waiting for first sync"}</span><span>{displayedEvents.length} event{displayedEvents.length === 1 ? "" : "s"}</span></footer>
            </div>
        </main>
    );
}

export function CalendarHero() {
    const { navigate } = useNavigation();
    const { state, events, nextEvent } = useCalendarWidgetData();
    return <WidgetContainer onClick={() => navigate("calendar")} className="cursor-pointer">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
            <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Next up</p><p className="mt-1 truncate text-2xl font-bold">{nextEvent?.title ?? (state?.connected ? "Nothing scheduled" : "Calendar")}</p></div>
                <CalendarDays className="size-7 text-primary" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                {nextEvent && <p className="text-sm text-muted-foreground">{nextEvent.all_day ? "All day" : format(localDate(nextEvent.start), "EEE d MMM · HH:mm")}{nextEvent.location ? ` · ${nextEvent.location}` : ""}</p>}
                {events.slice(0, 2).map((event) => <div key={event.id} className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-2 py-1.5"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: event.colour }} /><span className="truncate text-sm font-medium">{event.title}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{event.all_day ? "All day" : format(localDate(event.start), "HH:mm")}</span></div>)}
            </div>
            <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs text-muted-foreground"><span>{events.length} event{events.length === 1 ? "" : "s"} today</span><span>{state?.sync_status === "synced" ? "Synced" : "Not connected"}</span></div>
        </div>
    </WidgetContainer>;
}

export function CalendarSmall() {
    const { navigate } = useNavigation();
    const { todayEvents, nextEvent } = useCalendarWidgetData();
    return <WidgetContainer onClick={() => navigate("calendar")} className="cursor-pointer"><div className="flex h-full flex-col justify-center gap-2"><div className="flex items-center justify-between"><CalendarDays className="size-5 text-primary" /><span className="text-xs text-muted-foreground">{todayEvents.length} today</span></div><p className="truncate text-lg font-bold">{nextEvent?.title ?? "Nothing next"}</p><p className="text-xs text-muted-foreground">{nextEvent ? (nextEvent.all_day ? "All day" : format(localDate(nextEvent.start), "EEE · HH:mm")) : "Your schedule is clear"}</p></div></WidgetContainer>;
}

export function CalendarLong() {
    const { navigate } = useNavigation();
    const { state, todayEvents, nextEvent } = useCalendarWidgetData();
    return <WidgetContainer onClick={() => navigate("calendar")} className="cursor-pointer"><div className="flex h-full min-w-0 items-center gap-4 overflow-hidden"><div className="flex shrink-0 items-center gap-2"><CalendarDays className="size-4 text-primary" /><div><p className="text-sm font-semibold">Next event</p><p className="text-xs text-muted-foreground">{todayEvents.length} today</p></div></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nextEvent?.title ?? "Nothing scheduled"}</p><p className="truncate text-xs text-muted-foreground">{nextEvent ? (nextEvent.all_day ? "All day" : format(localDate(nextEvent.start), "EEE d MMM · HH:mm")) : "Your schedule is clear"}</p></div><span className="shrink-0 text-xs text-muted-foreground">{state?.sync_status === "synced" ? "Synced" : "Setup needed"}</span></div></WidgetContainer>;
}

function useCalendarWidgetData() {
    const [state, setState] = useState<CalendarState | null>(null);
    const [sources, setSources] = useState<CalendarSource[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const { isVisible } = useCalendarVisibility();
    useEffect(() => {
        const now = new Date();
        void Promise.all([
            apiFetch<CalendarState>("/calendar/state"),
            apiFetch<CalendarSource[]>("/calendar/sources"),
            apiFetch<CalendarEvent[]>(`/calendar/events?start=${encodeURIComponent(startOfDay(now).toISOString())}&end=${encodeURIComponent(addDays(now, 30).toISOString())}`),
        ]).then(([nextState, nextSources, nextEvents]) => {
            setState(nextState); setSources(nextSources); setEvents(nextEvents);
        }).catch(() => setState(null));
    }, []);
    useWebSocketEvent("calendar.state_updated", () => {
        const now = new Date();
        void Promise.all([
            apiFetch<CalendarState>("/calendar/state"),
            apiFetch<CalendarSource[]>("/calendar/sources"),
            apiFetch<CalendarEvent[]>(`/calendar/events?start=${encodeURIComponent(startOfDay(now).toISOString())}&end=${encodeURIComponent(addDays(now, 30).toISOString())}`),
        ]).then(([nextState, nextSources, nextEvents]) => {
            setState(nextState); setSources(nextSources); setEvents(nextEvents);
        }).catch(() => setState(null));
    });
    const sourceIds = sources.map((source) => source.id);
    const visibleEvents = events.filter((event) => isVisible(event.source_id, sourceIds));
    const now = new Date();
    return {
        state,
        sources,
        events: visibleEvents.filter((event) => isSameDay(localDate(event.start), now)),
        todayEvents: visibleEvents.filter((event) => isSameDay(localDate(event.start), now)),
        nextEvent: visibleEvents.find((event) => new Date(event.end).getTime() >= now.getTime()) ?? null,
    };
}

export default CalendarWorkspace;