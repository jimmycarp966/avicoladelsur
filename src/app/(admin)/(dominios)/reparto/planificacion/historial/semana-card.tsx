'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Calendar, MapPin, User } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Días ordenados de lunes a domingo (índice 0 = lunes, índice 6 = domingo)
// Pero en BD: 0=domingo, 1=lunes, ..., 6=sábado
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface SemanaCardProps {
  semana: {
    semana_inicio: string
    semana_fin: string
    total_planes: number
    zonas_cubiertas: number
    repartidores_asignados: number
    dias_cubiertos: number
    primera_planificacion: string
    ultima_actualizacion: string
    planes: Array<{
      id: string
      zona_id: string
      dia_semana: number
      turno: 'mañana' | 'tarde'
      repartidor_id: string | null
      zona?: { nombre: string }
      repartidor?: { nombre: string; apellido?: string | null }
    }>
  }
}

export default function SemanaCard({ semana }: SemanaCardProps) {
  const [expanded, setExpanded] = useState(false)

  const fechaInicio = new Date(semana.semana_inicio)
  const fechaFin = new Date(semana.semana_fin)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-semibold text-lg">
                Semana del {format(fechaInicio, "d 'de' MMMM", { locale: es })} al{' '}
                {format(fechaFin, "d 'de' MMMM yyyy", { locale: es })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {format(fechaInicio, "d/M/yyyy", { locale: es })} - {format(fechaFin, "d/M/yyyy", { locale: es })}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Ver detalles
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Planes</p>
            <p className="text-2xl font-bold">{semana.total_planes}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Zonas Cubiertas</p>
            <p className="text-2xl font-bold">{semana.zonas_cubiertas}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Repartidores</p>
            <p className="text-2xl font-bold">{semana.repartidores_asignados}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Días Cubiertos</p>
            <p className="text-2xl font-bold">{semana.dias_cubiertos}</p>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Planes Detallados</h4>
              {semana.planes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay planes para esta semana.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Día</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Zona</TableHead>
                        <TableHead>Repartidor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {semana.planes.map((plan) => {
                        // Convertir día de BD (0=domingo, 1=lunes, ..., 6=sábado) a índice del array (0=lunes, 6=domingo)
                        const diaIdx = plan.dia_semana === 0 ? 6 : plan.dia_semana - 1
                        return (
                          <TableRow key={plan.id}>
                            <TableCell>{DIAS_SEMANA[diaIdx]}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {plan.turno}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {plan.zona?.nombre || 'Sin zona'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {plan.repartidor ? (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {plan.repartidor.nombre} {plan.repartidor.apellido}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin asignar</span>
                            )}
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                Primera planificación: {format(new Date(semana.primera_planificacion), "d/M/yyyy HH:mm", { locale: es })}
              </p>
              <p>
                Última actualización: {format(new Date(semana.ultima_actualizacion), "d/M/yyyy HH:mm", { locale: es })}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

