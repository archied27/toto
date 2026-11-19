import { Music2 } from "lucide-react";
import type { PluginManifest } from "../types";
import { SpotifyHeroWidget, SpotifyPage, SpotifyWidget, SpotifyWideWidget } from "./SpotifyPage";

export default {
    id: "spotify",
    label: "Spotify",
    icon: Music2,
    page: SpotifyPage,
    widgets: {
        hero: SpotifyHeroWidget,
        small: SpotifyWidget,
        wide: SpotifyWideWidget,
        companion: SpotifyHeroWidget,
    },
} satisfies PluginManifest;