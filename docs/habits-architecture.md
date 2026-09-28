# Habits Plugin Architecture

## Summary

The habits plugin helps the user build and review recurring healthy habits. It owns
habit definitions, recurring schedules, daily occurrences, completion history, and
streak calculations. The frontend presents a GitHub-style contribution tracker with
a health-oriented palette, plus a practical daily check-in view.

The first version should optimize for low-friction daily use:

- One completion per scheduled day per habit.
- Friendly schedule presets, including weekdays such as Monday-Friday.
- Planned rest days are not missed days and do not break streaks.
- Past dates can be completed or corrected at any time.
- Due and missed habits remain visible so the user can act on them.
- Paused habits retain history and appear visually muted.
- Completed or ended habits retain history but leave the active view.
- The overview heatmap is normalized by the percentage of due habits completed.
- Each habit also has its own history and heatmap.

The design should leave room for future quotas, multiple occurrences per day, and
advanced cron expressions without making those requirements part of v1.

## Product Model

A habit is a recurring intention, not a task with one deadline. A habit has a name,
a schedule, an active lifecycle, and a history of expected occurrences. An occurrence
is the result of evaluating one habit against one calendar date.

### Habit lifecycle

- `active`: included in schedules, dashboard checks, and the active habits page.
- `paused`: excluded from due and missed calculations; retained in history and shown
  in a muted or grayed-out state.
- `completed`: no longer included in the active view or future schedules; all history
  remains available for review.
- `archived`: optional future state for hiding a habit without describing it as a
  completed goal.

An optional start date and end date bound when a habit can produce occurrences. An
end date naturally moves the habit out of the active view after its final date.

### Schedule presets

The UI should use friendly presets first:

- Every day
- Weekdays
- Weekends
- Selected days of the week
- Every N days, if the implementation can support it without ambiguity

The internal representation should be schedule data rather than display text. A
future advanced editor may expose cron syntax, but v1 should not require users to
write cron expressions. The example `go gym Mon-Fri` should create an active habit
scheduled on Monday through Friday.

### Occurrence states

For an active habit and a date inside its date range, the scheduler derives one of:

- `not_due`: the schedule does not include this date.
- `upcoming`: the date is scheduled but has not arrived.
- `due`: the scheduled date is today and is not completed.
- `completed`: the user completed the habit on that date.
- `missed`: the scheduled date is in the past and was not completed.
- `rest`: the date is intentionally outside the schedule; it is neutral, not missed.

The system may materialize occurrences when queried or when a completion is recorded.
It should not create rows for every possible future date unless that is needed for a
query or reminder.

## Streak Rules

Streaks are based on scheduled occurrences, not raw calendar days.

For an active habit, a successful streak is the number of consecutive scheduled
occurrences completed, walking backward from the latest relevant date. Unscheduled
days, planned rest days, paused periods, and dates before the start date are neutral.
A missed scheduled occurrence breaks the streak. A future occurrence does not count
as a miss or as a success.

The controller should provide at least:

- current streak
- best streak
- completed occurrence count
- due occurrence count
- completion percentage over a selected date range
- next due date

The overall dashboard heatmap should calculate each date as:

`completed active occurrences / due active occurrences`

Dates with no due habits are neutral and should not be rendered as failures. The
frontend can map the percentage to contribution-style intensity levels. Per-habit
heatmaps use the selected habit's completion state directly.

## Recommended Shape

```text
Schedule definitions + lifecycle
              |
              v
Habits controller -----------------> Habits page and dashboard widget
  occurrences + completions            overview heatmap
  streak calculations                   daily check-in
              ^                         per-habit history
              |
      scheduler/date boundary
              |
        event bus + WebSocket
              |
       command bar and reminders
```

The backend remains the source of truth. The frontend should receive state through
normal plugin endpoints and WebSocket events rather than calculating streaks or
schedule rules itself.

## Backend Ownership

The habits plugin should follow the existing plugin contract:

- `plugin.py`: constructs the controller, router, and command handler.
- `controller/`: owns schedule evaluation, occurrence state, streak queries, and
  persistence.
- `routes.py`: exposes stable read and write endpoints for the frontend.
- `schemas.py`: defines API and command payloads.
- `command.py`: defines typed intents for natural-language habit operations.
- `state.py`: contains the dashboard summary and today's active check-ins if the
  plugin needs a persisted state slice.

Date and recurrence decisions belong in the backend. Natural-language commands may
pass phrases such as `tomorrow` or `next Monday` to the existing date parser, but the
LLM must not perform calendar arithmetic.

## Database Model

The exact migration mechanism should follow the existing SQLite manager. Suggested
tables:

### `habits`

- `id`
- `name`
- `description` (optional)
- `colour` (optional display color)
- `icon` (optional icon identifier)
- `schedule_type` (for example `daily`, `weekdays`, `weekly_days`, `interval`)
- `schedule_config` (JSON configuration for the selected schedule)
- `start_date` (optional ISO date)
- `end_date` (optional ISO date)
- `status` (`active`, `paused`, `completed`, `archived`)
- `created_at`
- `updated_at`
- `paused_at` (optional)
- `completed_at` (optional)

### `habit_completions`

- `id`
- `habit_id`
- `occurrence_date` (ISO date)
- `completed_at`
- `source` (`ui`, `command`, `api`)
- `note` (optional future field)

Add a uniqueness constraint on `(habit_id, occurrence_date)` for v1. Completion is
an idempotent upsert: checking a habit twice should not create duplicate history.
Deleting or undoing a completion removes or marks that single date incomplete while
leaving the habit definition intact.

A separate materialized `habit_occurrences` table is optional. Start with derived
occurrences unless query performance or reminder scheduling demonstrates a need for
materialization.

## API

Suggested endpoints:

- `GET /habits`: active habits and their current summary.
- `GET /habits/today`: active habits due today, including completed, due, and missed
  presentation data.
- `GET /habits/overview?start_date=&end_date=`: normalized daily heatmap values and
  aggregate summary.
- `GET /habits/{habit_id}`: one habit, schedule, streaks, and history.
- `GET /habits/{habit_id}/history?start_date=&end_date=`: per-habit heatmap data.
- `POST /habits`: create a habit from a friendly schedule preset.
- `PATCH /habits/{habit_id}`: edit name, schedule, color, date bounds, or status.
- `POST /habits/{habit_id}/complete`: complete the occurrence for a supplied date,
  defaulting to today.
- `DELETE /habits/{habit_id}/complete/{date}`: undo a completion for one date.
- `POST /habits/{habit_id}/pause` and `POST /habits/{habit_id}/resume`.
- `POST /habits/{habit_id}/complete-goal`: mark a habit finished while preserving it
  in history.

All date inputs should be normalized to ISO dates by the backend. Completion endpoints
must allow arbitrary past dates, subject to validation that the date is within the
habit's configured bounds when those bounds exist.

## Events and State

Publish a `habits.state_updated` event after any change that can affect today's
check-ins, history, streaks, or dashboard values:

- habit created, edited, paused, resumed, completed, or archived
- occurrence completed or undone
- a date boundary changes what is due or missed

The event payload should identify the affected habit and the state version or update
time. Clients can then refresh the relevant endpoint. Avoid sending the full history
in every event.

Suggested dashboard state:

- active habit count
- habits due today
- completed today count
- missed count for the visible range
- overall current completion percentage
- top current streaks
- today's check-in list

In-app reminders can initially be derived from `habits.today` and dashboard state.
A later scheduler integration can emit reminder events at habit-specific times if
reminder times become a product requirement.

## Commands

The command bar should support these initial intents:

- `show_habits`: open the habits page.
- `create_habit`: examples include `add gym on weekdays` and `meditate every day`.
- `complete_habit`: examples include `I went to the gym` and `mark meditation done`.
- `undo_habit`: examples include `I did not meditate yesterday`.
- `review_habits`: examples include `how are my habits doing?` and `show my streaks`.
- `manage_habit`: pause, resume, or complete a habit goal.

Commands should resolve a habit by name and ask for clarification when multiple active
habits match. Writes should use the existing confirmation flow where the command
router classifies them as writes. A command that records a past completion should
show the interpreted date before applying it when the date is ambiguous.

The intent slot models should keep schedule phrases verbatim until the backend
converts them into a preset and configuration. Examples should cover weekday ranges,
selected days, today, yesterday, and habit names that contain multiple words.

## Frontend Experience

### Dashboard widget

The widget should be a quick daily check-in surface, not a full analytics page. It
should show:

- today's due habits with clear completed, due, and missed states
- one-tap completion and undo
- a compact current-streak summary
- a link or command to open the full habits page

Paused and completed habits should not crowd the daily active list.

### Habits page

The page should include:

- an overview contribution grid for the selected date range
- a legend based on completion percentage
- current and best streak summary values
- a daily list of due, completed, and missed habits
- filters or tabs for active, paused, and completed history
- a per-habit view with its own contribution grid
- create, edit, pause, resume, and finish actions

The visual language should keep the GitHub-style grid and compact information density,
while using a custom health-oriented palette and each habit's optional color. Do not
make the frontend responsible for deciding whether a date was due or missed.

### Command result renderers

Habit command results should have dedicated renderers for at least:

- created habit with schedule summary
- today's check-in result
- streak/progress review
- completed or undone historical occurrence

These should reuse existing command result and confirmation components where possible.

## Delivery Order

1. Add schemas and SQLite tables for habits and completions.
2. Implement schedule presets and deterministic occurrence evaluation.
3. Implement completion, undo, lifecycle transitions, and streak queries.
4. Add routes and `habits.state_updated` events.
5. Add typed command intents and natural-language examples.
6. Add the frontend manifest, page, dashboard widget, and command renderers.
7. Add focused backend tests for weekday schedules, planned rest days, missed days,
   backfilled completions, pause/resume behavior, end dates, and streak boundaries.
8. Add frontend tests or a browser check for heatmap rendering and daily check-ins.

## Deliberate Non-Goals for v1

- No multiple completions per day.
- No quota or quantity tracking.
- No notes or mood tracking.
- No system notifications.
- No raw cron editor.
- No automatic health-device integration.
- No streak protection or forgiveness days unless added as an explicit product rule.

These can be introduced later without changing the core distinction between a habit,
a scheduled occurrence, and a completion record.
