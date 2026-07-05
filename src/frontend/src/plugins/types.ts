import type { ComponentType } from 'react'

export interface CommandResult {
  success: boolean
  action: string
  response: string
  data: Record<string, any>
}

export interface PluginManifest {
  id: string
  label: string
  page: ComponentType
  widgets: {
    hero: ComponentType | null
    small: ComponentType | null
    wide?: ComponentType | null
  }

  commandRenderers?: Partial<Record<string, ComponentType<{ data: any }>>>;
}