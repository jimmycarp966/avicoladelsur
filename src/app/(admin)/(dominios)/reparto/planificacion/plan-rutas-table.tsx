'use client'

import { useTransition } from 'react'
import { Trash } from 'lucide-react'
import { toast } from 'sonner'

import { eliminarPlanRutaAction } from '@/actions/plan-rutas.actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PlanRutasTableProps {
  plan: any[]
  diasSemana: string[]
}

export default function PlanRutasTable({ plan, diasSemana }: PlanRutasTableProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = (planId: string) => {
    startTransition(async () => {
      const result = await eliminarPlanRutaAction(planId)
      if (result?.success) {
        toast.success('Plan eliminado')
      } else {
        toast.error(result?.message || 'No se pudo eliminar')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planificaciones activas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay rutas planificadas para la semana.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Repartidor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{diasSemana[entry.dia_semana]}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {entry.turno}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.zona?.nombre || 'Sin zona'}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{entry.vehiculo?.patente}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.vehiculo?.marca} {entry.vehiculo?.modelo}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.repartidor ? (
                        <span>
                          {entry.repartidor.nombre} {entry.repartidor.apellido}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(entry.id)}
                        disabled={isPending}
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Eliminar plan</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

