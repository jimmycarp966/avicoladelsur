'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Printer, Package, Scale, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { OrdenProduccion, OrdenProduccionEntrada, OrdenProduccionSalida } from '@/types/domain.types'
import type { ProgresoProduccion } from '@/actions/produccion.actions'

interface PrintDetalleProduccionProps {
    orden: OrdenProduccion
    salidas: OrdenProduccionSalida[]
    entradas: OrdenProduccionEntrada[]
    progreso?: ProgresoProduccion[]
    totales: {
        pesoConsumido: number
        pesoGenerado: number
        mermaTotalKg: number
        mermaTotalPct: number
        desperdicioSolidoKg: number
    }
}

export default function PrintDetalleProduccion({
    orden,
    salidas,
    entradas,
    progreso,
    totales
}: PrintDetalleProduccionProps) {
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = () => {
        const printContent = printRef.current
        if (!printContent) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Detalle Producción - ${orden.numero_orden || orden.id.slice(0, 8)}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        padding: 20px;
                        color: #1a1a1a;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .header h1 { font-size: 24px; margin-bottom: 5px; }
                    .header p { color: #666; font-size: 14px; }
                    .section { margin-bottom: 20px; }
                    .section-title {
                        font-size: 16px;
                        font-weight: bold;
                        color: #333;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                    }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { 
                        padding: 8px 10px;
                        text-align: left;
                        border: 1px solid #ddd;
                    }
                    th { background: #f5f5f5; font-weight: 600; }
                    .totals { 
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                        margin-top: 20px;
                    }
                    .total-card {
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        padding: 15px;
                        text-align: center;
                    }
                    .total-card h3 { font-size: 12px; color: #666; margin-bottom: 5px; }
                    .total-card .value { font-size: 24px; font-weight: bold; }
                    .warning { color: #dc2626; }
                    .success { color: #16a34a; }
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 1px solid #ddd;
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        color: #666;
                    }
                    .progress-bar {
                        background: #e5e7eb;
                        border-radius: 4px;
                        height: 8px;
                        overflow: hidden;
                    }
                    .progress-fill {
                        height: 100%;
                        background: #22c55e;
                    }
                    @media print {
                        body { padding: 10px; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `)

        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 250)
    }

    // Agrupar entradas por destino
    const entradasPorDestino = entradas.reduce((acc, entrada) => {
        const destino = (entrada as any).destino?.nombre || 'Sin destino'
        if (!acc[destino]) acc[destino] = []
        acc[destino].push(entrada)
        return acc
    }, {} as Record<string, OrdenProduccionEntrada[]>)

    return (
        <div className="space-y-4">
            {/* Botón de impresión */}
            <Button onClick={handlePrint} className="w-full">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Detalle de Producción
            </Button>

            {/* Contenido imprimible */}
            <div ref={printRef} className="bg-white p-6 rounded-lg border">
                {/* Header */}
                <div className="header text-center border-b-2 border-gray-800 pb-4 mb-6">
                    <h1 className="text-2xl font-bold mb-1">AVÍCOLA DEL SUR</h1>
                    <p className="text-gray-600">Orden de Producción: {orden.numero_orden || orden.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm text-gray-500">Fecha: {formatDate(orden.fecha_produccion || orden.created_at)}</p>
                </div>

                {/* Info General */}
                <div className="section grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <span className="text-sm text-gray-500">Estado:</span>
                        <div>
                            <Badge variant={orden.estado === 'completada' ? 'default' : 'secondary'}>
                                {orden.estado?.toUpperCase()}
                            </Badge>
                        </div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-500">Operario:</span>
                        <div className="font-medium">
                            {(orden as any).operario?.nombre || 'N/A'} {(orden as any).operario?.apellido || ''}
                        </div>
                    </div>
                </div>

                {/* Productos Consumidos (Salidas) */}
                <div className="section mb-6">
                    <div className="section-title flex items-center gap-2 mb-3">
                        <Package className="h-5 w-5 text-orange-500" />
                        <span>Productos Consumidos (Stock Saliente)</span>
                    </div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2 text-left">Producto</th>
                                <th className="border p-2 text-center">Cantidad</th>
                                <th className="border p-2 text-center">Peso (kg)</th>
                                <th className="border p-2 text-left">Lote</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salidas.map((salida, idx) => (
                                <tr key={idx}>
                                    <td className="border p-2">
                                        {(salida as any).producto?.nombre || 'N/A'}
                                    </td>
                                    <td className="border p-2 text-center">{salida.cantidad}</td>
                                    <td className="border p-2 text-center">{(salida.peso_kg || 0).toFixed(2)}</td>
                                    <td className="border p-2">{(salida as any).lote?.numero_lote || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Productos Generados (Entradas) */}
                <div className="section mb-6">
                    <div className="section-title flex items-center gap-2 mb-3">
                        <Scale className="h-5 w-5 text-green-500" />
                        <span>Productos Generados (Stock Entrante)</span>
                    </div>
                    {Object.entries(entradasPorDestino).map(([destino, items]) => (
                        <div key={destino} className="mb-4">
                            <h4 className="font-medium text-sm mb-2 text-gray-700">{destino}</h4>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border p-2 text-left">Producto</th>
                                        <th className="border p-2 text-center">Peso (kg)</th>
                                        <th className="border p-2 text-center">Tipo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((entrada, idx) => (
                                        <tr key={idx}>
                                            <td className="border p-2">
                                                {(entrada as any).producto?.nombre || 'N/A'}
                                            </td>
                                            <td className="border p-2 text-center">{(entrada.peso_kg || 0).toFixed(2)}</td>
                                            <td className="border p-2 text-center">
                                                {entrada.es_desperdicio_solido ? (
                                                    <Badge variant="outline" className="text-orange-600">Desperdicio</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-green-600">Producto</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* Progreso de producción */}
                {progreso && progreso.length > 0 && (
                    <div className="section mb-6">
                        <div className="section-title flex items-center gap-2 mb-3">
                            <span>Progreso de Producción</span>
                        </div>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">Producto</th>
                                    <th className="border p-2 text-center">Objetivo</th>
                                    <th className="border p-2 text-center">Producido</th>
                                    <th className="border p-2 text-center">Progreso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {progreso.map((prog, idx) => (
                                    <tr key={idx}>
                                        <td className="border p-2">{prog.producto_nombre}</td>
                                        <td className="border p-2 text-center">{prog.cantidad_objetivo}</td>
                                        <td className="border p-2 text-center">{prog.cantidad_producida}</td>
                                        <td className="border p-2">
                                            <div className="flex items-center gap-2">
                                                <div className="progress-bar flex-1 bg-gray-200 rounded h-2 overflow-hidden">
                                                    <div
                                                        className="progress-fill bg-green-500 h-full"
                                                        style={{ width: `${Math.min(prog.porcentaje_completado, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm">{prog.porcentaje_completado.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Totales */}
                <div className="totals grid grid-cols-3 gap-4 mt-6">
                    <div className="total-card border rounded-lg p-4 text-center">
                        <h3 className="text-xs text-gray-500 mb-1">Peso Consumido</h3>
                        <div className="value text-xl font-bold">{totales.pesoConsumido.toFixed(2)} kg</div>
                    </div>
                    <div className="total-card border rounded-lg p-4 text-center">
                        <h3 className="text-xs text-gray-500 mb-1">Peso Generado</h3>
                        <div className="value text-xl font-bold text-green-600">{totales.pesoGenerado.toFixed(2)} kg</div>
                    </div>
                    <div className="total-card border rounded-lg p-4 text-center">
                        <h3 className="text-xs text-gray-500 mb-1">Merma Total</h3>
                        <div className={`value text-xl font-bold ${totales.mermaTotalPct > 20 ? 'text-red-600' : 'text-amber-600'}`}>
                            {totales.mermaTotalKg.toFixed(2)} kg ({totales.mermaTotalPct.toFixed(1)}%)
                        </div>
                    </div>
                </div>

                {/* Desperdicio sólido */}
                {totales.desperdicioSolidoKg > 0 && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <span className="text-sm">
                            Desperdicio sólido registrado: <strong>{totales.desperdicioSolidoKg.toFixed(2)} kg</strong>
                        </span>
                    </div>
                )}

                {/* Footer */}
                <div className="footer flex justify-between mt-8 pt-4 border-t text-sm text-gray-500">
                    <div>Impreso: {new Date().toLocaleString('es-AR')}</div>
                    <div>Avícola del Sur - Sistema ERP</div>
                </div>
            </div>
        </div>
    )
}
