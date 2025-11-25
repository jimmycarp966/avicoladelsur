'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Truck, Package, MapPin, Clock } from 'lucide-react'
import { generarRutaDiariaManual } from '@/actions/reparto.actions'
import { useNotificationStore } from '@/store/notificationStore'
import type { Pedido } from '@/types/domain.types'

interface GenerarRutaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pedidos: Pedido[]
  fecha: string
  turno: string
  onSuccess?: () => void
}

export function GenerarRutaModal({
  open,
  onOpenChange,
  pedidos,
  fecha,
  turno,
  onSuccess,
}: GenerarRutaModalProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<Set<string>>(
    new Set()
  )
  const [isLoading, setIsLoading] = useState(false)

  // Agrupar pedidos por zona
  const pedidosPorZona = pedidos.reduce((acc, pedido) => {
    const zonaId = pedido.zona_id || 'sin-zona'
    if (!acc[zonaId]) {
      acc[zonaId] = []
    }
    acc[zonaId].push(pedido)
    return acc
  }, {} as Record<string, Pedido[]>)

  const zonas = Object.keys(pedidosPorZona)

  // Calcular resumen
  const totalSeleccionados = pedidosSeleccionados.size
  const pesoEstimado = pedidos
    .filter((p) => pedidosSeleccionados.has(p.id))
    .reduce((sum, p) => sum + (p.total || 0), 0)

  const handleTogglePedido = (pedidoId: string) => {
    const nuevo = new Set(pedidosSeleccionados)
    if (nuevo.has(pedidoId)) {
      nuevo.delete(pedidoId)
    } else {
      nuevo.add(pedidoId)
    }
    setPedidosSeleccionados(nuevo)
  }

  const handleToggleZona = (zonaId: string) => {
    const pedidosZona = pedidosPorZona[zonaId] || []
    const todosSeleccionados = pedidosZona.every((p) =>
      pedidosSeleccionados.has(p.id)
    )

    const nuevo = new Set(pedidosSeleccionados)
    if (todosSeleccionados) {
      pedidosZona.forEach((p) => nuevo.delete(p.id))
    } else {
      pedidosZona.forEach((p) => nuevo.add(p.id))
    }
    setPedidosSeleccionados(nuevo)
  }

  const handleGenerarRuta = async () => {
    if (pedidosSeleccionados.size === 0) {
      showToast('error', 'Debes seleccionar al menos un pedido')
      return
    }

    // Validar que todos los pedidos seleccionados sean de la misma zona
    const pedidosSel = pedidos.filter((p) => pedidosSeleccionados.has(p.id))
    const zonasUnicas = new Set(
      pedidosSel.map((p) => p.zona_id || 'sin-zona')
    )

    if (zonasUnicas.size > 1) {
      showToast(
        'error',
        'Todos los pedidos seleccionados deben ser de la misma zona'
      )
      return
    }

    const zonaId = pedidosSel[0].zona_id
    if (!zonaId) {
      showToast('error', 'Los pedidos seleccionados deben tener zona asignada')
      return
    }

    setIsLoading(true)

    try {
      const result = await generarRutaDiariaManual(
        Array.from(pedidosSeleccionados),
        fecha,
        zonaId,
        turno
      )

      if (result.success) {
        showToast('success', result.message || 'Ruta creada exitosamente')
        setPedidosSeleccionados(new Set())
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        } else {
          router.refresh()
        }
      } else {
        showToast('error', result.error || 'Error al generar ruta')
      }
    } catch (error: any) {
      console.error('Error generando ruta:', error)
      showToast('error', 'Error al generar ruta: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      setPedidosSeleccionados(new Set())
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Generar Ruta Diaria Manual
          </DialogTitle>
          <DialogDescription>
            Selecciona los pedidos que deseas incluir en la ruta. Todos deben
            ser del mismo turno y zona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen */}
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Fecha</Label>
                <p className="font-semibold">{new Date(fecha).toLocaleDateString('es-AR')}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Turno</Label>
                <p className="font-semibold capitalize">{turno}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Pedidos Seleccionados
                </Label>
                <p className="font-semibold">{totalSeleccionados} de {pedidos.length}</p>
              </div>
            </div>
          </div>

          {/* Lista de pedidos por zona */}
          <div className="space-y-4">
            {zonas.map((zonaId) => {
              const pedidosZona = pedidosPorZona[zonaId] || []
              const todosSeleccionados = pedidosZona.every((p) =>
                pedidosSeleccionados.has(p.id)
              )
              const algunosSeleccionados =
                pedidosZona.some((p) => pedidosSeleccionados.has(p.id)) &&
                !todosSeleccionados

              return (
                <div
                  key={zonaId}
                  className="rounded-lg border border-primary/20 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={todosSeleccionados}
                        ref={(ref) => {
                          if (ref) {
                            const checkbox = ref.querySelector('input[type="checkbox"]') as HTMLInputElement
                            if (checkbox) {
                              checkbox.indeterminate = algunosSeleccionados
                            }
                          }
                        }}
                        onCheckedChange={() => handleToggleZona(zonaId)}
                      />
                      <Label className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {zonaId === 'sin-zona'
                          ? 'Sin zona asignada'
                          : `Zona ${zonaId.slice(0, 8)}`}
                      </Label>
                      <Badge variant="outline">
                        {pedidosZona.length} pedido(s)
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 pl-6">
                    {pedidosZona.map((pedido) => (
                      <div
                        key={pedido.id}
                        className="flex items-center justify-between rounded-md border p-3 hover:bg-primary/5"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={pedidosSeleccionados.has(pedido.id)}
                            onCheckedChange={() =>
                              handleTogglePedido(pedido.id)
                            }
                          />
                          <div>
                            <p className="font-medium">
                              {pedido.numero_pedido}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Cliente: {(pedido as any).cliente?.nombre || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">
                            ${(pedido.total || 0).toFixed(2)}
                          </Badge>
                          <Badge
                            variant={
                              pedido.estado === 'preparando'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {pedido.estado}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {pedidos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay pedidos disponibles para este turno</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGenerarRuta}
            disabled={isLoading || totalSeleccionados === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Truck className="mr-2 h-4 w-4" />
                Generar Ruta ({totalSeleccionados})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

