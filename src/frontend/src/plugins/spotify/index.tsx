import { Music2 } from "lucide-react";
import type { PluginManifest } from "../types";
import { SpotifyHeroWidget, SpotifyWidget, SpotifyWideWidget } from "./SpotifyPage";
import { SpotifyHeroInspiredPage } from "./SpotifyHeroInspiredPage";

export default {
    id: "spotify",
    label: "Spotify",
    icon: Music2,
    page: SpotifyHeroInspiredPage,
    widgets: {
        hero: SpotifyHeroWidget,
        small: SpotifyWidget,
        wide: SpotifyWideWidget,
        companion: SpotifyHeroWidget,
    },
} satisfies PluginManifest;