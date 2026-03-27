'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
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

const ESTADOS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'calculada', label: 'Calculada' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pagada', label: 'Pagada' },
]

interface Props {
  periodoMes?: number
  periodoAnio: number
  ambito?: 'todos' | 'sucursal' | 'galpon'
  sucursalId?: string
  estado?: string
  busqueda?: string
  sucursales: Array<{ id: string; nombre: string }>
}

export function PeriodFilterBar({
  periodoMes,
  periodoAnio,
  ambito = 'todos',
  sucursalId,
  estado = 'todos',
  busqueda = '',
  sucursales,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(busqueda)

  const currentYear = new Date().getFullYear()
  const anios = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)

  useEffect(() => {
    setSearchValue(busqueda)
  }, [busqueda])

  const navigate = useCallback(
    (
      mes: string,
      anio: string,
      nextAmbito: string,
      nextSucursal?: string,
      nextEstado = estado,
      nextBusqueda = searchValue,
    ) => {
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

      if (nextEstado === 'todos') {
        params.delete('estado')
      } else {
        params.set('estado', nextEstado)
      }

      const normalizedSearch = nextBusqueda.trim()
      if (normalizedSearch) {
        params.set('q', normalizedSearch)
      } else {
        params.delete('q')
      }

      router.push(`?${params.toString()}`)
    },
    [estado, router, searchParams, searchValue],
  )

  useEffect(() => {
    const normalizedCurrent = busqueda.trim()
    const normalizedNext = searchValue.trim()

    const timeout = window.setTimeout(() => {
      if (normalizedCurrent !== normalizedNext) {
        navigate(
          periodoMes?.toString() ?? 'todos',
          periodoAnio.toString(),
          ambito,
          sucursalId,
          estado,
          searchValue,
        )
      }
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [ambito, busqueda, estado, navigate, periodoAnio, periodoMes, searchValue, sucursalId])

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="w-full lg:max-w-sm">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Buscar por empleado, legajo o puesto..."
          className="w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={periodoAnio.toString()}
          onValueChange={(anio) =>
            navigate(periodoMes?.toString() ?? 'todos', anio, ambito, sucursalId, estado, searchValue)
          }
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
          onValueChange={(mes) =>
            navigate(mes, periodoAnio.toString(), ambito, sucursalId, estado, searchValue)
          }
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
            navigate(
              periodoMes?.toString() ?? 'todos',
              periodoAnio.toString(),
              nextAmbito,
              sucursalId,
              estado,
              searchValue,
            )
          }
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Ambito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los ambitos</SelectItem>
            <SelectItem value="sucursal">Sucursal</SelectItem>
            <SelectItem value="galpon">Galpon / Casa Central / RRHH</SelectItem>
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
                estado,
                searchValue,
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

        <Select
          value={estado}
          onValueChange={(nextEstado) =>
            navigate(
              periodoMes?.toString() ?? 'todos',
              periodoAnio.toString(),
              ambito,
              sucursalId,
              nextEstado,
              searchValue,
            )
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
