'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Loader2, AlertTriangle, Info } from 'lucide-react'
import { confirmarPresupuestoAction, confirmarPresupuestosAgrupadosAction } from '@/actions/presupuestos.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { esVentaMayorista } from '@/lib/utils'
import { esItemPesable } from '@/lib/utils/pesaje'
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
  lista_precio?: {
    tipo?: string | null
  } | null
  items?: Array<{
    pesable?: boolean
    peso_final?: number | null
    lista_precio?: {
      tipo?: string | null
    } | null
    producto?: {
      categoria?: string
      venta_mayor_habilitada?: boolean
    }
  }>
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Verificar si hay items pesables sin pesar
  const tieneItemsSinPesar = (presupuesto: Presupuesto) => {
    return presupuesto.items?.some(
      (item) => esItemPesable(item, esVentaMayorista(presupuesto, item)) && !item.peso_final
    )
  }

  // Filtrar presupuestos que pueden convertirse (tienen turno, zona Y todos los pesables están pesados)
  const presupuestosConvertibles = presupuestos.filter(
    (p) => p.turno && p.zona_id && !tieneItemsSinPesar(p)
  )

  const handleConvertirMasivo = () => {
    if (presupuestosConvertibles.length === 0) {
      const sinTurnoZona = presupuestos.filter((p) => !p.turno || !p.zona_id).length
      const conItemsSinPesar = presupuestos.filter((p) => p.turno && p.zona_id && tieneItemsSinPesar(p)).length

      if (sinTurnoZona > 0 && conItemsSinPesar > 0) {
        showToast(
          'error',
          `No hay presupuestos convertibles: ${sinTurnoZona} sin turno/zona y ${conItemsSinPesar} con productos pesables sin pesar.`
        )
      } else if (sinTurnoZona > 0) {
        showToast(
          'error',
          `No hay presupuestos convertibles: ${sinTurnoZona} presupuesto(s) no tienen turno y/o zona asignados.`
        )
      } else if (conItemsSinPesar > 0) {
        showToast(
          'error',
          `No hay presupuestos convertibles: ${conItemsSinPesar} presupuesto(s) tienen productos pesables sin pesar. Todos los productos pesables deben estar pesados primero.`
        )
      } else {
        showToast(
          'error',
          'No hay presupuestos convertibles.'
        )
      }
      return
    }

    // Verificar que todos los presupuestos convertibles no tengan items sin pesar
    // (ya están filtrados arriba, pero verificamos por seguridad)
    const totalPresupuestos = presupuestos.length
    const cantidadConItemsSinPesar = presupuestos.filter((p) =>
      p.turno && p.zona_id && tieneItemsSinPesar(p)
    ).length

    if (cantidadConItemsSinPesar > 0) {
      showToast(
        'error',
        `No se puede convertir: ${cantidadConItemsSinPesar} presupuesto(s) tienen productos pesables sin pesar. Todos los productos pesables deben estar pesados primero.`
      )
      return
    }

    setShowConfirmDialog(true)
  }

  const confirmarConversion = async () => {
    setIsLoading(true)
    setShowConfirmDialog(false)

    try {
      // Convertir todos los presupuestos - la función SQL agrupa automáticamente por turno/zona/fecha
      const formData = new FormData()
      formData.append('presupuestos_ids', JSON.stringify(presupuestosConvertibles.map(p => p.id)))

      const result = await confirmarPresupuestosAgrupadosAction(formData)

      if (result.success) {
        const data = result.data as { exitosos?: number; pedidos_afectados?: string[] }
        const pedidosAfectados = data?.pedidos_afectados?.length || 1
        showToast(
          'success',
          result.message || `${presupuestosConvertibles.length} presupuesto(s) agregados a ${pedidosAfectados} pedido(s)`
        )
      } else {
        showToast('error', result.message || 'Error al convertir presupuestos')
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/almacen/presupuestos-dia')
        router.refresh()
      }
    } catch (error: any) {
      console.error('Error en conversión:', error)
      showToast('error', 'Error al convertir presupuestos: ' + error.message)
    } finally {
      setIsLoading(false)
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
        {isLoading ? (
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
              ¿Convertir {cantidadMasiva} presupuesto(s) a pedidos?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Se convertirán <strong>{cantidadMasiva}</strong> de{' '}
                  <strong>{cantidadTotal}</strong> presupuestos.
                </p>

                <div className="flex items-start gap-2 text-blue-600 bg-blue-50 p-3 rounded-md">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">
                    Los presupuestos se agruparán automáticamente por <strong>turno + zona + fecha</strong> en un solo pedido.
                    Cada cliente tendrá su propia entrega dentro del pedido.
                  </span>
                </div>

                {cantidadMasiva < cantidadTotal && (
                  <div className="flex items-start gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-md">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">
                      {cantidadTotal - cantidadMasiva} presupuesto(s) no se
                      convertirán porque no tienen turno y/o zona asignados.
                    </span>
                  </div>
                )}
              </div>
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

  const tieneItemsSinPesarIndividual = () => {
    return presupuesto.items?.some(
      (item) => esItemPesable(item, esVentaMayorista(presupuesto, item)) && !item.peso_final
    ) || false
  }

  const handleConvertir = () => {
    if (!presupuesto.turno || !presupuesto.zona_id) {
      showToast(
        'error',
        'El presupuesto debe tener turno y zona asignados antes de convertir a pedido'
      )
      return
    }

    // Validar que todos los productos pesables estén pesados
    if (tieneItemsSinPesarIndividual()) {
      showToast(
        'error',
        'No se puede convertir a pedido: todos los productos pesables deben estar pesados primero. Usa el botón "Comenzar Pesaje" para pesarlos.'
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

      console.log('🔍 DEBUG Frontend - Convirtiendo presupuesto:', presupuesto.id, presupuesto)

      const result = await confirmarPresupuestoAction(formData)

      console.log('🔍 DEBUG Frontend - Resultado:', JSON.stringify(result, null, 2))

      if (result.success) {
        showToast(
          'success',
          result.message || 'Presupuesto convertido a pedido exitosamente'
        )
        // Solo refrescar la página sin redirigir al pedido
        if (onSuccess) {
          onSuccess()
        } else {
          router.refresh()
        }
      } else {
        console.error('❌ DEBUG Frontend - Error:', result)
        // Mostrar el mensaje de error completo
        const errorMsg = result.message || 'Error al convertir presupuesto'
        showToast('error', errorMsg)
        // También mostrar debug info si existe
        if ((result as any).debug) {
          console.error('❌ DEBUG Info:', (result as any).debug)
        }
      }
    } catch (error: any) {
      console.error('❌ DEBUG Frontend - Excepción:', error)
      showToast('error', 'Error al convertir presupuesto: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const puedeConvertir = presupuesto.turno && presupuesto.zona_id && !tieneItemsSinPesarIndividual()

  return (
    <>
      <Button
        onClick={handleConvertir}
        disabled={isLoading || !puedeConvertir}
        size="sm"
        className="bg-green-600 hover:bg-green-700"
        title={
          !presupuesto.turno || !presupuesto.zona_id
            ? 'El presupuesto debe tener turno y zona asignados'
            : tieneItemsSinPesarIndividual()
              ? 'Todos los productos pesables deben estar pesados antes de convertir a pedido'
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
