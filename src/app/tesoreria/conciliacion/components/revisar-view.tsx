'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Search, Eye } from 'lucide-react'
import { crearConciliacionManualAction, descartarMovimientoAction } from '@/actions/conciliacion.actions'
import { toast } from 'sonner'
import { Card, CardTitle, CardHeader, CardContent } from '@/components/ui/card'

interface RevisarViewProps {
    movimientos: any[]
}

export function RevisarView({ movimientos }: RevisarViewProps) {
    const router = useRouter()
    const [procesando, setProcesando] = useState<string | null>(null)

    const handleConciliar = async (movId: string, pagoId: string) => {
        setProcesando(movId)
        try {
            const res = await crearConciliacionManualAction({
                movimientoBancarioId: movId,
                pagoEsperadoId: pagoId,
                notas: 'Conciliación masiva'
            })
            if (res.success) {
                toast.success('Conciliado')
                router.refresh()
            } else {
                toast.error(res.error)
            }
        } finally {
            setProcesando(null)
        }
    }

    const handleDescartar = async (movId: string) => {
        if (!confirm('¿Descartar este movimiento?')) return
        setProcesando(movId)
        try {
            const res = await descartarMovimientoAction(movId)
            if (res.success) {
                toast.success('Descartado')
                router.refresh()
            } else {
                toast.error(res.error)
            }
        } finally {
            setProcesando(null)
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Revisión Masiva</h2>

            <Card>
                <CardHeader>
                    <CardTitle>Movimientos Pendientes ({movimientos.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Referencia</TableHead>
                                <TableHead>Estado Match</TableHead>
                                <TableHead>Sugerencia</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {movimientos.map((item) => (
                                <TableRow key={item.movimiento.id} className={procesando === item.movimiento.id ? 'opacity-50 pointer-events-none' : ''}>
                                    <TableCell>{new Date(item.movimiento.fecha).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium">${item.movimiento.monto.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium">{item.movimiento.referencia || '-'}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{item.movimiento.descripcion}</div>
                                    </TableCell>
                                    <TableCell>
                                        {item.match ? (
                                            <Badge variant="outline" className={item.match.score > 80 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>
                                                {item.match.score.toFixed(0)}% Coincidencia
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">Sin sugerencias</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {item.match ? (
                                            <div className="text-sm">
                                                <span className="font-semibold">{item.match.pago.cliente?.nombre}</span>
                                                <div className="text-xs text-muted-foreground">${item.match.pago.monto_esperado.toLocaleString()}</div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {item.match && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleConciliar(item.movimiento.id, item.match.pagoId)}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDescartar(item.movimiento.id)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {movimientos.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No hay movimientos pendientes para revisar
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
