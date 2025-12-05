'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Route, Loader2 } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { asignarPedidoARutaDesdeAlmacen } from '@/actions/reparto.actions'

interface PasarARutaButtonProps {
  pedidoId: string
  numeroPedido: string
  estado: string
  onSuccess?: () => void
}

export function PasarARutaButton({ pedidoId, numeroPedido, estado, onSuccess }: PasarARutaButtonProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)

  // Solo mostrar si el pedido está en estado 'preparando'
  if (estado !== 'preparando') {
    return null
  }

  const handlePasarARuta = async () => {
    try {
      setLoading(true)
      const result = await asignarPedidoARutaDesdeAlmacen(pedidoId)
      
      if (result.success) {
        showToast(
          'success',
          result.message || `Pedido ${numeroPedido} asignado a ruta exitosamente`
        )
        
        if (onSuccess) {
          onSuccess()
        } else {
          router.refresh()
        }
      } else {
        showToast(
          'error',
          result.error || 'Error al asignar pedido a ruta. Verifica que exista un plan de ruta para la zona/turno.'
        )
      }
    } catch (error: any) {
      console.error('Error al asignar pedido a ruta:', error)
      showToast('error', error.message || 'Error al asignar pedido a ruta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handlePasarARuta}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Asignando...
        </>
      ) : (
        <>
          <Route className="mr-2 h-4 w-4" />
          Pasar a Ruta
        </>
      )}
    </Button>
  )
}

