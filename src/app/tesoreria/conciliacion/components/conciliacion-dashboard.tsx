'use client'

import { useState } from 'react'
import { MovimientoBancario, PagoEsperado } from '@/types/conciliacion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowRight, Check, X, RefreshCw, Upload, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { obtenerSugerenciasAction, crearConciliacionManualAction, descartarMovimientoAction } from '@/actions/conciliacion.actions'
import { toast } from 'sonner'

interface DashboardProps {
    initialMovimientos: any[]
    initialPagos: any[]
    stats: {
        autoConciliados: number
        pendientes: number
    }
}

export function ConciliacionDashboard({ initialMovimientos, initialPagos, stats }: DashboardProps) {
    const [movimientoSeleccionado, setMovimientoSeleccionado] = useState<any | null>(null)
    const [sugerencias, setSugerencias] = useState<any | null>(null)
    const [cargandoSugerencias, setCargandoSugerencias] = useState(false)
    const router = useRouter()

    const handleSelectMovimiento = async (mov: any) => {
        setMovimientoSeleccionado(mov)
        setSugerencias(null)
        setCargandoSugerencias(true)

        try {
            const res = await obtenerSugerenciasAction(mov.id, true) // Usar IA si es necesario
            if (res.success) {
                setSugerencias(res)
            } else {
                toast.error('Error cargando sugerencias')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setCargandoSugerencias(false)
        }
    }

    const handleConciliar = async (pagoId: string, tipo: string) => {
        if (!movimientoSeleccionado) return

        const toastId = toast.loading('Conciliando...')
        try {
            const res = await crearConciliacionManualAction({
                movimientoBancarioId: movimientoSeleccionado.id,
                pagoEsperadoId: pagoId,
                notas: `Conciliación ${tipo}`
            })

            if (res.success) {
                toast.success('Conciliado exitosamente', { id: toastId })
                setMovimientoSeleccionado(null)
                setSugerencias(null)
                // Refresh server data
                router.refresh()
            } else {
                toast.error(res.error || 'Error al conciliar', { id: toastId })
            }
        } catch (e) {
            toast.error('Error inesperado', { id: toastId })
        }
    }

    const handleDescartar = async () => {
        if (!movimientoSeleccionado) return
        const toastId = toast.loading('Descartando...')
        try {
            const res = await descartarMovimientoAction(movimientoSeleccionado.id)
            if (res.success) {
                toast.success('Movimiento descartado', { id: toastId })
                setMovimientoSeleccionado(null)
                setSugerencias(null)
                router.refresh()
            } else {
                toast.error(res.error, { id: toastId })
            }
        } catch (e) {
            toast.error('Error', { id: toastId })
        }
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Auto-conciliados</CardTitle>
                        <Check className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.autoConciliados}</div>
                        <p className="text-xs text-muted-foreground">Total histórico</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                        <RefreshCw className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendientes}</div>
                        <p className="text-xs text-muted-foreground">Requieren revisión</p>
                    </CardContent>
                </Card>
                {/* Placeholder cards */}
                <Card className="bg-primary/5 border-primary/20">
                    <Link href="/tesoreria/conciliacion/importar" className="flex flex-col items-center justify-center h-full py-4 text-primary hover:text-primary/80 transition-colors">
                        <Upload className="h-8 w-8 mb-2" />
                        <span className="font-semibold">Importar Archivo</span>
                    </Link>
                </Card>
                <Card className="bg-secondary/5 border-secondary/20">
                    <Link href="/tesoreria/conciliacion/revisar" className="flex flex-col items-center justify-center h-full py-4 text-secondary-foreground hover:text-secondary-foreground/80 transition-colors">
                        <Search className="h-8 w-8 mb-2" />
                        <span className="font-semibold">Revisión Masiva</span>
                    </Link>
                </Card>
            </div>

            {/* Main Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[700px]">

                {/* Columna Izquierda: Bancarios Pendientes */}
                <div className="md:col-span-4 flex flex-col gap-4 h-full">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        Movimientos Bancarios
                        <Badge variant="outline">{initialMovimientos.length}</Badge>
                    </h3>
                    <ScrollArea className="h-full border rounded-md bg-muted/20 p-4">
                        <div className="space-y-3">
                            {initialMovimientos.map((mov) => (
                                <div
                                    key={mov.id}
                                    onClick={() => handleSelectMovimiento(mov)}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:bg-muted ${movimientoSeleccionado?.id === mov.id ? 'border-primary ring-2 ring-primary/20 bg-background shadow-md' : 'bg-card text-card-foreground shadow-sm'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-lg">${mov.monto.toLocaleString()}</span>
                                        <span className="text-xs text-muted-foreground">{new Date(mov.fecha).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm font-medium truncate" title={mov.referencia}>{mov.referencia || 'Sin referencia'}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{mov.descripcion}</p>
                                    {mov.dni_cuit && <Badge variant="secondary" className="mt-2 text-[10px]">{mov.dni_cuit}</Badge>}
                                </div>
                            ))}
                            {initialMovimientos.length === 0 && (
                                <div className="text-center text-muted-foreground py-10">
                                    No hay movimientos pendientes
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Columna Central: Área de Trabajo / Sugerencias */}
                <div className="md:col-span-4 flex flex-col gap-4 h-full">
                    <h3 className="font-semibold text-lg">Sugerencias y Matching</h3>
                    <div className="flex-1 border rounded-md p-4 bg-background shadow-sm flex flex-col">
                        {movimientoSeleccionado ? (
                            <div className="space-y-6 h-full flex flex-col">
                                <div className="pb-4 border-b">
                                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Seleccionado:</h4>
                                    <div className="text-2xl font-bold">${movimientoSeleccionado.monto.toLocaleString()}</div>
                                    <div className="text-sm">{movimientoSeleccionado.descripcion}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{movimientoSeleccionado.referencia}</div>
                                </div>

                                <div className="flex-1 overflow-auto space-y-4">
                                    {cargandoSugerencias ? (
                                        <div className="flex justify-center items-center h-40">
                                            <RefreshCw className="animate-spin h-8 w-8 text-primary" />
                                        </div>
                                    ) : sugerencias ? (
                                        <>
                                            {/* Reglas Match */}
                                            {sugerencias.matchReglas && (
                                                <Card className="border-green-200 bg-green-50/50">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-sm text-green-700 flex justify-between">
                                                            Mejor Coincidencia (Reglas)
                                                            <Badge className="bg-green-600">{sugerencias.matchReglas.score.toFixed(0)} pts</Badge>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="text-sm font-medium">{sugerencias.matchReglas.pago.cliente?.nombre}</div>
                                                        <div className="text-xs text-muted-foreground mb-2">{sugerencias.matchReglas.pago.referencia}</div>
                                                        <div className="text-lg font-bold">${sugerencias.matchReglas.pago.monto_esperado.toLocaleString()}</div>
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {sugerencias.matchReglas.etiquetas.map((t: string) => (
                                                                <Badge key={t} variant="outline" className="text-[10px] bg-white">{t}</Badge>
                                                            ))}
                                                        </div>
                                                        <Button size="sm" className="w-full mt-4 bg-green-600 hover:bg-green-700" onClick={() => handleConciliar(sugerencias.matchReglas.pagoId, 'automatico')}>
                                                            Confirmar Match
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* IA Match */}
                                            {sugerencias.matchIA && (
                                                <Card className="border-purple-200 bg-purple-50/50">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-sm text-purple-700 flex justify-between items-center">
                                                            Sugerencia IA (Gemini)
                                                            <Badge className="bg-purple-600">{(sugerencias.matchIA.score).toFixed(0)}%</Badge>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="text-sm font-medium">{sugerencias.matchIA.pago.cliente?.nombre}</div>
                                                        <div className="text-lg font-bold">${sugerencias.matchIA.pago.monto_esperado.toLocaleString()}</div>
                                                        <p className="text-xs text-muted-foreground mt-2 italic">"{sugerencias.matchIA.razon}"</p>
                                                        <Button size="sm" className="w-full mt-4 bg-purple-600 hover:bg-purple-700" onClick={() => handleConciliar(sugerencias.matchIA.pago.id, 'ia')}>
                                                            Aceptar Sugerencia IA
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {!sugerencias.matchReglas && !sugerencias.matchIA && (
                                                <div className="text-center text-muted-foreground p-4">
                                                    No se encontraron coincidencias automáticas claras.
                                                    <p className="text-xs mt-2">Busca manualmente en la lista de la derecha.</p>
                                                </div>
                                            )}
                                        </>
                                    ) : null}
                                </div>

                                <div className="pt-4 border-t flex gap-2">
                                    <Button variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDescartar}>
                                        <X className="h-4 w-4 mr-2" />
                                        Descartar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                <ArrowRight className="h-10 w-10 mb-4 opacity-20" />
                                <p>Selecciona un movimiento para conciliar</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Pagos Pendientes (Candidatos) */}
                <div className="md:col-span-4 flex flex-col gap-4 h-full">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        Pagos Esperados
                        <Badge variant="outline">{initialPagos.length}</Badge>
                    </h3>
                    <ScrollArea className="h-full border rounded-md bg-muted/20 p-4">
                        <div className="space-y-3">
                            {initialPagos.map((pago) => (
                                <div
                                    key={pago.id}
                                    className="bg-card text-card-foreground p-4 rounded-lg border shadow-sm flex flex-col transition-all hover:bg-muted group"
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-bold text-lg">${pago.monto_esperado.toLocaleString()}</span>
                                        <Badge variant="secondary" className="text-[10px]">{pago.origen}</Badge>
                                    </div>
                                    <p className="text-sm font-medium">{pago.cliente?.nombre || 'Cliente desconocido'}</p>
                                    <p className="text-xs text-muted-foreground">{pago.referencia}</p>

                                    {/* Botón de conciliar manual solo visible si hay selección */}
                                    {movimientoSeleccionado && (
                                        <div className="mt-3 overflow-hidden h-0 group-hover:h-auto transition-all">
                                            <Button size="sm" variant="default" className="w-full" onClick={() => handleConciliar(pago.id, 'manual')}>
                                                Conciliar con este
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {initialPagos.length === 0 && (
                                <div className="text-center text-muted-foreground py-10">
                                    No hay pagos pendientes
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

            </div>
        </div>
    )
}
