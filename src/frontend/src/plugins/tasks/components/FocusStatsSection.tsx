import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Flame, RefreshCw, Timer, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useFocusStats } from "../useTasks";

function formatDuration(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function shortDate(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

function focusBarColour(seconds: number, maxSeconds: number): string {
    if (seconds <= 0) return "#475569";

    const ratio = seconds / Math.max(maxSeconds, 1);
    if (ratio >= 0.75) return "#f97316";
    if (ratio >= 0.5) return "#f59e0b";
    if (ratio >= 0.25) return "#22c55e";
    return "#38bdf8";
}

export default function FocusStatsSection() {
    const { stats, days, setDays, loading, refetch } = useFocusStats(7);

    useEffect(() => {
        const interval = window.setInterval(refetch, 30_000);
        return () => window.clearInterval(interval);
    }, [refetch]);

    const maxDailySeconds = Math.max(1, ...((stats?.daily ?? []).map((day) => day.seconds)));
    const chartData = (stats?.daily ?? []).map((day) => ({
        ...day,
        label: shortDate(day.date),
        hours: Number((day.seconds / 3600).toFixed(2)),
        fill: focusBarColour(day.seconds, maxDailySeconds),
    }));

    const maxLabelSeconds = Math.max(1, ...((stats?.labels ?? []).map((label) => label.seconds)));

    return (
        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Focus insights</p>
                    <h2 className="mt-1 text-xl font-bold">Focus time</h2>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                    {[7, 14, 30].map((range) => (
                        <button
                            key={range}
                            type="button"
                            onClick={() => setDays(range)}
                            className={`h-8 rounded-md px-2.5 text-xs font-semibold transition-colors ${days === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            {range}d
                        </button>
                    ))}
                    <button type="button" onClick={refetch} aria-label="Refresh focus stats" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:text-foreground">
                        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-primary/8 p-3">
                    <Timer className="size-4 text-primary" />
                    <p className="mt-2 text-lg font-bold">{formatDuration(stats?.total_seconds ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">In selected period</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <p className="mt-2 text-lg font-bold">{stats?.focus_days ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Focus days</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                    <Flame className="size-4 text-orange-400" />
                    <p className="mt-2 text-lg font-bold">{stats?.current_streak ?? 0} days</p>
                    <p className="text-xs text-muted-foreground">Current streak</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                    <Trophy className="size-4 text-amber-400" />
                    <p className="mt-2 text-lg font-bold">{formatDuration(stats?.average_session_seconds ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">Average session</p>
                </div>
            </div>

            <div className="mt-5">
                <div className="mb-2 flex items-end justify-between">
                    <p className="text-sm font-semibold">Daily focus</p>
                    <p className="text-xs text-muted-foreground">This week: {formatDuration(stats?.this_week_seconds ?? 0)}</p>
                </div>
                <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 4, right: 0, left: -26, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}h`} />
                            <Tooltip
                                cursor={{ fill: "hsl(var(--muted)/0.35)" }}
                                formatter={(value) => [formatDuration(Number(value) * 3600), "Focused"]}
                                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--popover-foreground))" }}
                            />
                            <Bar dataKey="hours" radius={[5, 5, 0, 0]} minPointSize={3}>
                                {chartData.map((day) => (
                                    <Cell key={day.date} fill={day.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                    <p className="mb-3 text-sm font-semibold">By label</p>
                    {stats?.labels.length ? (
                        <div className="space-y-3">
                            {stats.labels.slice(0, 6).map((label) => (
                                <div key={label.id}>
                                    <div className="mb-1 flex justify-between gap-3 text-xs">
                                        <span className="truncate font-medium">{label.name}</span>
                                        <span className="shrink-0 text-muted-foreground">{formatDuration(label.seconds)} · {label.sessions} sessions</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full" style={{ width: `${Math.max(4, (label.seconds / maxLabelSeconds) * 100)}%`, backgroundColor: label.colour || "hsl(var(--primary))" }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-xs text-muted-foreground">No labelled focus sessions yet.</p>}
                </div>
                <div>
                    <p className="mb-3 text-sm font-semibold">Top tasks</p>
                    {stats?.tasks.length ? (
                        <div className="space-y-2">
                            {stats.tasks.slice(0, 5).map((task, index) => (
                                <div key={task.task_id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                                    <p className="min-w-0 flex-1 truncate text-sm">{task.title}</p>
                                    <p className="shrink-0 text-xs font-semibold text-muted-foreground">{formatDuration(task.seconds)}</p>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-xs text-muted-foreground">No completed focus sessions yet.</p>}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{stats?.session_count ?? 0} recorded sessions</span>
                <span>{stats?.longest_streak ?? 0}-day longest streak</span>
                {stats?.best_day && <span>Best day: {formatDuration(stats.best_day_seconds)}</span>}
            </div>
        </section>
    );
}
