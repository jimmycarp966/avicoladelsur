'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SelectorSemanaProps {
  semanaInicio: string // YYYY-MM-DD
}

// Función helper para calcular inicio de semana (lunes)
function calcularInicioSemana(fecha: Date): Date {
  const dia = fecha.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() + diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

export default function SelectorSemana({ semanaInicio }: SelectorSemanaProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fechaActual = new Date(semanaInicio)

  const handleDateSelect = (fecha: Date | undefined) => {
    if (!fecha) return

    const lunes = calcularInicioSemana(fecha)
    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', lunes.toISOString().split('T')[0])
    router.push(`?${params.toString()}`)
  }

  const handlePreviousWeek = () => {
    const fecha = new Date(semanaInicio)
    fecha.setDate(fecha.getDate() - 7)
    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', fecha.toISOString().split('T')[0])
    router.push(`?${params.toString()}`)
  }

  const handleNextWeek = () => {
    const fecha = new Date(semanaInicio)
    fecha.setDate(fecha.getDate() + 7)
    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', fecha.toISOString().split('T')[0])
    router.push(`?${params.toString()}`)
  }

  const handleToday = () => {
    const lunes = calcularInicioSemana(new Date())
    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', lunes.toISOString().split('T')[0])
    router.push(`?${params.toString()}`)
  }

  const semanaFin = new Date(fechaActual)
  semanaFin.setDate(fechaActual.getDate() + 6)

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePreviousWeek}>
        ←
      </Button>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={semanaInicio}
          onChange={(e) => {
            if (e.target.value) {
              handleDateSelect(new Date(e.target.value))
            }
          }}
          className="w-[180px]"
        />
        <span className="text-sm text-muted-foreground">
          {format(fechaActual, "d 'de' MMMM", { locale: es })} - {format(semanaFin, "d 'de' MMMM", { locale: es })}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={handleNextWeek}>
        →
      </Button>
      <Button variant="outline" size="sm" onClick={handleToday}>
        Hoy
      </Button>
    </div>
  )
}

