'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  busqueda?: string
  sucursal?: string
  puesto?: string
  sucursales: string[]
  puestos: string[]
}

export function EmpleadosFilterBar({
  busqueda = '',
  sucursal = 'todas',
  puesto = 'todos',
  sucursales,
  puestos,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(busqueda)

  useEffect(() => {
    setSearchValue(busqueda)
  }, [busqueda])

  const navigate = useCallback(
    (nextBusqueda = searchValue, nextSucursal = sucursal, nextPuesto = puesto) => {
      const params = new URLSearchParams(searchParams.toString())

      const normalizedSearch = nextBusqueda.trim()
      if (normalizedSearch) {
        params.set('q', normalizedSearch)
      } else {
        params.delete('q')
      }

      if (nextSucursal && nextSucursal !== 'todas') {
        params.set('sucursal', nextSucursal)
      } else {
        params.delete('sucursal')
      }

      if (nextPuesto && nextPuesto !== 'todos') {
        params.set('puesto', nextPuesto)
      } else {
        params.delete('puesto')
      }

      router.push(`?${params.toString()}`)
    },
    [puesto, router, searchParams, searchValue, sucursal],
  )

  useEffect(() => {
    const normalizedCurrent = busqueda.trim()
    const normalizedNext = searchValue.trim()

    const timeout = window.setTimeout(() => {
      if (normalizedCurrent !== normalizedNext) {
        navigate(searchValue, sucursal, puesto)
      }
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [busqueda, navigate, puesto, searchValue, sucursal])

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-start lg:gap-4">
      <div className="w-full lg:max-w-sm">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Buscar por empleado, legajo o email..."
          className="w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={sucursal} onValueChange={(value) => navigate(searchValue, value, puesto)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas las sucursales" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las sucursales</SelectItem>
            {sucursales.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={puesto} onValueChange={(value) => navigate(searchValue, sucursal, value)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todos los puestos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los puestos</SelectItem>
            {puestos.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
