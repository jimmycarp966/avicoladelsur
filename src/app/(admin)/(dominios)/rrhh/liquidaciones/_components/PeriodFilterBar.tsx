'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

interface Props {
  periodoMes?: number
  periodoAnio: number
}

export function PeriodFilterBar({ periodoMes, periodoAnio }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentYear = new Date().getFullYear()
  const anios = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)

  const navigate = (mes: string, anio: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (mes === 'todos') {
      params.delete('mes')
    } else {
      params.set('mes', mes)
    }
    params.set('anio', anio)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={periodoAnio.toString()}
        onValueChange={(anio) => navigate(periodoMes?.toString() ?? 'todos', anio)}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Año" />
        </SelectTrigger>
        <SelectContent>
          {anios.map((anio) => (
            <SelectItem key={anio} value={anio.toString()}>
              {anio}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={periodoMes?.toString() ?? 'todos'}
        onValueChange={(mes) => navigate(mes, periodoAnio.toString())}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Todos los meses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los meses</SelectItem>
          {MESES.map((mes) => (
            <SelectItem key={mes.value} value={mes.value.toString()}>
              {mes.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
