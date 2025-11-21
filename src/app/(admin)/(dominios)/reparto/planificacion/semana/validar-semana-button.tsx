'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle } from 'lucide-react'

import { validarSemanaCompletaAction } from '@/actions/plan-rutas.actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface ValidarSemanaButtonProps {
  semanaInicio: string // YYYY-MM-DD
}

export default function ValidarSemanaButton({ semanaInicio }: ValidarSemanaButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [validacion, setValidacion] = useState<any>(null)

  const handleValidar = () => {
    startTransition(async () => {
      const result = await validarSemanaCompletaAction(semanaInicio)
      if (result?.success !== undefined) {
        setValidacion(result.data)
        setDialogOpen(true)
      } else {
        toast.error(result?.message || 'Error al validar la semana')
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleValidar} disabled={isPending}>
        {isPending ? 'Validando...' : 'Validar Semana'}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Validación de Semana</DialogTitle>
            <DialogDescription>
              Resultados de la validación para la semana del {semanaInicio}
            </DialogDescription>
          </DialogHeader>

          {validacion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Total Zonas</p>
                  <p className="text-2xl font-bold">{validacion.total_zonas || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Planes</p>
                  <p className="text-2xl font-bold">{validacion.total_planes || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Planes Esperados</p>
                  <p className="text-2xl font-bold">{validacion.planes_esperados || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Planes Faltantes</p>
                  <p className={`text-2xl font-bold ${validacion.planes_faltantes > 0 ? 'text-destructive' : 'text-success'}`}>
                    {validacion.planes_faltantes || 0}
                  </p>
                </div>
              </div>

              {validacion.success ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Semana válida</AlertTitle>
                  <AlertDescription>
                    La semana está correctamente planificada sin errores.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Se encontraron problemas</AlertTitle>
                  <AlertDescription>
                    Revisa las advertencias y conflictos a continuación.
                  </AlertDescription>
                </Alert>
              )}

              {validacion.advertencias && Array.isArray(validacion.advertencias) && validacion.advertencias.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Advertencias</h4>
                  <div className="space-y-2">
                    {validacion.advertencias.map((adv: any, idx: number) => (
                      <div key={idx} className="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <Badge variant="outline" className="mr-2">
                          {adv.zona}
                        </Badge>
                        Día {adv.dia}, Turno {adv.turno} - Plan faltante
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validacion.conflictos && Array.isArray(validacion.conflictos) && validacion.conflictos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-destructive">Conflictos</h4>
                  <div className="space-y-2">
                    {validacion.conflictos.map((conf: any, idx: number) => (
                      <div key={idx} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        Repartidor {conf.repartidor_id} tiene conflicto en Día {conf.dia}, Turno {conf.turno}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validacion.repartidores_inactivos && Array.isArray(validacion.repartidores_inactivos) && validacion.repartidores_inactivos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-destructive">Repartidores Inactivos</h4>
                  <div className="space-y-2">
                    {validacion.repartidores_inactivos.map((rep: any, idx: number) => (
                      <div key={idx} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        Repartidor {rep.repartidor_id} está inactivo o no es repartidor
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

