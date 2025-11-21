'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, MapPin, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PresupuestosDiaFiltrosProps {
  zonas: Array<{ id: string; nombre: string }>
  fecha: string
  zonaId?: string
  turno?: string
}

export function PresupuestosDiaFiltros({ zonas, fecha, zonaId, turno }: PresupuestosDiaFiltrosProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Filtros
        </CardTitle>
        <CardDescription>
          Filtra presupuestos por fecha, zona y turno
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => handleFilterChange('fecha', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zona" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Zona
            </Label>
            <Select value={zonaId || 'all'} onValueChange={(value) => handleFilterChange('zona_id', value)}>
              <SelectTrigger id="zona">
                <SelectValue placeholder="Todas las zonas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {zonas.map(zona => (
                  <SelectItem key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="turno" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Turno
            </Label>
            <Select value={turno || 'all'} onValueChange={(value) => handleFilterChange('turno', value)}>
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
              onClick={() => {
                router.push('/almacen/presupuestos-dia')
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

