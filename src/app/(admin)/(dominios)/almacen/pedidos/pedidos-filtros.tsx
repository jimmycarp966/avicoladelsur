'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Filter } from 'lucide-react'

export function PedidosFiltros() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0]
  const turno = searchParams.get('turno') || 'all'

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  const limpiarFiltros = () => {
    router.push('/almacen/pedidos')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
        <CardDescription>
          Filtra pedidos por fecha y turno
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="fecha" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fecha
            </Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => handleFilterChange('fecha', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="turno" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Turno
            </Label>
            <Select value={turno} onValueChange={(value) => handleFilterChange('turno', value)}>
              <SelectTrigger id="turno">
                <SelectValue placeholder="Todos los turnos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los turnos</SelectItem>
                <SelectItem value="mañana">Mañana</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={limpiarFiltros}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

