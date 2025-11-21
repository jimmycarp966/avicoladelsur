'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FileText, CreditCard, Package } from 'lucide-react'
import { convertirPresupuestoACotizacionAction, enviarPresupuestoAlmacenAction } from '@/actions/presupuestos.actions'
import { useNotificationStore } from '@/store/notificationStore'

interface PresupuestoAccionesButtonsProps {
  presupuestoId: string
  estado: string
  puedeFacturarDirecto: boolean
  tieneTurnoYZona: boolean
}

export function PresupuestoAccionesButtons({
  presupuestoId,
  estado,
  puedeFacturarDirecto,
  tieneTurnoYZona,
}: PresupuestoAccionesButtonsProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [actionType, setActionType] = useState<string | null>(null)

  const handleConvertirACotizacion = async () => {
    try {
      setIsLoading(true)
      setActionType('cotizacion')

      const result = await convertirPresupuestoACotizacionAction(presupuestoId)

      if (result.success) {
        showToast('success', result.message || 'Presupuesto convertido a cotización exitosamente')
        router.refresh()
      } else {
        showToast('error', result.message || 'Error al convertir a cotización')
      }
    } catch (error: any) {
      console.error('Error convirtiendo presupuesto:', error)
      showToast('error', error.message || 'Error al convertir a cotización')
    } finally {
      setIsLoading(false)
      setActionType(null)
    }
  }

  const handleFacturarDirecto = async () => {
    try {
      setIsLoading(true)
      setActionType('facturar')

      const response = await fetch('/api/ventas/presupuestos/facturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuesto_id: presupuestoId }),
      })

      const result = await response.json()

      if (result.success) {
        showToast('success', result.message || 'Presupuesto facturado exitosamente')
        router.refresh()
      } else {
        showToast('error', result.message || 'Error al facturar presupuesto')
      }
    } catch (error: any) {
      console.error('Error facturando presupuesto:', error)
      showToast('error', error.message || 'Error al facturar presupuesto')
    } finally {
      setIsLoading(false)
      setActionType(null)
    }
  }

  const handleEnviarAlmacen = async () => {
    try {
      setIsLoading(true)
      setActionType('almacen')

      const result = await enviarPresupuestoAlmacenAction(presupuestoId)

      if (result.success) {
        showToast('success', result.message || 'Presupuesto enviado a almacén exitosamente')
        router.refresh()
      } else {
        showToast('error', result.message || 'Error al enviar a almacén')
      }
    } catch (error: any) {
      console.error('Error enviando presupuesto:', error)
      showToast('error', error.message || 'Error al enviar a almacén')
    } finally {
      setIsLoading(false)
      setActionType(null)
    }
  }

  if (estado !== 'pendiente') {
    return null
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleConvertirACotizacion}
        disabled={isLoading}
      >
        <FileText className="mr-2 h-4 w-4" />
        Convertir a Cotización
      </Button>
      {puedeFacturarDirecto && (
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={handleFacturarDirecto}
          disabled={isLoading || actionType !== null && actionType !== 'facturar'}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Facturar sin Almacén
        </Button>
      )}
      <Button
        onClick={handleEnviarAlmacen}
        className="bg-blue-600 hover:bg-blue-700"
        disabled={!tieneTurnoYZona || (isLoading && actionType !== 'almacen')}
      >
        <Package className="mr-2 h-4 w-4" />
        Enviar a Almacén
      </Button>
    </div>
  )
}

