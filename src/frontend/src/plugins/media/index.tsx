import { MediaPage } from "./MediaPage";
import { ClapperboardIcon } from "lucide-react";
import { CurrentlyPlayingCompanion } from "./components/CurrentlyPlayingCompanion";

export default {
    id: 'media',
    label: 'Media',
    icon: ClapperboardIcon,
    page: MediaPage,
    widgets: {
        hero: CurrentlyPlayingCompanion,
        small: null,
        wide: null,
        companion: CurrentlyPlayingCompanion
    },
    commandRenderers: {}
}