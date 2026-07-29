import type { CommandResult } from "@/plugins/types";
import "@fontsource-variable/geist";
export default function CommandResultRenderer({ result, onResult, }: {
    result: CommandResult;
    onResult?: (result: CommandResult) => void;
}): import("react/jsx-runtime").JSX.Element;
