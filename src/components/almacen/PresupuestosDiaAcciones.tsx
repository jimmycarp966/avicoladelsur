'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Loader2, AlertTriangle } from 'lucide-react'
import { confirmarPresupuestoAction, confirmarPresupuestosAgrupadosAction } from '@/actions/presupuestos.actions'
import { useNotificationStore } from '@/store/notificationStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Presupuesto {
  id: string
  numero_presupuesto: string
  turno?: string | null
  zona_id?: string | null
  cliente_id?: string | null
  fecha_entrega_estimada?: string | null
  items?: Array<{ pesable?: boolean; peso_final?: number | null }>
}

interface PresupuestosDiaAccionesProps {
  presupuestos: Presupuesto[]
  onSuccess?: () => void
}

export function PresupuestosDiaAcciones({
  presupuestos,
  onSuccess,
}: PresupuestosDiaAccionesProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [modoMasivo, setModoMasivo] = useState(false)

  // Filtrar presupuestos que pueden convertirse (tienen turno y zona)
  const presupuestosConvertibles = presupuestos.filter(
    (p) => p.turno && p.zona_id
  )

  // Verificar si hay items pesables sin pesar
  const tieneItemsSinPesar = (presupuesto: Presupuesto) => {
    return presupuesto.items?.some(
      (item) => item.pesable && !item.peso_final
    )
  }

  const handleConvertirIndividual = (presupuesto: Presupuesto) => {
    if (!presupuesto.turno || !presupuesto.zona_id) {
      showToast(
        'error',
        'El presupuesto debe tener turno y zona asignados antes de convertir a pedido'
      )
      return
    }

    if (tieneItemsSinPesar(presupuesto)) {
      showToast(
        'warning',
        'Hay productos pesables sin pesar. ¿Deseas continuar de todos modos?'
      )
    }

    setPresupuestoSeleccionado(presupuesto.id)
    setModoMasivo(false)
    setShowConfirmDialog(true)
  }

  const handleConvertirMasivo = () => {
    if (presupuestosConvertibles.length === 0) {
      showToast(
        'error',
        'No hay presupuestos convertibles. Todos deben tener turno y zona asignados.'
      )
      return
    }

    const conItemsSinPesar = presupuestosConvertibles.filter((p) =>
      tieneItemsSinPesar(p)
    )

    if (conItemsSinPesar.length > 0) {
      showToast(
        'warning',
        `${conItemsSinPesar.length} presupuesto(s) tienen productos pesables sin pesar. Se convertirán de todos modos.`
      )
    }

    setPresupuestoSeleccionado(null)
    setModoMasivo(true)
    setShowConfirmDialog(true)
  }

  // Función para agrupar presupuestos por cliente, turno y zona
  const agruparPresupuestos = (presupuestos: Presupuesto[]) => {
    const grupos: Record<string, Presupuesto[]> = {}

    for (const presupuesto of presupuestos) {
      // Crear clave única para el grupo
      const clave = `${presupuesto.cliente_id || 'sin-cliente'}-${presupuesto.turno || 'sin-turno'}-${presupuesto.zona_id || 'sin-zona'}`

      if (!grupos[clave]) {
        grupos[clave] = []
      }
      grupos[clave].push(presupuesto)
    }

    return Object.values(grupos)
  }

  const confirmarConversion = async () => {
    setIsLoading(true)
    setShowConfirmDialog(false)

    try {
      const presupuestosAConvertir = modoMasivo
        ? presupuestosConvertibles
        : presupuestos.filter((p) => p.id === presupuestoSeleccionado)

      if (modoMasivo) {
        // Agrupar presupuestos por cliente/turno/zona
        const grupos = agruparPresupuestos(presupuestosAConvertir)
        let pedidosCreados = 0
        let errores = 0
        const erroresDetalle: string[] = []

        for (const grupo of grupos) {
          try {
            const formData = new FormData()
            formData.append('presupuestos_ids', JSON.stringify(grupo.map(p => p.id)))

            const result = await confirmarPresupuestosAgrupadosAction(formData)

            if (result.success) {
              pedidosCreados++
            } else {
              errores++
              erroresDetalle.push(
                `Grupo de ${grupo.length} presupuesto(s): ${result.message}`
              )
            }
          } catch (error: any) {
            errores++
            erroresDetalle.push(
              `Grupo de ${grupo.length} presupuesto(s): ${error.message || 'Error desconocido'}`
            )
          }
        }

        if (pedidosCreados > 0) {
          showToast(
            'success',
            `${pedidosCreados} pedido(s) creado(s) desde ${presupuestosAConvertir.length} presupuesto(s) agrupado(s)`
          )
        }

        if (errores > 0) {
          showToast(
            'error',
            `${errores} grupo(s) tuvieron errores. Ver detalles en consola.`
          )
          console.error('Errores de conversión agrupada:', erroresDetalle)
        }
      } else {
        // Conversión individual (sin cambios)
        let exitosos = 0
        let errores = 0
        const erroresDetalle: string[] = []

        for (const presupuesto of presupuestosAConvertir) {
          try {
            const formData = new FormData()
            formData.append('presupuesto_id', presupuesto.id)

            const result = await confirmarPresupuestoAction(formData)

            if (result.success) {
              exitosos++
            } else {
              errores++
              erroresDetalle.push(
                `${presupuesto.numero_presupuesto}: ${result.message}`
              )
            }
          } catch (error: any) {
            errores++
            erroresDetalle.push(
              `${presupuesto.numero_presupuesto}: ${error.message || 'Error desconocido'}`
            )
          }
        }

        if (exitosos > 0) {
          showToast(
            'success',
            `${exitosos} presupuesto(s) convertido(s) a pedido(s) exitosamente`
          )
        }

        if (errores > 0) {
          showToast(
            'error',
            `${errores} presupuesto(s) tuvieron errores. Ver detalles en consola.`
          )
          console.error('Errores de conversión:', erroresDetalle)
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (error: any) {
      console.error('Error en conversión:', error)
      showToast('error', 'Error al convertir presupuestos: ' + error.message)
    } finally {
      setIsLoading(false)
      setPresupuestoSeleccionado(null)
    }
  }

  const cantidadMasiva = presupuestosConvertibles.length
  const cantidadTotal = presupuestos.length

  return (
    <>
      <Button
        onClick={handleConvertirMasivo}
        disabled={isLoading || cantidadMasiva === 0}
        className="bg-green-600 hover:bg-green-700"
      >
        {isLoading && modoMasivo ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Convirtiendo...
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Pasar a Pedidos del Día ({cantidadMasiva})
          </>
        )}
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modoMasivo
                ? `¿Convertir ${cantidadMasiva} presupuesto(s) a pedidos?`
                : '¿Convertir presupuesto a pedido?'}
            </DialogTitle>
            <DialogDescription>
              {modoMasivo ? (
                <>
                  Se convertirán <strong>{cantidadMasiva}</strong> de{' '}
                  <strong>{cantidadTotal}</strong> presupuestos a pedidos.
                  {cantidadMasiva < cantidadTotal && (
                    <div className="mt-2 flex items-start gap-2 text-yellow-600">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <span className="text-sm">
                        {cantidadTotal - cantidadMasiva} presupuesto(s) no se
                        convertirán porque no tienen turno y/o zona asignados.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  El presupuesto se convertirá a pedido y se descontarán las
                  existencias del almacén.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarConversion}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Convirtiendo...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface PresupuestoIndividualAccionProps {
  presupuesto: Presupuesto
  onSuccess?: () => void
}

export function PresupuestoIndividualAccion({
  presupuesto,
  onSuccess,
}: PresupuestoIndividualAccionProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleConvertir = () => {
    if (!presupuesto.turno || !presupuesto.zona_id) {
      showToast(
        'error',
        'El presupuesto debe tener turno y zona asignados antes de convertir a pedido'
      )
      return
    }

    setShowConfirmDialog(true)
  }

  const confirmarConversion = async () => {
    setIsLoading(true)
    setShowConfirmDialog(false)

    try {
      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)

      const result = await confirmarPresupuestoAction(formData)

      if (result.success) {
        showToast(
          'success',
          result.message || 'Presupuesto convertido a pedido exitosamente'
        )
        if (result.data?.pedido_id) {
          router.push(`/almacen/pedidos/${result.data.pedido_id}`)
        } else {
          if (onSuccess) {
            onSuccess()
          } else {
            router.refresh()
          }
        }
      } else {
        showToast('error', result.message || 'Error al convertir presupuesto')
      }
    } catch (error: any) {
      console.error('Error convirtiendo presupuesto:', error)
      showToast('error', 'Error al convertir presupuesto: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const puedeConvertir = presupuesto.turno && presupuesto.zona_id

  return (
    <>
      <Button
        onClick={handleConvertir}
        disabled={isLoading || !puedeConvertir}
        size="sm"
        className="bg-green-600 hover:bg-green-700"
        title={
          !puedeConvertir
            ? 'El presupuesto debe tener turno y zona asignados'
            : 'Convertir a pedido'
        }
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Convirtiendo...
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Pasar a Pedido
          </>
        )}
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Convertir presupuesto a pedido?</DialogTitle>
            <DialogDescription>
              El presupuesto <strong>{presupuesto.numero_presupuesto}</strong>{' '}
              se convertirá a pedido y se descontarán las existencias del
              almacén.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarConversion}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Convirtiendo...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

