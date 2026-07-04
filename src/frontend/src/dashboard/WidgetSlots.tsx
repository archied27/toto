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
    <div className="flex flex-col p-4 gap-4 h-full">
      <div className="h-[55%]">
        {hero && hero.component}
      </div>

      <div className="h-[10%]">
        {wide && wide.component}
      </div>

      <div className="flex flex-row gap-2 flex-1 min-h-0">
        <div className="h-full w-[50%]">
          {smallA && smallA.component}
        </div>
        <div className="h-full w-[50%]">
          {smallB && smallB.component}
        </div>
      </div>
    </div>
  )
}