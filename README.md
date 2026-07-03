# Toto

## What it is?
Toto is a personal home assistant driven by an event-focused architecture. It houses plugins which provide the actual functionality.

## Screenshots
### Dashboard
Only tasks has a priority (left) vs nothing has any priority, i.e. all tasks have 0 dashboard priority (right)

<table>
  <tr>
    <td><img src="/docs/screenshots/dashboard_with_hero.jpeg" width="180"></td>
    <td><img src="/docs/screenshots/dashboard_no_widgets.jpeg" width="180"></td>
  </tr>
</table>

### Tasks
Today tab, Add Task, Add a New List, Full Task Screen

<table>
  <tr>
    <td><img src="/docs/screenshots/tasks_today.jpeg" width="180"></td>
    <td><img src="/docs/screenshots/task_add.jpeg" width="180"></td>
    <td><img src="/docs/screenshots/task_add_list.jpeg" width="180"></td>
    <td><img src="/docs/screenshots/task_full_task.jpeg" width="180"></td>
  </tr>
</table>

### Weather
Today's Weather, Next Week's Weather, Weather Graphs

<table>
  <tr>
    <td><img src="/docs/screenshots/weather_main.jpeg" width="180"></td>
    <td><img src="/docs/screenshots/weather_next_mon.jpeg" width="180"></td>
    <td><img src="/docs/screenshots/weather_graphs.jpeg" width="180"></td>
  </tr>
</table>

### Command Bar
Using the weather's parsing

<img src="/docs/screenshots/command_bar_weather.jpeg" width="180">

## Features
The architecture provides many useful features in which the plugins use and are used to manage plugins

- **Event Bus**
    
    This provides the ability for plugins to communicate with each other. It uses a pub sub methodology, in which they can send out event messages e.g `task.created` which can have optional data, and then can also subscribe to messages, so a calendar plugin could have on `task.created` create a calendar event for it.

- **Command Endpoint**
    
    This is where the command bar is used, where each plugin currently provides their own parser (using regex) and the endpoint takes in text and returns a response from a plugin. A future upgrade is to use an intent classifier with a local LLM for data extraction and as a fallback if no match is found.

- **Websocket Manager**

    This is built on the event bus and it 'subscribes' to messages to then broadcast to all clients connected to the websocket.

- **Plugin Manager**

    This loads all plugins - sets them up, forwards their websocket events to the websocket manager, loading their routes, etc. It automatically discovers them in the `/plugin` folder, using their `plugin.py` file.

- **Scheduler**

    This allows for tasks to be scheduled to be completed at a certain time, it also allows for cron style recurring tasks.

- **Background Worker**

    This allows for long tasks to work in the background and not block other functionality, for example, running a ML algorithm would be done here.

- **Database Manager**

    This allows for use of the database, in which all plugins use the same `toto.db` file, but have their own tables, using a naming convention `[plugin]_table`, so `tasks_labels` would be a table belonging to the tasks plugin.

- **State Manager**

    This is a data store where each plugin provides their state slice, which includes their dashboard and page priority (more below), as well as some data which provides an overview of what is happening at a time.

- **Dynamic Dashboard and Page Ordering**

    This is where dashboard widgets and page ordering is dynamically chosen based on each plugin's priority, and is forwarded to the frontend using the websocket. This allows for the most useful plugins' information to be more present at a certain time.

## Tech Stack
**Backend**

This uses a FastAPI backend (written in python), using pydantic models for request shapes. The database uses SQLite.

**Frontend**

The frontend is designed to be mobile-first, particularly on a PWA. It uses **React** (with typescript), **shadcn** components and **TailwindCSS**

**Network**

I use Tailscale to access this from anywhere, and also rely on this to provide privacy and security.

## Plugins

### Weather
The weather plugin provides a 14 day forecast (from open meteo) of precipitation, temperature, uv and grass pollen (useful to me particularly)

### Tasks
The tasks plugin provides adding scheduled tasks with to do dates as well as due dates, which I find fits the way I work cleanly. It is kept minimalist to features I want, which include a list, and multiple labels, a title and a description. Each task is logged which will in future be used by an AI as context.

## To Do
### Plugins
- [ ] Calendar
- [ ] Gym Tracker
- [ ] Finance Tracker
- [ ] Spotify Integration
- [ ] Habits
- [ ] Media (movies and tv shows)
- [ ] Sheet Music Manager (automatic downloads and progression)
- [ ] Focus/Pomodoro
- [ ] Recipe Tracker
- [ ] Timers

### General
- [ ] Push Notifications
- [ ] Intent Classifier for command bar with LLM extraction and fallback

### Future Upgrades

**Centralised AI**

I would like, to after more plugins and more data is collected, add an AI which uses a specialised context (productivity_score, weather, etc) to automate more and to provide more personalised features which no other application can provide.

This could provide a daily overview as well.

**Embedded Systems**

I would like in the future to include embedded systems into this which would integrate a more physical interaction with it.

An idea is to add an alarm clock, in which the time to wake up is determined by Toto (the backend)