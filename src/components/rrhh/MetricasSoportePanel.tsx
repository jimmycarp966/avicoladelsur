'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clock, TrendingUp, Shield, Users, Heart, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'
import { obtenerMetricasEvaluacionAction, type MetricasEvaluacion } from '@/actions/metricas-evaluacion.actions'

interface MetricasSoportePanelProps {
    empleadoId: string | undefined
    mes: number | undefined
    anio: number | undefined
}

// Indicador visual de semáforo
function Semaforo({ valor, umbrales }: { valor: number; umbrales: { verde: number; amarillo: number } }) {
    let color = 'bg-green-500'
    let label = 'Bueno'
    if (valor > umbrales.amarillo) {
        color = 'bg-red-500'
        label = 'Crítico'
    } else if (valor > umbrales.verde) {
        color = 'bg-yellow-500'
        label = 'Atención'
    }
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
        </span>
    )
}

// Badge con sugerencia de puntaje orientativa
function SugerenciaPuntaje({ puntaje }: { puntaje: number }) {
    const colors: Record<number, string> = {
        1: 'bg-red-100 text-red-800 border-red-200',
        2: 'bg-orange-100 text-orange-800 border-orange-200',
        3: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        4: 'bg-green-100 text-green-800 border-green-200',
        5: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    }
    return (
        <Badge variant="outline" className={`text-xs ${colors[puntaje] || ''}`}>
            Sugerencia: {puntaje}/5
        </Badge>
    )
}

// Calcular sugerencia de puntaje para Puntualidad
function calcularSugerenciaPuntualidad(p: MetricasEvaluacion['puntualidad']): number {
    if (p.total_dias_registrados === 0) return 3
    const tasaPresencia = (p.dias_presentes + p.dias_tarde) / p.total_dias_registrados
    const penalizacionFaltas = p.faltas_sin_aviso * 0.15
    const penalizacionRetraso = Math.min(p.retraso_promedio_min / 30, 0.3)
    const score = Math.max(1, Math.min(5, Math.round((tasaPresencia - penalizacionFaltas - penalizacionRetraso) * 5)))
    return score
}

// Calcular sugerencia para Rendimiento
function calcularSugerenciaRendimiento(r: MetricasEvaluacion['rendimiento']): number {
    if (r.ventas && r.ventas.total_pedidos > 0) {
        const tasaEntrega = r.ventas.pedidos_entregados / r.ventas.total_pedidos
        return Math.max(1, Math.min(5, Math.round(tasaEntrega * 5)))
    }
    return 3 // Sin datos suficientes
}

// Calcular sugerencia para Responsabilidad
function calcularSugerenciaResponsabilidad(r: MetricasEvaluacion['responsabilidad']): number {
    let score = 5
    if (r.descuentos && r.descuentos.multas > 0) {
        score -= Math.min(r.descuentos.multas, 3)
    }
    if (r.caja && r.caja.cierres_con_diferencia > 2) {
        score -= 1
    }
    return Math.max(1, score)
}

// Calcular sugerencia para Actitud
function calcularSugerenciaActitud(a: MetricasEvaluacion['actitud']): number {
    let score = 5
    score -= Math.min(a.sanciones_periodo * 1.5, 3)
    if (a.evaluaciones_previas && a.evaluaciones_previas.promedio_historico > 0) {
        // Ponderar con historial
        score = Math.round((score + a.evaluaciones_previas.promedio_historico) / 2)
    }
    return Math.max(1, Math.min(5, Math.round(score)))
}

function MetricaCard({ titulo, icon: Icon, children, sugerencia }: {
    titulo: string
    icon: React.ComponentType<{ className?: string }>
    children: React.ReactNode
    sugerencia?: number
}) {
    return (
        <div className="border rounded-lg p-4 space-y-3 bg-card">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">{titulo}</h4>
                </div>
                {sugerencia !== undefined && <SugerenciaPuntaje puntaje={sugerencia} />}
            </div>
            <div className="space-y-1.5 text-sm">{children}</div>
        </div>
    )
}

function MetricaLinea({ label, valor, sufijo, icono }: {
    label: string
    valor: number | string
    sufijo?: string
    icono?: 'ok' | 'warn' | 'error' | 'info'
}) {
    const iconMap = {
        ok: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
        warn: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />,
        error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
        info: <Info className="w-3.5 h-3.5 text-blue-500" />,
    }
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
                {icono && iconMap[icono]}
                {label}
            </span>
            <span className="font-medium tabular-nums">
                {valor}{sufijo && <span className="text-muted-foreground ml-0.5">{sufijo}</span>}
            </span>
        </div>
    )
}

export function MetricasSoportePanel({ empleadoId, mes, anio }: MetricasSoportePanelProps) {
    const [metricas, setMetricas] = useState<MetricasEvaluacion | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const cargarMetricas = useCallback(async () => {
        if (!empleadoId || !mes || !anio) {
            setMetricas(null)
            return
        }

        setLoading(true)
        setError(null)

        const result = await obtenerMetricasEvaluacionAction(empleadoId, mes, anio)

        if (result.success && result.data) {
            setMetricas(result.data)
        } else {
            setError(result.error || 'Error al cargar métricas')
        }
        setLoading(false)
    }, [empleadoId, mes, anio])

    useEffect(() => {
        cargarMetricas()
    }, [cargarMetricas])

    if (!empleadoId || !mes || !anio) {
        return (
            <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Seleccioná empleado y período para ver las métricas de soporte
                </CardContent>
            </Card>
        )
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Cargando métricas del ERP...</span>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardContent className="py-4 text-center text-red-600 text-sm">
                    {error}
                </CardContent>
            </Card>
        )
    }

    if (!metricas) return null

    const { puntualidad, rendimiento, responsabilidad, trabajo_equipo, actitud } = metricas

    return (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-blue-100">
                        <TrendingUp className="w-4 h-4 text-blue-700" />
                    </div>
                    Huella Digital Operativa
                    <Badge variant="secondary" className="ml-auto text-xs font-normal">
                        Soporte de Decisión
                    </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Datos objetivos del ERP para {metricas.periodo.mes}/{metricas.periodo.anio}.
                    Las sugerencias son orientativas, vos tenés la última palabra.
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* 1. PUNTUALIDAD */}
                <MetricaCard
                    titulo="Puntualidad"
                    icon={Clock}
                    sugerencia={calcularSugerenciaPuntualidad(puntualidad)}
                >
                    <MetricaLinea
                        label="Días presente"
                        valor={puntualidad.dias_presentes}
                        sufijo={`/ ${puntualidad.total_dias_registrados}`}
                        icono="ok"
                    />
                    <MetricaLinea
                        label="Llegadas tarde"
                        valor={puntualidad.dias_tarde}
                        icono={puntualidad.dias_tarde > 3 ? 'warn' : 'ok'}
                    />
                    <MetricaLinea
                        label="Ausencias"
                        valor={puntualidad.dias_ausente}
                        icono={puntualidad.dias_ausente > 2 ? 'error' : puntualidad.dias_ausente > 0 ? 'warn' : 'ok'}
                    />
                    <MetricaLinea
                        label="Faltas sin aviso"
                        valor={puntualidad.faltas_sin_aviso}
                        icono={puntualidad.faltas_sin_aviso > 0 ? 'error' : 'ok'}
                    />
                    <MetricaLinea
                        label="Retraso promedio"
                        valor={puntualidad.retraso_promedio_min}
                        sufijo="min"
                        icono={puntualidad.retraso_promedio_min > 15 ? 'warn' : 'info'}
                    />
                    {puntualidad.licencias_aprobadas > 0 && (
                        <MetricaLinea
                            label="Licencias aprobadas"
                            valor={puntualidad.licencias_aprobadas}
                            icono="info"
                        />
                    )}
                    <div className="pt-1">
                        <Semaforo
                            valor={puntualidad.faltas_sin_aviso + puntualidad.dias_ausente}
                            umbrales={{ verde: 1, amarillo: 3 }}
                        />
                    </div>
                </MetricaCard>

                {/* 2. RENDIMIENTO */}
                <MetricaCard
                    titulo={`Rendimiento (${rendimiento.categoria})`}
                    icon={TrendingUp}
                    sugerencia={calcularSugerenciaRendimiento(rendimiento)}
                >
                    {rendimiento.ventas && rendimiento.ventas.total_pedidos > 0 && (
                        <>
                            <MetricaLinea label="Pedidos totales" valor={rendimiento.ventas.total_pedidos} icono="info" />
                            <MetricaLinea
                                label="Pedidos entregados"
                                valor={rendimiento.ventas.pedidos_entregados}
                                icono="ok"
                            />
                            <MetricaLinea
                                label="Pedidos cancelados"
                                valor={rendimiento.ventas.pedidos_cancelados}
                                icono={rendimiento.ventas.pedidos_cancelados > 0 ? 'warn' : 'ok'}
                            />
                            <MetricaLinea
                                label="Monto total"
                                valor={`$${rendimiento.ventas.monto_total.toLocaleString('es-AR')}`}
                                icono="info"
                            />
                        </>
                    )}
                    {rendimiento.produccion && rendimiento.produccion.ordenes_total > 0 && (
                        <>
                            <MetricaLinea label="Órdenes completadas" valor={`${rendimiento.produccion.ordenes_completadas}/${rendimiento.produccion.ordenes_total}`} icono="ok" />
                            <MetricaLinea label="Kg producidos" valor={rendimiento.produccion.kg_producidos.toLocaleString('es-AR')} sufijo="kg" icono="info" />
                        </>
                    )}
                    {rendimiento.reparto && rendimiento.reparto.rutas_total > 0 && (
                        <>
                            <MetricaLinea label="Rutas completadas" valor={`${rendimiento.reparto.rutas_completadas}/${rendimiento.reparto.rutas_total}`} icono="ok" />
                            <MetricaLinea label="Entregas exitosas" valor={rendimiento.reparto.entregas_exitosas} icono="ok" />
                            <MetricaLinea label="Entregas fallidas" valor={rendimiento.reparto.entregas_fallidas} icono={rendimiento.reparto.entregas_fallidas > 0 ? 'warn' : 'ok'} />
                        </>
                    )}
                    {(!rendimiento.ventas || rendimiento.ventas.total_pedidos === 0) &&
                        (!rendimiento.produccion || rendimiento.produccion.ordenes_total === 0) &&
                        (!rendimiento.reparto || rendimiento.reparto.rutas_total === 0) && (
                            <p className="text-xs text-muted-foreground italic">Sin datos de rendimiento para este periodo</p>
                        )}
                </MetricaCard>

                {/* 3. RESPONSABILIDAD */}
                <MetricaCard
                    titulo="Responsabilidad"
                    icon={Shield}
                    sugerencia={calcularSugerenciaResponsabilidad(responsabilidad)}
                >
                    {responsabilidad.caja && responsabilidad.caja.cierres_total > 0 && (
                        <>
                            <MetricaLinea label="Cierres de caja" valor={responsabilidad.caja.cierres_total} icono="info" />
                            <MetricaLinea
                                label="Con diferencia"
                                valor={responsabilidad.caja.cierres_con_diferencia}
                                icono={responsabilidad.caja.cierres_con_diferencia > 2 ? 'error' : responsabilidad.caja.cierres_con_diferencia > 0 ? 'warn' : 'ok'}
                            />
                            {responsabilidad.caja.diferencia_promedio > 0 && (
                                <MetricaLinea
                                    label="Diferencia promedio"
                                    valor={`$${responsabilidad.caja.diferencia_promedio.toLocaleString('es-AR')}`}
                                    icono="warn"
                                />
                            )}
                        </>
                    )}
                    {responsabilidad.descuentos && (
                        <>
                            <MetricaLinea
                                label="Descuentos/multas"
                                valor={responsabilidad.descuentos.multas}
                                icono={responsabilidad.descuentos.multas > 0 ? 'error' : 'ok'}
                            />
                            {responsabilidad.descuentos.monto_total > 0 && (
                                <MetricaLinea
                                    label="Monto descuentos"
                                    valor={`$${responsabilidad.descuentos.monto_total.toLocaleString('es-AR')}`}
                                    icono="warn"
                                />
                            )}
                        </>
                    )}
                    {(!responsabilidad.caja || responsabilidad.caja.cierres_total === 0) &&
                        (!responsabilidad.descuentos || responsabilidad.descuentos.total_descuentos === 0) && (
                            <p className="text-xs text-muted-foreground italic">Sin incidentes registrados — excelente</p>
                        )}
                </MetricaCard>

                {/* 4. TRABAJO EN EQUIPO */}
                <MetricaCard titulo="Trabajo en Equipo" icon={Users}>
                    <MetricaLinea
                        label="Novedades del periodo"
                        valor={trabajo_equipo.novedades_periodo}
                        icono="info"
                    />
                    <p className="text-xs text-muted-foreground italic pt-1">
                        Evaluar manualmente: comunicación, colaboración, cobertura de ausencias
                    </p>
                </MetricaCard>

                {/* 5. ACTITUD */}
                <MetricaCard
                    titulo="Actitud"
                    icon={Heart}
                    sugerencia={calcularSugerenciaActitud(actitud)}
                >
                    <MetricaLinea
                        label="Sanciones este periodo"
                        valor={actitud.sanciones_periodo}
                        icono={actitud.sanciones_periodo > 0 ? 'error' : 'ok'}
                    />
                    <MetricaLinea
                        label="Sanciones históricas"
                        valor={actitud.sanciones_historicas}
                        icono={actitud.sanciones_historicas > 3 ? 'warn' : 'info'}
                    />
                    {actitud.evaluaciones_previas && actitud.evaluaciones_previas.cantidad > 0 && (
                        <>
                            <MetricaLinea
                                label="Evaluaciones previas"
                                valor={actitud.evaluaciones_previas.cantidad}
                                icono="info"
                            />
                            <MetricaLinea
                                label="Promedio histórico"
                                valor={actitud.evaluaciones_previas.promedio_historico}
                                sufijo="/5"
                                icono="info"
                            />
                        </>
                    )}
                </MetricaCard>

                {/* Nota informativa */}
                <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-md">
                    <p className="text-xs text-blue-700 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        Las sugerencias son orientativas basadas en datos del ERP. El evaluador tiene la última palabra.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
