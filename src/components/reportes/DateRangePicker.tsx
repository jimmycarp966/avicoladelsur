'use client'

import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
  fechaDesde: string
  fechaHasta: string
  onDateChange: (desde: string, hasta: string) => void
  className?: string
}

const presets = [
  { label: 'Hoy', getDates: () => ({ desde: format(new Date(), 'yyyy-MM-dd'), hasta: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Ayer', getDates: () => ({ desde: format(subDays(new Date(), 1), 'yyyy-MM-dd'), hasta: format(subDays(new Date(), 1), 'yyyy-MM-dd') }) },
  { label: 'Últimos 7 días', getDates: () => ({ desde: format(subDays(new Date(), 6), 'yyyy-MM-dd'), hasta: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Últimos 30 días', getDates: () => ({ desde: format(subDays(new Date(), 29), 'yyyy-MM-dd'), hasta: format(new Date(), 'yyyy-MM-dd') }) },
  { label: 'Esta semana', getDates: () => ({ desde: format(startOfWeek(new Date(), { locale: es }), 'yyyy-MM-dd'), hasta: format(endOfWeek(new Date(), { locale: es }), 'yyyy-MM-dd') }) },
  { label: 'Semana pasada', getDates: () => {
    const lastWeek = subWeeks(new Date(), 1)
    return { desde: format(startOfWeek(lastWeek, { locale: es }), 'yyyy-MM-dd'), hasta: format(endOfWeek(lastWeek, { locale: es }), 'yyyy-MM-dd') }
  }},
  { label: 'Este mes', getDates: () => ({ desde: format(startOfMonth(new Date()), 'yyyy-MM-dd'), hasta: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'Mes pasado', getDates: () => {
    const lastMonth = subMonths(new Date(), 1)
    return { desde: format(startOfMonth(lastMonth), 'yyyy-MM-dd'), hasta: format(endOfMonth(lastMonth), 'yyyy-MM-dd') }
  }},
]

export function DateRangePicker({
  fechaDesde,
  fechaHasta,
  onDateChange,
  className,
}: DateRangePickerProps) {
  const handlePreset = (presetLabel: string) => {
    if (presetLabel === 'custom') return
    const preset = presets.find(p => p.label === presetLabel)
    if (preset) {
      const dates = preset.getDates()
      onDateChange(dates.desde, dates.hasta)
    }
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <div className="flex items-center gap-2">
        <Label htmlFor="fecha-desde" className="text-sm whitespace-nowrap">
          Desde:
        </Label>
        <Input
          id="fecha-desde"
          type="date"
          value={fechaDesde}
          onChange={(e) => onDateChange(e.target.value, fechaHasta)}
          className="w-[140px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="fecha-hasta" className="text-sm whitespace-nowrap">
          Hasta:
        </Label>
        <Input
          id="fecha-hasta"
          type="date"
          value={fechaHasta}
          onChange={(e) => onDateChange(fechaDesde, e.target.value)}
          className="w-[140px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="preset" className="text-sm whitespace-nowrap">
          Preset:
        </Label>
        <Select onValueChange={handlePreset}>
          <SelectTrigger id="preset" className="w-[160px]">
            <SelectValue placeholder="Seleccionar preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Personalizado</SelectItem>
            {presets.map((preset) => (
              <SelectItem key={preset.label} value={preset.label}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

