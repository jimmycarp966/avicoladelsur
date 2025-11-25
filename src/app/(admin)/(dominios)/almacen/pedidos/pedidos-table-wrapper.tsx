'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PedidosTable } from '@/components/tables/PedidosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerPedidos } from '@/actions/ventas.actions'
import { generarRutaDiariaAutomatica } from '@/actions/reparto.actions'
import { PedidosFiltros } from './pedidos-filtros'
import { GenerarRutaModal } from '@/components/reparto/GenerarRutaModal'
import { Button } from '@/components/ui/button'
import { Truck, Loader2 } from 'lucide-react'
import type { Pedido } from '@/types/domain.types'

export function PedidosTableWrapper() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useNotificationStore()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [showModalManual, setShowModalManual] = useState(false)
  const [isGenerandoAutomatica, setIsGenerandoAutomatica] = useState(false)

  // Obtener filtros de la URL
  const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0]
  const turno = searchParams.get('turno')

  // Cargar pedidos desde la base de datos
  useEffect(() => {
    loadPedidos()
  }, [fecha, turno])

  const loadPedidos = async () => {
    try {
      setLoading(true)
      const filtros: any = {
        fecha_entrega: fecha,
      }
      if (turno && turno !== 'all') {
        filtros.turno = turno
      }
      const result = await obtenerPedidos(filtros)
      if (result.success && result.data) {
        setPedidos(result.data as Pedido[])
      } else {
        showToast('error', result.error || 'Error al cargar pedidos')
        setPedidos([])
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
      showToast('error', 'Error al cargar pedidos')
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }

  const handleView = (pedido: Pedido) => {
    router.push(`/almacen/pedidos/${pedido.id}`)
  }

  const handleEdit = (pedido: Pedido) => {
    router.push(`/almacen/pedidos/${pedido.id}/editar`)
  }

  const handleDelete = async (pedido: Pedido) => {
    if (confirm(`¿Estás seguro de que quieres cancelar el pedido ${pedido.numero_pedido}?`)) {
      try {
        const { actualizarEstadoPedido } = await import('@/actions/ventas.actions')
        const result = await actualizarEstadoPedido(pedido.id, 'cancelado')
        if (result.success) {
          await loadPedidos()
          showToast('success', result.message || `Pedido ${pedido.numero_pedido} cancelado exitosamente`)
        } else {
          showToast('error', result.error || 'Error al cancelar pedido')
        }
      } catch (error: any) {
        console.error('Error al cancelar pedido:', error)
        showToast('error', error.message || 'Error al cancelar pedido')
      }
    }
  }

  const handleDeliver = async (pedido: Pedido) => {
    try {
      const { actualizarEstadoPedido } = await import('@/actions/ventas.actions')
      const result = await actualizarEstadoPedido(pedido.id, 'entregado')
      if (result.success) {
        await loadPedidos()
        showToast('success', result.message || `Pedido ${pedido.numero_pedido} marcado como entregado`)
      } else {
        showToast('error', result.error || 'Error al marcar pedido como entregado')
      }
    } catch (error: any) {
      console.error('Error al marcar pedido como entregado:', error)
      showToast('error', error.message || 'Error al marcar pedido como entregado')
    }
  }

  const handlePrint = (pedido: Pedido) => {
    // Generar y descargar PDF
    const url = `/api/pedidos/${pedido.id}/pdf`
    const link = document.createElement('a')
    link.href = url
    link.download = `pedido-${pedido.numero_pedido}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('success', `Generando PDF del pedido ${pedido.numero_pedido}`)
  }

  const handleGenerarRutaAutomatica = async () => {
    if (!fecha || !turno || turno === 'all') {
      showToast('error', 'Debes seleccionar una fecha y un turno específico')
      return
    }

    setIsGenerandoAutomatica(true)

    try {
      const result = await generarRutaDiariaAutomatica(fecha, turno)

      if (result.success) {
        showToast('success', result.message || 'Rutas generadas exitosamente')
        await loadPedidos()
        router.refresh()
      } else {
        showToast('error', result.error || 'Error al generar rutas')
      }
    } catch (error: any) {
      console.error('Error generando ruta automática:', error)
      showToast('error', 'Error al generar ruta: ' + error.message)
    } finally {
      setIsGenerandoAutomatica(false)
    }
  }

  const pedidosPreparando = pedidos.filter((p) => p.estado === 'preparando')
  const puedeGenerarRuta = fecha && turno && turno !== 'all' && pedidosPreparando.length > 0

  if (loading) {
    return <div className="text-center py-8">Cargando pedidos...</div>
  }

  return (
    <div className="space-y-4">
      <PedidosFiltros />
      
      {/* Botones de acción para generar rutas */}
      {puedeGenerarRuta && (
        <div className="flex items-center gap-2 p-4 rounded-lg border bg-primary/5">
          <div className="flex-1">
            <p className="font-semibold">Generar Ruta Diaria</p>
            <p className="text-sm text-muted-foreground">
              {pedidosPreparando.length} pedido(s) en estado "preparando" para el turno {turno}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleGenerarRutaAutomatica}
              disabled={isGenerandoAutomatica}
              className="bg-green-600 hover:bg-green-700"
            >
              {isGenerandoAutomatica ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Generar Automática
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowModalManual(true)}
              variant="outline"
            >
              <Truck className="mr-2 h-4 w-4" />
              Selección Manual
            </Button>
          </div>
        </div>
      )}

      <PedidosTable
        data={pedidos}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDeliver={handleDeliver}
        onPrint={handlePrint}
      />

      <GenerarRutaModal
        open={showModalManual}
        onOpenChange={setShowModalManual}
        pedidos={pedidosPreparando}
        fecha={fecha}
        turno={turno || 'mañana'}
        onSuccess={loadPedidos}
      />
    </div>
  )
}
