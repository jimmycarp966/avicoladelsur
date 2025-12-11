'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'

export function FiltrosClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fechaFiltro = searchParams.get('fecha') || ''
  const turnoFiltro = searchParams.get('turno') || ''

  const handleFechaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('fecha', e.target.value)
    } else {
      params.delete('fecha')
    }
    router.push(`?${params.toString()}`)
  }

  const handleTurnoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('turno', e.target.value)
    } else {
      params.delete('turno')
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Fecha (opcional)</label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={handleFechaChange}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Turno</label>
            <select
              value={turnoFiltro}
              onChange={handleTurnoChange}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Todos</option>
              <option value="mañana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

