"use client"
import { format, parseISO } from "date-fns"
import { CalendarIcon, ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  placeholder?: string
  value?: string | null
  onChange?: (isoDate: string | null) => void
}

export function DatePicker({ placeholder, value, onChange }: DatePickerProps) {
  const date = value ? parseISO(value) : undefined

  const handleSelect = (selected: Date | undefined) => {
    if (!onChange) return
    onChange(selected ? format(selected, "yyyy-MM-dd") : null)
  }

  return (
    <div className="dark">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            data-empty={!date}
            className="w-[212px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground w-full"
          >
            <CalendarIcon />
            {date ? format(date, "PPP") : <span className="flex-1">{placeholder}</span>}
            <ChevronDownIcon />
          </Button>
          
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background" align="center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={date}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}