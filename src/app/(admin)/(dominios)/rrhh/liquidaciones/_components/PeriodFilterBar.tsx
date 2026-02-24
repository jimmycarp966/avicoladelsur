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
  ambito?: 'todos' | 'sucursal' | 'galpon'
  sucursalId?: string
  sucursales: Array<{ id: string; nombre: string }>
}

export function PeriodFilterBar({
  periodoMes,
  periodoAnio,
  ambito = 'todos',
  sucursalId,
  sucursales,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentYear = new Date().getFullYear()
  const anios = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)

  const navigate = (mes: string, anio: string, nextAmbito: string, nextSucursal?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (mes === 'todos') {
      params.delete('mes')
    } else {
      params.set('mes', mes)
    }
    params.set('anio', anio)
    if (nextAmbito === 'todos') {
      params.delete('ambito')
    } else {
      params.set('ambito', nextAmbito)
    }
    if (nextAmbito !== 'sucursal') {
      params.delete('sucursal')
    } else if (nextSucursal) {
      params.set('sucursal', nextSucursal)
    } else {
      params.delete('sucursal')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={periodoAnio.toString()}
        onValueChange={(anio) => navigate(periodoMes?.toString() ?? 'todos', anio, ambito, sucursalId)}
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
        onValueChange={(mes) => navigate(mes, periodoAnio.toString(), ambito, sucursalId)}
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

      <Select
        value={ambito}
        onValueChange={(nextAmbito) =>
          navigate(periodoMes?.toString() ?? 'todos', periodoAnio.toString(), nextAmbito, sucursalId)
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Ambito" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los ambitos</SelectItem>
          <SelectItem value="sucursal">Sucursal</SelectItem>
          <SelectItem value="galpon">Galpon</SelectItem>
        </SelectContent>
      </Select>

      {ambito === 'sucursal' && (
        <Select
          value={sucursalId ?? 'todas'}
          onValueChange={(value) =>
            navigate(
              periodoMes?.toString() ?? 'todos',
              periodoAnio.toString(),
              ambito,
              value === 'todas' ? undefined : value,
            )
          }
        >
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las sucursales</SelectItem>
            {sucursales.map((sucursal) => (
              <SelectItem key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
