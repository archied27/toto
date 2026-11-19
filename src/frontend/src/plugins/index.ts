import type { PluginManifest } from "./types"
import weather from "./weather"
import tasks from "./tasks"
import media from "./media"
import web from "./web"
import habits from "./habits"
import calendar from "./calendar"
import spotify from "./spotify"

export const plugins: PluginManifest[] = [tasks, weather, media, web, habits, calendar, spotify]