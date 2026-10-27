# Calendar Plugin Plan

## Goal

Add a first-class Calendar plugin to Toto that synchronizes calendar events with
Google Calendar while keeping a local copy for fast display, offline reads, and
Toto commands. The plugin is for time-based events and appointments, not tasks;
the existing Tasks plugin remains the source of truth for to-do items.

The intended experience is a Toto calendar, backed by Google Calendar sync, rather
than an embedded Google Calendar viewer. Toto should be able to display events,
create and edit events, and keep both sides synchronized according to the final
conflict policy.

## Design Principles

- Keep Google Calendar as an external synchronized calendar service, not the UI.
- Keep a normalized local event cache in calendar-owned SQLite tables.
- Preserve Google event IDs, calendar IDs, sync tokens, etags, and timestamps so
  synchronization is incremental and restart-safe.
- Keep tasks and calendar events as separate domain objects. A task may optionally
  be promoted to an event later, but it should not silently become an event.
- Use explicit write confirmation for command-bar actions that create, modify, or
  delete events, matching Toto's existing command architecture.
- Convert natural-language dates and times deterministically in the backend;
  never rely on the LLM for calendar arithmetic or timezone conversion.
- Emit one calendar state/update event after local data changes so the frontend
  can update without a page refresh.

## Proposed MVP Scope

### Included

- Connect exactly one Google account through OAuth 2.0.
- Synchronize all calendars available to that account. Calendar selection is a
  view-level filter only; hiding a calendar must not stop it syncing locally.
- Choose a default destination calendar for newly created Toto events, while
  allowing the user to select another calendar when needed.
- Initial full sync followed by incremental Google sync using `nextSyncToken`.
- A restart-safe periodic sync every few minutes, with a manual sync action and
  an immediate sync after Toto creates, edits, or deletes an event.
- Local display of timed events and all-day events.
- Day and week views, with a compact upcoming-events widget.
- Event details: title, description, location, start/end, all-day status, source
  calendar, attendees, meeting link, recurrence summary, and sync status.
- Create, edit, and delete events from Toto, subject to confirmation.
- Read and write command intents for common calendar operations.
- Basic handling for recurring events using Google Calendar's expanded event feed
  or a deliberate local representation of instances.
- Clear authentication, sync, and error states in the UI.

### Explicitly deferred unless requested

- Complex attendee management and invitation workflows.
- Sending custom email notifications.
- Availability search across multiple people.
- Full recurrence-rule editing in the UI.
- Importing tasks into Google Calendar automatically.
- Two-way sync with providers other than Google Calendar.
- Push notifications for event reminders.

## Architecture

### Backend plugin structure

Follow the existing plugin layout:

```text
src/backend/app/plugins/calendar/
  plugin.py
  command.py
  routes.py
  schemas.py
  google_client.py
  sync.py
  controller/
    controller.py
```

Responsibilities:

- `google_client.py`: OAuth URL/token exchange, authenticated Google API calls,
  pagination, retries, rate-limit handling, and Google error translation.
- `sync.py`: initial sync, incremental sync, tombstones, sync-token invalidation,
  recurrence handling, and conflict detection.
- `controller.py`: local event queries, mutation orchestration, state building,
  and event-bus publication.
- `routes.py`: OAuth callback/status/disconnect, sync controls, event queries,
  and mutation endpoints that are not command-bar actions.
- `command.py`: `IntentSpec` definitions and handlers for natural-language use.
- `schemas.py`: Pydantic request/response and normalized event models.
- `plugin.py`: lifecycle setup, state loading, and WebSocket event registration.

### Google integration

Use the Google Calendar REST API with an async HTTP client already present in the
project, or add Google's official packages only if they materially simplify OAuth
or credential handling. The implementation must not put client secrets or access
tokens in the frontend or in SQLite plaintext.

OAuth should use a backend-owned flow:

1. User starts connection from the Calendar settings page.
2. Backend creates a state-protected Google authorization URL.
3. Google redirects to a backend callback.
4. Backend exchanges the code, encrypts or securely stores the refresh token, and
   redirects the frontend to a success/error route.
5. Backend fetches calendar metadata and lets the user choose sync calendars.

Required configuration should be documented in `.env`, including Google client
ID, client secret, redirect URI, token-encryption key, and sync interval.

### Local database tables

All tables use the existing `calendar_` prefix. Exact columns should be finalized
after the account and multi-calendar answers below.

`calendar_accounts`

- local account ID, provider, Google account identity, encrypted refresh token
- access-token expiry metadata, connection status, last error, created/updated

`calendar_sources`

- local account ID, Google calendar ID, summary, description, timezone, color
- selected-as-default flag, access role, updated timestamp

Calendar visibility is a presentation preference rather than a sync property.
It should be stored separately, either in a small `calendar_view_preferences`
table or in the frontend's persisted settings, so hidden calendars continue to
receive remote updates.

`calendar_events`

- local account/source IDs and Google event ID
- Google etag, iCalUID, status, title, description, location, meeting URL
- start/end values, all-day flag, timezone, recurrence metadata
- organizer and attendee summary, raw provider version if needed for diagnostics
- local created/updated timestamps and last-synced timestamp

`calendar_sync_state`

- account/source ID, sync token, last successful sync, sync status, error details
- initial-sync-complete flag and token-invalidated flag

`calendar_event_links` (only if task/event linking is approved)

- local task ID, local event ID, link type, and provider metadata

Use unique constraints on `(source_id, google_event_id)` and indexes covering
event time ranges, source IDs, and deleted/status records.

## Synchronization Behavior

### Initial sync

- Fetch selected calendar metadata.
- Fetch events for a bounded historical window and a configurable future window,
  while preserving all-day and timezone information.
- Store normalized events using upsert semantics.
- Save Google's `nextSyncToken` only after the complete page sequence succeeds.
- Publish one state update after the transaction completes.

### Incremental sync

- Request changes with the stored sync token.
- Upsert changed events and mark deleted Google events as deleted locally.
- Save the replacement token only after all pages succeed.
- If Google returns an invalid or expired sync token, clear it and perform a
  controlled full resync rather than silently losing changes.
- Make sync idempotent so retries cannot duplicate events.

### Local-to-Google writes

- Create/update/delete locally only as part of a mutation workflow that records
  the intended provider operation and its result, or perform the provider write
  first and then upsert the authoritative response.
- Always retain the Google event ID and etag returned by Google.
- On an etag conflict, do not overwrite silently. Return a conflict state and ask
  the user whether to reload the remote version or explicitly overwrite it with
  the Toto version. This is the chosen policy for the Toto-first workflow: Toto
  writes should reach Google immediately, but Google-side edits must not be lost.

### Sync scheduling

The current scheduler is useful for periodic work but is process-local. Calendar
sync must therefore remain safe across restarts: startup should inspect sync state,
run overdue syncs, and schedule the next run. Use a short configurable interval,
with a default of five minutes, plus manual sync and immediate post-write sync.
Google push channels can be added later if the deployment and renewal lifecycle
justify them.

## API Surface

Likely routes under `/calendar`:

- `GET /status`: connection, selected calendars, sync status, and last error.
- `GET /connect`: begin OAuth flow.
- `GET /oauth/callback`: complete OAuth flow.
- `POST /disconnect`: revoke/remove the local connection.
- `GET /sources`: list Google calendars and sync selections.
- `PUT /sources`: update the default destination calendar.
- `GET /view-preferences`: return calendar visibility preferences.
- `PUT /view-preferences`: update which calendars are visible in the current view.
- `POST /sync`: request an immediate sync.
- `GET /events`: query a local date/time range with filters.
- `POST /events`: create an event through the normal authenticated API.
- `PATCH /events/{id}`: update an event.
- `DELETE /events/{id}`: delete an event.

The frontend should read events from the local API, not directly from Google.
Mutations should return the normalized event and sync/provider status.

## Command Bar Intents

Start with narrowly defined intents so classifier examples remain reliable:

- `show_calendar` (nav)
- `events_on_date` (read)
- `events_in_date_range` (read)
- `next_event` (read)
- `search_events` (read)
- `create_event` (write)
- `update_event` (write)
- `cancel_event` (write)
- `sync_calendar` (write or a separately protected operational action)

Date/time slots should preserve the user's words and use UK time by default, with
an explicit timezone or all-day interpretation when the user gives one. Backend parsing should resolve
phrases such as "tomorrow at 3", durations, and timezone defaults deterministically.
Ambiguous requests such as "book lunch Friday" should ask for missing duration,
timezone, or calendar rather than guessing.

## Frontend Experience

Add a Calendar manifest and page under `src/frontend/src/plugins/calendar/`.

### Calendar page

- Header with current date, view selector, sync status, and connect/settings state.
- Calendar filter control that lets the user show or hide any synced calendar;
  filtering affects display only and never affects synchronization.
- Day view as the primary mobile-friendly view.
- Week view for desktop and wider screens.
- All-day row separated from timed events.
- Events positioned by local timezone and visually distinguished by source color.
- Tap/click opens event details; create action opens an event form.
- Loading, empty, disconnected, partial-sync, and sync-error states are explicit.

### Dashboard widget

Show the next few events and the current/next event when available. Do not mix
tasks into the widget unless a later combined agenda view is explicitly chosen.

### Settings/connect flow

Show connection identity, calendar selection, default destination, timezone, last
sync, sync-now action, and disconnect. Never display refresh tokens or client
secrets.

### WebSocket events

Register a topic such as `calendar.state_updated`. Payloads should include enough
state for the dashboard/widget and a changed-range hint, while the page can refetch
the affected range rather than receiving a potentially huge full calendar payload.

## Timezones and Recurrence

- Store provider timezone and UTC instants for timed events where both are needed.
- Store all-day events as calendar-local dates, not midnight UTC timestamps.
- Define the user's default timezone in one place and make it visible in settings.
- Preserve Google recurrence rules and exception dates even if the first UI only
  displays instances.
- Decide whether the local cache stores expanded instances, master events plus
  exceptions, or both. The safest initial approach is master-plus-exceptions with
  range expansion during reads, subject to performance testing.

## Security and Reliability

- Use OAuth state and callback validation to prevent CSRF.
- Request the smallest Google scope that supports the approved feature set.
- Encrypt refresh tokens at rest or use a secure secret store; never log tokens.
- Redact event descriptions, attendee data, and authorization headers from logs.
- Apply request timeouts, bounded retries, exponential backoff, and rate-limit
  handling to Google API calls.
- Protect connect/disconnect and all write routes using Toto's existing access
  assumptions and deployment network boundaries.
- Make disconnect behavior explicit: revoke Google access, delete local cache,
  or retain local data as an offline archive.

## Testing Strategy

### Backend unit tests

- Google response normalization for timed/all-day events and timezones.
- Pagination, upserts, deletions, and invalid sync-token recovery.
- Recurrence and exception handling.
- Date/time slot parsing and ambiguity handling.
- Etag conflict behavior and idempotent retries.
- OAuth state validation and token storage boundaries.

### Integration tests

- Initial sync followed by incremental sync.
- Remote create/update/delete followed by local cache updates.
- Local create/update/delete followed by provider response handling.
- Restart with pending or failed sync state.
- WebSocket state update after sync.

Use a fake Google Calendar client for deterministic tests. Keep live Google API
tests opt-in and isolated from the real account.

### Frontend tests/checks

- Calendar page with no connection, loading, empty, populated, and error states.
- Day/week range navigation and timezone rendering.
- Create/edit/delete confirmation flows.
- WebSocket refresh of a changed range.
- Responsive layout at mobile and desktop widths.

## Implementation Phases

1. **Decisions and setup**: answer the questions below; choose OAuth scopes,
   account model, timezone policy, sync windows, and conflict behavior.
2. **Provider foundation**: configuration, OAuth flow, secure token persistence,
   Google client abstraction, and fake client tests.
3. **Local model**: migrations/tables, normalized schemas, range queries, and
   sync-state persistence.
4. **Read synchronization**: initial/incremental sync, deletion handling,
   restart behavior, scheduling, and WebSocket updates.
5. **Calendar UI**: manifest, page, day/week views, widget, settings, and states.
6. **Write synchronization**: create/edit/delete workflows, etags, conflicts,
   command intents, and confirmation rendering.
7. **Hardening**: recurrence edge cases, rate limits, diagnostics, opt-in live
   tests, documentation, and README calendar status.

## Current Implementation Status

The first vertical slice is now implemented:

- Backend Calendar plugin auto-discovered at `/calendar`.
- Local SQLite event/source/sync-state tables.
- Google OAuth URL and callback routes.
- Google Calendar API client using the existing `aiohttp` dependency.
- Full sync window covering 30 days back and 365 days ahead, every five minutes.
- Token refresh, calendar colors, all-day events, meeting links, and event etags.
- Toto-side create/update/delete routes call Google when connected.
- Frontend day/week page with local-cache loading, calendar filters, sync state,
  and disconnected/error states.

Before live use, configure these backend environment variables:

```text
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_REDIRECT_URI=https://your-toto-host/calendar/oauth/callback
```

The Google Cloud OAuth client must allow the exact redirect URI above and enable
the Google Calendar API. Token persistence should be hardened with encrypted
at-rest storage before exposing the service beyond the trusted Tailscale setup.

## Acceptance Criteria

- A user can connect Google Calendar without exposing credentials to the browser.
- Selected calendars appear in Toto's local calendar view after initial sync.
- Remote additions, changes, and deletions appear after the next incremental sync.
- Toto still displays cached events when Google is temporarily unavailable.
- A user can create, edit, and delete supported events from Toto with confirmation.
- Conflicts are visible and never silently overwrite remote changes.
- Tasks remain separate from calendar events.
- Restarting Toto does not duplicate events or lose the sync cursor.
- Calendar state updates reach the dashboard/page without a manual refresh.

## Confirmed Product Decisions

- One Google account.
- Sync all calendars into Toto; calendar selection is a display filter only.
- Toto can create, edit, and delete Google Calendar events.
- Tasks remain separate from calendar events.
- Day and week views are the initial UI scope.
- Remote changes are polled every few minutes; Toto writes trigger an immediate
  sync as well.
- UK time is the default timezone.
- Conflicts use etags and require an explicit resolution instead of silently
  preferring either Toto or Google.

## Remaining Questions Before Implementation

1. **Default destination**: Which calendar should receive new events by default?
  Should the event form and command bar be able to choose another calendar?
2. **Read-only calendars**: Should read-only/shared calendars be displayed while
  only writable calendars are offered as destinations for new events?
3. **History window**: How far into the past and future should Toto cache events?
  A practical starting point would be 30 days back and 365 days ahead.
4. **Event detail**: Should the first version include attendees, conferencing
  links, location, attachments, reminders, colors, RSVP state, and organizer, or
  should some of these remain view-only/deferred?
5. **Recurrence**: Should Toto initially view recurring events but defer creating
  and editing recurrence rules, or must recurring-event editing be included?
6. **Reminders**: Should Toto display Google reminders, or should reminders wait
  for a later notification system?
7. **Offline behavior**: Should cached events remain visible after disconnect, and
  should offline writes be blocked, queued, or saved locally for later sync?
8. **Google project**: Do you already have a Google Cloud project and OAuth
  consent screen, or should setup instructions be included?
9. **Conflict UI**: When a conflict occurs, is a simple reload-versus-overwrite
  choice enough, or should Toto show a field-by-field comparison?
