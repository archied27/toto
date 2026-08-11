import { MediaPage } from "./MediaPage";
import { ClapperboardIcon } from "lucide-react";

export default {
    id: 'media',
    label: 'Media',
    icon: ClapperboardIcon,
    page: MediaPage,
    widgets: {
        hero: null,
        small: null,
        wide: null
    },
    commandRenderers: {}
}