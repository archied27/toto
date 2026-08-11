import { GlobeIcon } from "lucide-react";
import type { PluginManifest } from "../types";

// Backend-only plugin: web searches are consumed by the LLM tool flow and have
// no page or dashboard widgets, but the manifest is registered so the tool-call
// list can show the plugin's icon.
export default {
    id: 'web',
    label: 'Web',
    icon: GlobeIcon,
    page: () => null,
    widgets: {
        hero: null,
        small: null,
        wide: null
    },
    commandRenderers: {}
} satisfies PluginManifest
