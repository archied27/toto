import { type ReactNode } from "react"

interface WidgetSlot {
  id: string
  component: ReactNode
}

interface WidgetSlotsProps {
  widgets: (WidgetSlot | null)[]
}

export default function WidgetSlots({ widgets }: WidgetSlotsProps) {
  const [hero, wide, smallA, smallB] = widgets

  if (!hero) return null

  return (
    <div className="flex flex-col p-4 gap-2 h-full">
      <div className="h-1/2">
        {hero && hero.component}
      </div>
      {wide && wide.component}
      {smallA && smallA.component}
      {smallB && smallB.component}
    </div>
  )
}