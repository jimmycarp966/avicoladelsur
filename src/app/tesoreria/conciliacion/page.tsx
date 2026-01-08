import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Upload,
    History,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    DollarSign,
    TrendingUp,
    FileText
} from 'lucide-react'
import { obtenerEstadisticasConciliacionAction, obtenerHistorialSesionesAction } from '@/actions/conciliacion.actions'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

export const revalidate = 60 // Revalidar cada 60 segundos

export default async function ConciliacionDashboardPage() {
    // Obtener datos
    const [statsResult, historialResult] = await Promise.all([
        obtenerEstadisticasConciliacionAction(),
        obtenerHistorialSesionesAction(5)
    ])

    const stats = statsResult.stats || {
        totalSesiones: 0,
        sesionesHoy: 0,
        totalAcreditado: 0,
        tasaExito: 0
    }

    const sesiones = historialResult.sesiones || []

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">🏦 Conciliación Bancaria</h1>
                    <p className="text-muted-foreground">
                        Valide comprobantes de pago contra el extracto bancario
                    </p>
                </div>
                <Link href="/tesoreria/conciliacion/importar">
                    <Button size="lg" className="gap-2">
                        <Upload className="h-5 w-5" />
                        Nueva Conciliación
                    </Button>
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Sesiones</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSesiones}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.sesionesHoy} hoy
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.tasaExito}%</div>
                        <p className="text-xs text-muted-foreground">
                            comprobantes validados
                        </p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Monto Total Acreditado</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: 'ARS'
                            }).format(stats.totalAcreditado)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            acumulado histórico
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Cómo funciona */}
            <Card>
                <CardHeader>
                    <CardTitle>¿Cómo funciona?</CardTitle>
                    <CardDescription>
                        Proceso de conciliación en 4 pasos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 font-bold">1</div>
                            <p className="font-medium">Subir Sábana</p>
                            <p className="text-sm text-muted-foreground">PDF del extracto bancario</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 font-bold">2</div>
                            <p className="font-medium">Subir Comprobantes</p>
                            <p className="text-sm text-muted-foreground">Imágenes de transferencias</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 font-bold">3</div>
                            <p className="font-medium">Validación Automática</p>
                            <p className="text-sm text-muted-foreground">IA cruza los datos</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 font-bold">4</div>
                            <p className="font-medium">Acreditación</p>
                            <p className="text-sm text-muted-foreground">Saldos se acreditan</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Historial reciente */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Historial Reciente</CardTitle>
                        <CardDescription>Últimas sesiones de conciliación</CardDescription>
                    </div>
                    <Link href="/tesoreria/conciliacion/historial">
                        <Button variant="outline" size="sm">
                            Ver todo
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {sesiones.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay sesiones de conciliación aún</p>
                            <p className="text-sm">Comience subiendo una sábana bancaria</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sesiones.map(sesion => (
                                <div
                                    key={sesion.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            p-2 rounded-full
                                            ${sesion.estado === 'completada' ? 'bg-green-100' : 'bg-yellow-100'}
                                        `}>
                                            {sesion.estado === 'completada' ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium">
                                                {sesion.sabana_archivo || `Sesión ${sesion.id.slice(0, 8)}`}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(new Date(sesion.created_at!), "d 'de' MMMM, HH:mm", { locale: es })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-green-600 border-green-200">
                                                    ✅ {sesion.validados}
                                                </Badge>
                                                {sesion.no_encontrados > 0 && (
                                                    <Badge variant="outline" className="text-red-600 border-red-200">
                                                        ❌ {sesion.no_encontrados}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-green-600 font-medium">
                                                {new Intl.NumberFormat('es-AR', {
                                                    style: 'currency',
                                                    currency: 'ARS'
                                                }).format(sesion.monto_total_acreditado)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {sesion.reporte_url && (
                                                <a href={sesion.reporte_url} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="icon">
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            <Link href={`/tesoreria/conciliacion/revisar?sesion=${sesion.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    Ver detalle
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
