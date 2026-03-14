'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PedidosTable } from '@/components/tables/PedidosTable'
import { PedidosAgrupados } from '@/components/tables/PedidosAgrupados'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerPedidosAction } from '@/actions/ventas.actions'
import { asignarPedidoARutaDesdeAlmacen, generarRutaDiariaAutomaticaAction } from '@/actions/reparto.actions'
import { PedidosFiltros } from './pedidos-filtros'
import { GenerarRutaModal } from '@/components/reparto/GenerarRutaModal'
import { Button } from '@/components/ui/button'
import { Truck, Loader2, LayoutList, Table as TableIcon } from 'lucide-react'
import type { Pedido } from '@/types/domain.types'
import { getTodayArgentina } from '@/lib/utils'

export function PedidosTableWrapper() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useNotificationStore()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [showModalManual, setShowModalManual] = useState(false)
  const [isGenerandoAutomatica, setIsGenerandoAutomatica] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('grouped')
  const isMountedRef = useRef(true)

  // Obtener filtros de la URL
  const fecha = searchParams.get('fecha') || getTodayArgentina()
  const turno = searchParams.get('turno')

  // Cargar pedidos desde la base de datos
  const loadPedidos = useCallback(async () => {
    if (!isMountedRef.current) return

    try {
      setLoading(true)
      const filtros: any = {
        fecha_entrega: fecha,
      }
      if (turno && turno !== 'all') {
        filtros.turno = turno
      }
      const result = await obtenerPedidosAction(filtros)
      if (!isMountedRef.current) return

      if (result.success && result.data) {
        setPedidos(result.data as Pedido[])
      } else {
        showToast('error', result.error || 'Error al cargar pedidos')
        setPedidos([])
      }
    } catch (error) {
      if (!isMountedRef.current) return
      console.error('Error cargando pedidos:', error)
      showToast('error', 'Error al cargar pedidos')
      setPedidos([])
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, turno])

  useEffect(() => {
    isMountedRef.current = true
    loadPedidos()

    return () => {
      isMountedRef.current = false
    }
  }, [loadPedidos])

  const handleView = (pedido: Pedido) => {
    router.push(`/almacen/pedidos/${pedido.id}`)
  }

  const handleEdit = (pedido: Pedido) => {
    router.push(`/almacen/pedidos/${pedido.id}/editar`)
  }

  const handleDelete = async (pedido: Pedido) => {
    if (confirm(`¿Estás seguro de que quieres cancelar el pedido ${pedido.numero_pedido}?`)) {
      try {
        const { actualizarEstadoPedidoAction } = await import('@/actions/ventas.actions')
        const result = await actualizarEstadoPedidoAction(pedido.id, 'cancelado')
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
      const { actualizarEstadoPedidoAction } = await import('@/actions/ventas.actions')
      const result = await actualizarEstadoPedidoAction(pedido.id, 'entregado')
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

  const handleRoute = async (pedido: Pedido) => {
    try {
      const result = await asignarPedidoARutaDesdeAlmacen(pedido.id)
      if (result.success) {
        showToast(
          'success',
          result.message || `Pedido ${pedido.numero_pedido} asignado a ruta`
        )
        await loadPedidos()
        router.refresh()
      } else {
        showToast(
          'error',
          result.error || 'Error al asignar pedido a ruta. Verifica que exista un plan de ruta para la zona/turno.'
        )
      }
    } catch (error: any) {
      console.error('Error al asignar pedido a ruta:', error)
      showToast('error', error.message || 'Error al asignar pedido a ruta')
    }
  }

  const handleGenerarRutaAutomatica = async () => {
    if (!fecha || !turno || turno === 'all') {
      showToast('error', 'Debes seleccionar una fecha y un turno específico')
      return
    }

    setIsGenerandoAutomatica(true)

    try {
      const result = await generarRutaDiariaAutomaticaAction(fecha, turno)

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <PedidosFiltros />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center border rounded-md p-1 bg-muted/20 mr-2">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 w-8 p-0"
              title="Vista de tabla"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grouped')}
              className="h-8 w-8 p-0"
              title="Vista agrupada por cliente"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => setShowModalManual(true)}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            <Truck className="mr-2 h-4 w-4" />
            Generar Ruta
          </Button>
        </div>
      </div>

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
          </div>
        </div>
      )}

      {viewMode === 'grouped' ? (
        <PedidosAgrupados
          data={pedidos}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeliver={handleDeliver}
          onPrint={handlePrint}
        />
      ) : (
        <PedidosTable
          data={pedidos}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeliver={handleDeliver}
          onPrint={handlePrint}
          onRoute={handleRoute}
        />
      )}

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
