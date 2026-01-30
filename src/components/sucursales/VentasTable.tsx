'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, DollarSign, User, Clock, Printer, RotateCcw, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
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
    if (!metodosPago) return <Badge variant="secondary">Sin método</Badge>

    if (Array.isArray(metodosPago) && metodosPago.length > 0) {
      const metodo = metodosPago[0].metodoPago || metodosPago[0].metodo_pago || metodosPago[0]
      const configs: Record<string, { color: string, label: string }> = {
        efectivo: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Efectivo" },
        transferencia: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Transf." },
        tarjeta_debito: { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Débito" },
        tarjeta_credito: { color: "bg-indigo-100 text-indigo-700 border-indigo-200", label: "Crédito" },
        cuenta_corriente: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Cta. Cte." },
      }

      const config = configs[metodo] || { color: "bg-slate-100 text-slate-700 border-slate-200", label: metodo }

      return (
        <Badge variant="outline" className={cn("px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider shadow-sm", config.color)}>
          {config.label}
          {metodosPago.length > 1 && ` +${metodosPago.length - 1}`}
        </Badge>
      )
    }

    return <Badge variant="secondary">Otros</Badge>
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
          <Card key={venta.id} className="hover:shadow-xl hover:scale-[1.01] transition-all border-slate-100 rounded-2xl overflow-hidden group">
            <CardContent className="p-0">
              <div className="flex items-stretch min-h-[80px]">
                {/* Indicador lateral de color según método */}
                <div className={cn(
                  "w-2",
                  venta.metodos_pago?.[0]?.metodo_pago === 'efectivo' ? "bg-emerald-500" : "bg-blue-500"
                )} />

                <div className="flex-1 flex items-center justify-between p-4 gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                      <ShoppingCart className="w-6 h-6 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-800 tracking-tight truncate">
                          {venta.numero_pedido || venta.numeroPedido ? (
                            (venta.numero_pedido || venta.numeroPedido)?.startsWith('VTA-SUC') || (venta.numero_pedido || venta.numeroPedido)?.length === 11
                              ? `Ticket ${venta.numero_pedido || venta.numeroPedido}`
                              : `Pedido #${venta.numero_pedido || venta.numeroPedido}`
                          ) : `Ticket ${venta.id.slice(-8)}`}
                        </h4>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">
                          <CheckCircle className="w-3 h-3" />
                          Pagado
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">
                            {venta.clientes ? venta.clientes.nombre : 'Consumidor Final'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(venta.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      {getMetodoPagoBadge(venta.metodos_pago)}
                    </div>

                    <div className="text-right min-w-[100px]">
                      <div className="text-xl font-black text-slate-900 leading-none">
                        ${venta.total?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        Total Final
                      </div>
                    </div>

                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-slate-100 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
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
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 bg-slate-100 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        onClick={async () => {
                          const result = await obtenerProductosPedidoAction(venta.id)
                          if (result.success && result.data) {
                            setProductosPedido(result.data)
                            setDevolucionAbierta(venta.id)
                          } else {
                            toast.error('Error al cargar productos del pedido')
                          }
                        }}
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
