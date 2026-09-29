import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, CircleDashed, Edit3, Flame, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { addDays, addMonths, endOfMonth, format, isFuture, isSameDay, isToday, startOfMonth } from "date-fns";
import { apiFetch } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { WidgetContainer } from "@/components/WidgetContainer";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigation } from "@/hooks/NavigationContext";
import { useWebSocketEvent } from "@/hooks/useWebSocketEvent";

interface Habit {
    id: number;
    name: string;
    colour?: string | null;
    icon?: string | null;
    description?: string | null;
    schedule_type: "daily" | "weekdays" | "weekly_days" | "interval";
    schedule_config: { days?: number[]; interval_days?: number };
    start_date?: string | null;
    end_date?: string | null;
    status: "active" | "paused" | "completed" | "archived";
}

type HabitStatus = "not_due" | "upcoming" | "due" | "completed" | "missed" | "rest";

interface HabitSummary {
    habit: Habit;
    status: HabitStatus;
    current_streak: number;
    best_streak: number;
    completion_rate: number;
}

interface DailyProgress {
    date: string;
    completed: number;
    due: number;
    percentage: number | null;
}

interface HabitsOverview {
    start_date: string;
    end_date: string;
    progress: DailyProgress[];
    completion_percentage: number;
}

type ScheduleChoice = "daily" | "weekdays" | "weekends" | "selected" | "interval";

const weekdayOptions = [
    [0, "Monday"], [1, "Tuesday"], [2, "Wednesday"], [3, "Thursday"],
    [4, "Friday"], [5, "Saturday"], [6, "Sunday"],
] as const;

const statusLabels: Record<HabitStatus, string> = {
    not_due: "Not scheduled",
    upcoming: "Upcoming",
    due: "Due",
    completed: "Completed",
    missed: "Missed",
    rest: "Rest day",
};

function isoDate(value: Date) {
    return format(value, "yyyy-MM-dd");
}

function intensity(progress: DailyProgress, future: boolean) {
    if (future) return "bg-muted/40";
    if (progress.due === 0) return "bg-muted/40";
    if (progress.percentage === 100) return "bg-emerald-400";
    if ((progress.percentage ?? 0) >= 75) return "bg-emerald-500/75";
    if ((progress.percentage ?? 0) >= 40) return "bg-emerald-600/70";
    if (progress.completed > 0) return "bg-emerald-700/65";
    return "bg-rose-500/45";
}

function monthDays(month: Date) {
    const first = startOfMonth(month);
    const leading = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const total = endOfMonth(month).getDate();
    return Array.from({ length: leading + total }, (_, index) => {
        if (index < leading) return null;
        return new Date(month.getFullYear(), month.getMonth(), index - leading + 1);
    });
}

const habitPalette = ["#34d399", "#60a5fa", "#fbbf24", "#fb7185", "#c084fc", "#2dd4bf"];

function habitColour(habit: Habit) {
    return habit.colour || habitPalette[habit.id % habitPalette.length];
}

function scheduleLabel(habit: Habit) {
    if (habit.schedule_type === "daily") return "Every day";
    if (habit.schedule_type === "weekdays") return "Weekdays";
    if (habit.schedule_type === "interval") return `Every ${habit.schedule_config.interval_days ?? 1} days`;
    return "Selected days";
}

function AddHabitScreen({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
    const [name, setName] = useState("");
    const [schedule, setSchedule] = useState<ScheduleChoice>("daily");
    const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
    const [intervalDays, setIntervalDays] = useState("2");
    const [startDate, setStartDate] = useState(() => isoDate(new Date()));
    const [endDate, setEndDate] = useState("");
    const [colour, setColour] = useState(habitPalette[0]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleDay = (day: number) => {
        setSelectedDays((current) => current.includes(day)
            ? current.filter((item) => item !== day)
            : [...current, day].sort((a, b) => a - b));
    };

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!name.trim() || saving) return;
        if (schedule === "selected" && selectedDays.length === 0) {
            setError("Choose at least one day.");
            return;
        }
        setSaving(true);
        setError(null);
        const scheduleType = schedule === "selected" ? "weekly_days" : schedule === "weekends" ? "weekly_days" : schedule;
        const scheduleConfig = schedule === "selected"
            ? { days: selectedDays }
            : schedule === "weekends"
                ? { days: [5, 6] }
                : schedule === "interval"
                    ? { interval_days: Math.max(1, Number(intervalDays) || 1) }
                    : {};
        try {
            await apiFetch("/habits", {
                method: "POST",
                body: JSON.stringify({
                    name: name.trim(),
                    colour,
                    schedule_type: scheduleType,
                    schedule_config: scheduleConfig,
                    start_date: startDate || null,
                    end_date: endDate || null,
                }),
            });
            await onCreated();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to create habit");
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="min-h-screen bg-background px-4 pb-36 pt-5 text-foreground sm:px-6">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
                <header className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Habits</p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight">New habit</h1>
                    </div>
                    <Button aria-label="Close" title="Close" variant="ghost" size="icon-sm" onClick={onClose}>
                        <X />
                    </Button>
                </header>

                <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border border-border/70 bg-card/45 p-4 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="habit-name" className="text-sm font-medium">What habit are you building?</label>
                        <Input id="habit-name" autoFocus placeholder="Go to the gym" value={name} onChange={(event) => setName(event.target.value)} />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="habit-schedule" className="text-sm font-medium">When does it happen?</label>
                        <select id="habit-schedule" value={schedule} onChange={(event) => setSchedule(event.target.value as ScheduleChoice)} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                            <option value="daily">Every day</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekends">Weekends</option>
                            <option value="selected">Selected days</option>
                            <option value="interval">Every N days</option>
                        </select>
                    </div>

                    {schedule === "selected" && (
                        <fieldset className="flex flex-col gap-2">
                            <legend className="text-sm font-medium">Days of the week</legend>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {weekdayOptions.map(([day, label]) => (
                                    <label key={day} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm has-[:checked]:border-emerald-400/70 has-[:checked]:bg-emerald-400/10">
                                        <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} className="accent-emerald-400" />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}

                    {schedule === "interval" && (
                        <div className="flex flex-col gap-2">
                            <label htmlFor="habit-interval" className="text-sm font-medium">Repeat every</label>
                            <div className="flex items-center gap-2">
                                <Input id="habit-interval" type="number" min="1" max="365" value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} className="max-w-28" />
                                <span className="text-sm text-muted-foreground">days</span>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="habit-start" className="text-sm font-medium">Start date <span className="text-muted-foreground">(optional)</span></label>
                            <DatePicker placeholder="Choose a start date" value={startDate} onChange={(value) => setStartDate(value ?? "")} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="habit-end" className="text-sm font-medium">End date <span className="text-muted-foreground">(optional)</span></label>
                            <DatePicker placeholder="Choose an end date" value={endDate} onChange={(value) => setEndDate(value ?? "")} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <label htmlFor="habit-colour" className="text-sm font-medium">Colour</label>
                        <input id="habit-colour" type="color" value={colour} onChange={(event) => setColour(event.target.value)} className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1" />
                    </div>

                    {error && <p className="text-sm text-rose-300">{error}</p>}
                    <Button type="submit" disabled={!name.trim() || saving} className="w-full">
                        <Plus /> {saving ? "Creating..." : "Create habit"}
                    </Button>
                </form>
            </div>
        </main>
    );
}

function EditHabitDialog({ habit, onSaved, onDeleted }: { habit: Habit; onSaved: () => Promise<void>; onDeleted: () => Promise<void> }) {
    const [name, setName] = useState(habit.name);
    const [colour, setColour] = useState(habitColour(habit));
    const initialSchedule: ScheduleChoice = habit.schedule_type === "weekly_days"
        ? (JSON.stringify(habit.schedule_config.days) === JSON.stringify([5, 6]) ? "weekends" : "selected")
        : habit.schedule_type;
    const [schedule, setSchedule] = useState<ScheduleChoice>(initialSchedule);
    const [selectedDays, setSelectedDays] = useState<number[]>(habit.schedule_config.days ?? [0, 1, 2, 3, 4]);
    const [intervalDays, setIntervalDays] = useState(String(habit.schedule_config.interval_days ?? 2));
    const [startDate, setStartDate] = useState(habit.start_date ?? "");
    const [endDate, setEndDate] = useState(habit.end_date ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleDay = (day: number) => {
        setSelectedDays((current) => current.includes(day)
            ? current.filter((item) => item !== day)
            : [...current, day].sort((a, b) => a - b));
    };

    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!name.trim() || saving) return;
        if (schedule === "selected" && selectedDays.length === 0) {
            setError("Choose at least one day.");
            return;
        }
        setSaving(true);
        setError(null);
        const scheduleType = schedule === "selected" || schedule === "weekends" ? "weekly_days" : schedule;
        const scheduleConfig = schedule === "selected" ? { days: selectedDays }
            : schedule === "weekends" ? { days: [5, 6] }
                : schedule === "interval" ? { interval_days: Math.max(1, Number(intervalDays) || 1) } : {};
        try {
            await apiFetch(`/habits/${habit.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name: name.trim(), colour, schedule_type: scheduleType, schedule_config: scheduleConfig, start_date: startDate || null, end_date: endDate || null }),
            });
            await onSaved();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to update habit");
        } finally {
            setSaving(false);
        }
    }

    async function remove() {
        if (saving) return;
        setSaving(true);
        try {
            await apiFetch(`/habits/${habit.id}`, { method: "DELETE" });
            await onDeleted();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to delete habit");
            setSaving(false);
        }
    }

    return (
        <form onSubmit={save} className="flex flex-col gap-4">
            <DialogHeader><DialogTitle>Edit {habit.name}</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-2"><label htmlFor={`edit-habit-name-${habit.id}`} className="text-sm font-medium">Habit name</label><Input id={`edit-habit-name-${habit.id}`} value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="flex flex-col gap-2"><label htmlFor={`edit-habit-schedule-${habit.id}`} className="text-sm font-medium">Schedule</label><select id={`edit-habit-schedule-${habit.id}`} value={schedule} onChange={(event) => setSchedule(event.target.value as ScheduleChoice)} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm">
                <option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="selected">Selected days</option><option value="interval">Every N days</option>
            </select></div>
            {schedule === "selected" && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{weekdayOptions.map(([day, label]) => <label key={day} className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-2 text-xs"><input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} className="accent-emerald-400" />{label}</label>)}</div>}
            {schedule === "interval" && <div className="flex flex-col gap-2"><label htmlFor={`edit-habit-interval-${habit.id}`} className="text-sm font-medium">Repeat every</label><div className="flex items-center gap-2"><Input id={`edit-habit-interval-${habit.id}`} type="number" min="1" max="365" value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} /><span className="text-sm text-muted-foreground">days</span></div></div>}
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2"><label className="text-sm font-medium">Start date</label><DatePicker placeholder="Choose a start date" value={startDate} onChange={(value) => setStartDate(value ?? "")} /></div>
                <div className="flex min-w-0 flex-col gap-2"><label className="text-sm font-medium">End date</label><DatePicker placeholder="Choose an end date" value={endDate} onChange={(value) => setEndDate(value ?? "")} /></div>
            </div>
            <div className="flex items-center justify-between"><span className="text-sm font-medium">Colour</span><input type="color" value={colour} onChange={(event) => setColour(event.target.value)} className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent p-1" /></div>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex justify-between gap-2"><Button type="button" variant="destructive" onClick={() => void remove()}><Trash2 /> Delete</Button><Button type="submit" disabled={!name.trim() || saving}><Edit3 /> {saving ? "Saving..." : "Save changes"}</Button></div>
        </form>
    );
}

function HabitCard({ summary, onToggle, onRefresh }: { summary: HabitSummary; onToggle: () => void; onRefresh: () => Promise<void> }) {
    const [editOpen, setEditOpen] = useState(false);
    const completed = summary.status === "completed";
    const canToggle = ["due", "missed", "completed"].includes(summary.status);
    const colour = habitColour(summary.habit);
    return (
        <div className={cn("group relative flex items-center gap-3 overflow-hidden rounded-lg border p-2 transition hover:brightness-105", completed && "opacity-75")} style={{ backgroundColor: `${colour}1A`, borderColor: `${colour}66` }}>
            <Button aria-label={`${completed ? "Undo" : "Complete"} ${summary.habit.name}`} title={`${completed ? "Undo" : "Complete"} ${summary.habit.name}`} variant="ghost" size="icon" disabled={!canToggle} onClick={onToggle} className="h-9 w-9 shrink-0 rounded-full">
                {completed ? <CircleCheck className="size-5" style={{ color: colour }} /> : <CircleDashed className="size-5" style={{ color: colour }} />}
            </Button>
            <div className="min-w-0 flex-1">
                <p className={cn("truncate font-semibold", completed && "text-muted-foreground line-through")}>{summary.habit.name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"><span>{statusLabels[summary.status]}</span><span>{scheduleLabel(summary.habit)}</span></div>
            </div>
            {summary.current_streak > 0 && <span className="flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ color: colour }} title="Current streak"><Flame className="size-4" />{summary.current_streak}</span>}
            <div className="ml-1 h-7 w-px bg-border/70" aria-hidden="true" />
            <Button aria-label={`Edit ${summary.habit.name}`} title={`Edit ${summary.habit.name}`} variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)} className="opacity-60 hover:opacity-100"><Edit3 /></Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent><EditHabitDialog habit={summary.habit} onSaved={async () => { setEditOpen(false); await onRefresh(); }} onDeleted={async () => { setEditOpen(false); await onRefresh(); }} /></DialogContent>
            </Dialog>
        </div>
    );
}

export default function HabitsPage() {
    const [month, setMonth] = useState(() => startOfMonth(new Date()));
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [overview, setOverview] = useState<HabitsOverview | null>(null);
    const [dayHabits, setDayHabits] = useState<HabitSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addingHabit, setAddingHabit] = useState(false);

    const progressByDate = useMemo(
        () => new Map((overview?.progress ?? []).map((item) => [item.date, item])),
        [overview],
    );
    const days = useMemo(() => monthDays(month), [month]);

    async function loadMonth(value: Date) {
        const start = isoDate(startOfMonth(value));
        const end = isoDate(endOfMonth(value));
        const data = await apiFetch<HabitsOverview>(`/habits/overview?start_date=${start}&end_date=${end}`);
        setOverview(data);
    }

    async function loadDay(value: Date) {
        const data = await apiFetch<HabitSummary[]>(`/habits/day?date=${isoDate(value)}`);
        setDayHabits(data);
    }

    async function refresh(value = selectedDate) {
        try {
            setError(null);
            setLoading(true);
            await Promise.all([loadMonth(month), loadDay(value)]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load habits");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreated() {
        setAddingHabit(false);
        await refresh();
    }

    useEffect(() => {
        void refresh();
    }, [month, selectedDate]);

    const moveMonth = (amount: number) => {
        const next = startOfMonth(addMonths(month, amount));
        setMonth(next);
        setSelectedDate(next);
    };

    const moveDay = (amount: number) => {
        const next = addDays(selectedDate, amount);
        setSelectedDate(next);
        if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
            setMonth(startOfMonth(next));
        }
    };

    const selectDay = (value: Date) => {
        setSelectedDate(value);
        if (value.getMonth() !== month.getMonth() || value.getFullYear() !== month.getFullYear()) {
            setMonth(startOfMonth(value));
        }
    };

    async function toggleHabit(summary: HabitSummary) {
        const date = isoDate(selectedDate);
        try {
            if (summary.status === "completed") {
                await apiFetch(`/habits/${summary.habit.id}/complete/${date}`, { method: "DELETE" });
            } else {
                await apiFetch(`/habits/${summary.habit.id}/complete`, {
                    method: "POST",
                    body: JSON.stringify({ occurrence_date: date, source: "ui" }),
                });
            }
            await refresh();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to update habit");
        }
    }

    const selectedLabel = format(selectedDate, "EEEE, d MMMM");
    const completed = dayHabits.filter((item) => item.status === "completed").length;
    const actionable = dayHabits.filter((item) => ["due", "missed", "completed"].includes(item.status)).length;

    if (addingHabit) {
        return <AddHabitScreen onClose={() => setAddingHabit(false)} onCreated={handleCreated} />;
    }

    return (
        <main className="min-h-screen bg-background px-4 pb-36 pt-5 text-foreground sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                <header className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight">Habits</h1>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => setAddingHabit(true)}>
                            <Plus /> New habit
                        </Button>
                        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card/50 p-1">
                            <Button aria-label="Previous month" title="Previous month" variant="ghost" size="icon-sm" onClick={() => moveMonth(-1)}>
                                <ChevronLeft />
                            </Button>
                            <Button aria-label="Next month" title="Next month" variant="ghost" size="icon-sm" onClick={() => moveMonth(1)}>
                                <ChevronRight />
                            </Button>
                        </div>
                    </div>
                </header>

                {error && <p className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

                <section className="rounded-xl border border-border/70 bg-card/45 p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">{format(month, "MMMM yyyy")}</h2>
                            <p className="text-xs text-muted-foreground">
                                {overview ? `${overview.completion_percentage.toFixed(0)}% of scheduled habits completed` : "Loading progress"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>Less</span>
                            <span className="h-3 w-3 rounded-sm bg-muted/40" />
                            <span className="h-3 w-3 rounded-sm bg-emerald-700/65" />
                            <span className="h-3 w-3 rounded-sm bg-emerald-400" />
                            <span>More</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground sm:gap-2">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
                        {days.map((value, index) => {
                            if (!value) return <span key={`empty-${index}`} className="aspect-square" />;
                            const iso = isoDate(value);
                            const progress = progressByDate.get(iso);
                            const selected = isSameDay(value, selectedDate);
                            return (
                                <button
                                    key={iso}
                                    type="button"
                                    aria-label={`${format(value, "EEEE, d MMMM")}${progress ? `, ${progress.completed} of ${progress.due} complete` : ""}`}
                                    onClick={() => selectDay(value)}
                                    className={cn(
                                        "group relative flex aspect-square min-h-8 items-center justify-center rounded-sm border border-transparent text-xs text-foreground transition hover:border-emerald-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
                                        progress ? intensity(progress, isFuture(value)) : "bg-muted/20",
                                        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                                        isToday(value) && "font-bold",
                                        isFuture(value) && "opacity-75",
                                    )}
                                >
                                    {value.getDate()}
                                    <span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow group-hover:block">
                                        {progress ? `${progress.completed}/${progress.due} complete` : "No scheduled habits"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">{selectedLabel}</h2>
                            <p className="text-sm text-muted-foreground">
                                {actionable ? `${completed} of ${actionable} completed` : "No habits scheduled"}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button aria-label="Previous day" title="Previous day" variant="ghost" size="icon-sm" onClick={() => moveDay(-1)}>
                                <ChevronLeft />
                            </Button>
                            {!isToday(selectedDate) && (
                                <Button variant="outline" size="sm" onClick={() => selectDay(new Date())}>
                                    <RotateCcw /> Today
                                </Button>
                            )}
                            <Button aria-label="Next day" title="Next day" variant="ghost" size="icon-sm" onClick={() => moveDay(1)}>
                                <ChevronRight />
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="rounded-xl border border-border/70 p-8 text-center text-sm text-muted-foreground">Loading day...</div>
                    ) : dayHabits.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                            Nothing scheduled for this day.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {dayHabits.map((summary) => <HabitCard key={summary.habit.id} summary={summary} onToggle={() => void toggleHabit(summary)} onRefresh={refresh} />)}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

export function HabitsHero() {
    const { navigate } = useNavigation();
    const state = useHabitsDashboardState();
    const remaining = state?.due_today ?? 0;
    const completed = state?.completed_today ?? 0;
    const missed = state?.missed_today ?? 0;
    const total = remaining + completed;
    const openHabits = state?.today?.filter((item) => item.status === "due").slice(0, 3) ?? [];
    const topStreak = state?.current_streaks?.[0];
    return <WidgetContainer onClick={() => navigate("habits")} className="cursor-pointer">
        <div className="flex h-full flex-col gap-3 overflow-hidden">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Today</p><p className="mt-1 text-2xl font-bold">{remaining ? `${remaining} left` : "All done"}</p></div><CircleCheck className="size-7" style={{ color: remaining ? "#fbbf24" : "#34d399" }} /></div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">{openHabits.length ? openHabits.map((item) => <div key={item.habit.id} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ backgroundColor: `${habitColour(item.habit)}1A` }}><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: habitColour(item.habit) }} /><span className="truncate text-sm font-medium">{item.habit.name}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">Open</span></div>) : <p className="py-2 text-sm text-muted-foreground">No habits left today.</p>}</div>
            <div><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>{completed} completed</span><span>{total ? Math.round(completed / total * 100) : 100}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${total ? completed / total * 100 : 100}%` }} /></div><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="text-rose-300">{missed} missed</span><span className="truncate text-amber-300">{topStreak ? `${topStreak.name} · ${topStreak.current_streak}d streak` : "No active streaks"}</span></div></div>
        </div>
    </WidgetContainer>;
}

export function HabitsSmall() {
    const { navigate } = useNavigation();
    const state = useHabitsDashboardState();
    const openHabits = state?.today?.filter((item) => item.status === "due").slice(0, 2) ?? [];
    const topStreak = state?.current_streaks?.[0];
    return <WidgetContainer onClick={() => navigate("habits")} className="cursor-pointer"><div className="flex h-full min-h-0 flex-col justify-center gap-2"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Today</p><span className="text-xs font-bold text-amber-300">{state?.due_today ?? 0} left</span></div><div className="min-h-0 overflow-hidden">{openHabits.length ? openHabits.map((item) => <div key={item.habit.id} className="flex items-center gap-2 truncate py-0.5 text-xs"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: habitColour(item.habit) }} /><span className="truncate text-muted-foreground">{item.habit.name}</span></div>) : <p className="text-xs text-emerald-300">Nothing left today</p>}</div><div className="flex items-center gap-1 border-t border-border/70 pt-2 text-xs text-amber-300"><Flame className="size-3.5" /><span className="truncate">{topStreak ? `${topStreak.name} · ${topStreak.current_streak}d` : "No active streak"}</span></div></div></WidgetContainer>;
}

export function HabitsLong() {
    const { navigate } = useNavigation();
    const state = useHabitsDashboardState();
    const habits = state?.today?.filter((item) => item.status !== "rest").slice(0, 5) ?? [];
    const remaining = state?.due_today ?? 0;
    const topStreak = state?.current_streaks?.[0];
    return <WidgetContainer onClick={() => navigate("habits")} className="cursor-pointer"><div className="flex h-full min-w-0 items-center gap-3 overflow-hidden"><div className="flex shrink-0 items-center gap-2 border-r border-border/70 pr-3"><span className="text-xs font-semibold">Today</span><span className="text-xs font-bold text-amber-300">{remaining} left</span></div><div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">{habits.length ? habits.map((item) => <div key={item.habit.id} className="flex min-w-0 flex-1 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: habitColour(item.habit) }} /><span className="truncate text-xs">{item.habit.name}</span><span className={cn("shrink-0 text-[10px]", item.status === "completed" ? "text-emerald-300" : item.status === "missed" ? "text-rose-300" : "text-muted-foreground")}>{item.status === "completed" ? "Done" : item.status === "missed" ? "Missed" : "Open"}</span></div>) : <span className="text-xs text-muted-foreground">Nothing scheduled today</span>}</div><div className="flex shrink-0 items-center gap-1 border-l border-border/70 pl-3 text-xs text-amber-300"><Flame className="size-3.5" /><span>{topStreak ? `${topStreak.current_streak}d` : "0d"}</span></div></div></WidgetContainer>;
}

interface HabitsDashboardState {
    due_today: number;
    completed_today: number;
    missed_today: number;
    active_habits: number;
    current_streaks: { habit_id: number; name: string; current_streak: number }[];
    today: HabitSummary[];
}

function useHabitsDashboardState() {
    const [state, setState] = useState<HabitsDashboardState | null>(null);
    useEffect(() => { apiFetch<HabitsDashboardState>("/habits/state").then(setState).catch(() => setState(null)); }, []);
    useWebSocketEvent<HabitsDashboardState>("habits.state_updated", setState);
    return state;
}
