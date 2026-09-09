import * as LucideIcons from "lucide-react";
import { Cpu, Zap, type LucideIcon } from "lucide-react";

const REGISTRY = LucideIcons as unknown as Record<string, LucideIcon>;

/** Resolve a kebab-case Lucide icon name ("rocket-minor") to a component. */
export function resolveIcon(name?: string | null, fallback: LucideIcon = Zap): LucideIcon {
  if (!name) return fallback;
  return REGISTRY[toPascalCase(name)] ?? fallback;
}

export const AGENT_FALLBACK_ICON = Cpu;
export const TOOL_FALLBACK_ICON = Zap;

function toPascalCase(name: string) {
    return name.replace(/(-\w)/g, (m) => m[1].toUpperCase()).replace(/^\w/, (m) => m.toUpperCase());
}
