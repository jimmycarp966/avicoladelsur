'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, DollarSign, User, Clock, Printer, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { generarFacturaAction, generarTicketTermicoAction, obtenerProductosPedidoAction } from '@/actions/pos-sucursal.actions'
import { DevolucionVentaDialog } from './DevolucionVentaDialog'

interface Venta {
  id: string
  numero_pedido?: string
  numeroPedido?: string
  total: number
  estado: string
  metodos_pago: any // JSONB con métodos de pago
  created_at: string
  clientes: {
    nombre: string
  } | null
}

interface VentasTableProps {
  ventas: Venta[]
}

export function VentasTable({ ventas }: VentasTableProps) {
  const [imprimiendo, setImprimiendo] = useState<string | null>(null)
  const [devolucionAbierta, setDevolucionAbierta] = useState<string | null>(null)
  const [productosPedido, setProductosPedido] = useState<Array<{
    productoId: string
    productoNombre: string
    productoCodigo: string
    cantidad: number
    precioUnitario: number
    subtotal: number
  }>>([])

  const handleImprimir = async (pedidoId: string, tipo: 'ticket' | 'factura_a' | 'factura_b' = 'ticket') => {
    setImprimiendo(pedidoId)
    try {
      let result
      if (tipo === 'ticket') {
        result = await generarTicketTermicoAction(pedidoId)
      } else {
        result = await generarFacturaAction(pedidoId, tipo === 'factura_a' ? 'A' : 'B')
      }

      if (result.success && result.data) {
        // Crear blob y descargar
        const pdfArrayBuffer = result.data instanceof ArrayBuffer
          ? result.data
          : new Uint8Array(result.data as ArrayLike<number>).buffer
        const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${tipo}-${pedidoId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success(`${tipo === 'ticket' ? 'Ticket' : 'Factura'} generado correctamente`)
      } else {
        toast.error(result.error || 'Error al generar comprobante')
      }
    } catch (error) {
      toast.error('Error al generar comprobante')
      console.error(error)
    } finally {
      setImprimiendo(null)
    }
  }

  const getMetodoPagoBadge = (metodosPago: any) => {
    // metodos_pago es un JSONB, puede ser un array o un objeto
    if (!metodosPago) {
      return <Badge variant="secondary">Sin método</Badge>
    }
    
    // Si es un array, mostrar el primero
    if (Array.isArray(metodosPago) && metodosPago.length > 0) {
      const metodo = metodosPago[0].metodoPago || metodosPago[0].metodo_pago || metodosPago[0]
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        efectivo: "default",
        transferencia: "secondary",
        tarjeta: "outline",
        cuenta_corriente: "destructive",
      }

      const labels: Record<string, string> = {
        efectivo: "Efectivo",
        transferencia: "Transferencia",
        tarjeta: "Tarjeta",
        mercado_pago: "Mercado Pago",
        cuenta_corriente: "Cta. Cte.",
      }

      return (
        <Badge variant={variants[metodo] || "secondary"}>
          {labels[metodo] || metodo}
          {metodosPago.length > 1 && ` +${metodosPago.length - 1}`}
        </Badge>
      )
    }
    
    // Si es un objeto o string, intentar parsearlo
    const metodoStr = typeof metodosPago === 'string' ? metodosPago : JSON.stringify(metodosPago)
    return <Badge variant="secondary">{metodoStr}</Badge>
  }

  if (ventas.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay ventas del día</h3>
        <p className="text-muted-foreground">
          Aún no se han registrado ventas completadas hoy
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {ventas.map((venta) => (
          <Card key={venta.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <ShoppingCart className="w-6 h-6 text-green-600" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">
                        {venta.numero_pedido || venta.numeroPedido || `Pedido #${venta.id.slice(-8)}`}
                      </h4>
                      <Badge variant="default" className="text-xs">
                        Completado
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {venta.clientes
                          ? venta.clientes.nombre
                          : 'Cliente desconocido'
                        }
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(venta.created_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>

                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        ${venta.total?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getMetodoPagoBadge(venta.metodos_pago)}
                  <div className="flex flex-col gap-2">
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${venta.total?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total pagado
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImprimir(venta.id, 'ticket')}
                        disabled={imprimiendo === venta.id}
                      >
                        {imprimiendo === venta.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Printer className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          // Obtener productos del pedido antes de abrir diálogo
                          const result = await obtenerProductosPedidoAction(venta.id)
                          if (result.success && result.data) {
                            setProductosPedido(result.data)
                            setDevolucionAbierta(venta.id)
                          } else {
                            toast.error('Error al cargar productos del pedido')
                          }
                        }}
                        title="Devolver venta"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>
      ))}

        {/* Resumen del día */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <strong>{ventas.length}</strong> ventas completadas hoy
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  ${ventas.reduce((sum, venta) => sum + (venta.total || 0), 0).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total del día
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de devolución */}
      {devolucionAbierta && (
        <DevolucionVentaDialog
          pedidoId={devolucionAbierta}
          open={!!devolucionAbierta}
          onOpenChange={(open) => !open && setDevolucionAbierta(null)}
          onDevolucionCompletada={() => {
            setDevolucionAbierta(null)
            setProductosPedido([])
            window.location.reload()
          }}
          productosPedido={productosPedido}
        />
      )}
    </>
  )
}
