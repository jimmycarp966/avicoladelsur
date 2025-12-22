'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Printer, FileText } from 'lucide-react'
import Link from 'next/link'

interface FacturaPageProps {
    params: Promise<{ id: string }>
}

interface FacturaData {
    id: string
    numero_factura: string
    fecha_emision: string
    total: number
    subtotal: number
    descuento: number
    estado: string
    tipo: string
    cliente: {
        nombre: string
        direccion?: string
        telefono?: string
    }
    items: Array<{
        id: string
        cantidad: number
        precio_unitario: number
        subtotal: number
        producto: {
            nombre: string
            codigo?: string
        }
    }>
}

export default function FacturaPage({ params }: FacturaPageProps) {
    const [factura, setFactura] = useState<FacturaData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [facturaId, setFacturaId] = useState<string | null>(null)

    // Resolver params
    useEffect(() => {
        params.then(p => setFacturaId(p.id))
    }, [params])

    useEffect(() => {
        if (!facturaId) return

        async function fetchFactura() {
            const supabase = createClient()

            // Obtener factura con items y cliente
            const { data, error: fetchError } = await supabase
                .from('facturas')
                .select(`
          id, numero_factura, fecha_emision, total, subtotal, descuento, estado, tipo,
          cliente:clientes(nombre, direccion, telefono),
          items:factura_items(
            id, cantidad, precio_unitario, subtotal,
            producto:productos(nombre, codigo)
          )
        `)
                .eq('id', facturaId)
                .single()

            if (fetchError) {
                console.error('Error fetching factura:', fetchError)
                setError('Factura no encontrada')
                setLoading(false)
                return
            }

            setFactura(data as any)
            setLoading(false)
        }

        fetchFactura()
    }, [facturaId])

    const handlePrint = () => {
        window.print()
    }

    if (loading) {
        return (
            <div className="container mx-auto py-8 flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (error || !factura) {
        return (
            <div className="container mx-auto py-8">
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Factura no encontrada</h2>
                        <p className="text-muted-foreground mb-4">{error || 'No se pudo cargar la factura'}</p>
                        <Button variant="outline" onClick={() => window.history.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const fechaEmision = new Date(factura.fecha_emision).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    return (
        <div className="container mx-auto py-8 max-w-3xl">
            {/* Header con botones (oculto al imprimir) */}
            <div className="flex items-center justify-between mb-6 print:hidden">
                <Button variant="outline" onClick={() => window.history.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir
                </Button>
            </div>

            {/* Factura */}
            <Card className="print:shadow-none print:border-0">
                <CardHeader className="border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">
                                Factura {factura.numero_factura}
                            </CardTitle>
                            <p className="text-muted-foreground mt-1">
                                {fechaEmision}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${factura.estado === 'emitida'
                                    ? 'bg-green-100 text-green-800'
                                    : factura.estado === 'cancelada'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                                Tipo: {factura.tipo}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="py-6">
                    {/* Datos del cliente */}
                    <div className="mb-6 pb-6 border-b">
                        <h3 className="font-semibold text-sm text-muted-foreground mb-2">CLIENTE</h3>
                        <p className="font-medium text-lg">{factura.cliente?.nombre || 'Sin nombre'}</p>
                        {factura.cliente?.direccion && (
                            <p className="text-muted-foreground">{factura.cliente.direccion}</p>
                        )}
                        {factura.cliente?.telefono && (
                            <p className="text-muted-foreground">{factura.cliente.telefono}</p>
                        )}
                    </div>

                    {/* Items */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-sm text-muted-foreground mb-3">DETALLE</h3>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b text-sm text-muted-foreground">
                                    <th className="text-left py-2">Producto</th>
                                    <th className="text-right py-2">Cant.</th>
                                    <th className="text-right py-2">P. Unit.</th>
                                    <th className="text-right py-2">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {factura.items?.map((item) => (
                                    <tr key={item.id} className="border-b last:border-0">
                                        <td className="py-3">
                                            <p className="font-medium">{item.producto?.nombre || 'Producto'}</p>
                                            {item.producto?.codigo && (
                                                <p className="text-xs text-muted-foreground">Cód: {item.producto.codigo}</p>
                                            )}
                                        </td>
                                        <td className="text-right py-3">{item.cantidad}</td>
                                        <td className="text-right py-3">${item.precio_unitario?.toFixed(2)}</td>
                                        <td className="text-right py-3 font-medium">${item.subtotal?.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totales */}
                    <div className="border-t pt-4">
                        <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal:</span>
                                    <span>${factura.subtotal?.toFixed(2)}</span>
                                </div>
                                {factura.descuento > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span>Descuento:</span>
                                        <span>-${factura.descuento?.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold border-t pt-2">
                                    <span>TOTAL:</span>
                                    <span>${factura.total?.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer para impresión */}
            <div className="hidden print:block mt-8 text-center text-sm text-muted-foreground">
                <p>Avícola del Sur - Documento interno</p>
                <p>Generado el {new Date().toLocaleDateString('es-AR')}</p>
            </div>
        </div>
    )
}
