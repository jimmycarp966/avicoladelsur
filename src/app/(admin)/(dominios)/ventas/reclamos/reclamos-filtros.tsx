'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Filter, X } from 'lucide-react'

const estados = [
  { value: 'abierto', label: 'Abierto' },
  { value: 'investigando', label: 'Investigando' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' },
]

const prioridades = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
]

const tiposReclamo = [
  { value: 'producto_dañado', label: 'Producto Dañado' },
  { value: 'entrega_tardia', label: 'Entrega Tardía' },
  { value: 'cantidad_erronea', label: 'Cantidad Errónea' },
  { value: 'producto_equivocado', label: 'Producto Equivocado' },
  { value: 'precio_incorrecto', label: 'Precio Incorrecto' },
  { value: 'calidad_deficiente', label: 'Calidad Deficiente' },
  { value: 'empaque_dañado', label: 'Empaque Dañado' },
  { value: 'otro', label: 'Otro' },
]

export function ReclamosFiltros() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [estado, setEstado] = useState(searchParams.get('estado') || '')
  const [prioridad, setPrioridad] = useState(searchParams.get('prioridad') || '')
  const [tipoReclamo, setTipoReclamo] = useState(searchParams.get('tipo_reclamo') || '')
  const [fechaDesde, setFechaDesde] = useState(searchParams.get('fecha_desde') || '')
  const [fechaHasta, setFechaHasta] = useState(searchParams.get('fecha_hasta') || '')

  const aplicarFiltros = () => {
    const params = new URLSearchParams()
    if (estado) params.set('estado', estado)
    if (prioridad) params.set('prioridad', prioridad)
    if (tipoReclamo) params.set('tipo_reclamo', tipoReclamo)
    if (fechaDesde) params.set('fecha_desde', fechaDesde)
    if (fechaHasta) params.set('fecha_hasta', fechaHasta)
    router.push(`/ventas/reclamos?${params.toString()}`)
  }

  const limpiarFiltros = () => {
    setEstado('')
    setPrioridad('')
    setTipoReclamo('')
    setFechaDesde('')
    setFechaHasta('')
    router.push('/ventas/reclamos')
  }

  const tieneFiltros = estado || prioridad || tipoReclamo || fechaDesde || fechaHasta

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={estado || undefined} onValueChange={(value) => setEstado(value || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                {estados.map((est) => (
                  <SelectItem key={est.value} value={est.value}>
                    {est.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Select value={prioridad || undefined} onValueChange={(value) => setPrioridad(value || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las prioridades" />
              </SelectTrigger>
              <SelectContent>
                {prioridades.map((pri) => (
                  <SelectItem key={pri.value} value={pri.value}>
                    {pri.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Reclamo</Label>
            <Select value={tipoReclamo || undefined} onValueChange={(value) => setTipoReclamo(value || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                {tiposReclamo.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha Desde</Label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha Hasta</Label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={aplicarFiltros}>Aplicar Filtros</Button>
          {tieneFiltros && (
            <Button variant="outline" onClick={limpiarFiltros}>
              <X className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

