import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    FileText,
    Calendar
} from 'lucide-react'
import { obtenerHistorialSesionesAction } from '@/actions/conciliacion.actions'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const revalidate = 30

export default async function HistorialConciliacionPage() {
    const result = await obtenerHistorialSesionesAction(50)
    const sesiones = result.sesiones || []

    // Agrupar por mes
    const sesionesAgrupadas = sesiones.reduce((acc, sesion) => {
        const mes = format(new Date(sesion.created_at!), 'MMMM yyyy', { locale: es })
        if (!acc[mes]) acc[mes] = []
        acc[mes].push(sesion)
        return acc
    }, {} as Record<string, typeof sesiones>)

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/tesoreria/conciliacion">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Historial de Conciliaciones</h1>
                    <p className="text-muted-foreground">
                        {sesiones.length} sesiones registradas
                    </p>
                </div>
            </div>

            {/* Lista por mes */}
            {Object.keys(sesionesAgrupadas).length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground py-12">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg">No hay sesiones de conciliación</p>
                            <p className="text-sm">Las sesiones aparecerán aquí después de procesarlas</p>
                            <Link href="/tesoreria/conciliacion/importar">
                                <Button className="mt-4">Nueva Conciliación</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                Object.entries(sesionesAgrupadas).map(([mes, sesionesMes]) => (
                    <Card key={mes}>
                        <CardHeader>
                            <CardTitle className="capitalize text-lg">{mes}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {sesionesMes.map(sesion => (
                                <div
                                    key={sesion.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`
                                            p-2 rounded-full
                                            ${sesion.estado === 'completada' ? 'bg-green-100' :
                                                sesion.estado === 'con_errores' ? 'bg-red-100' : 'bg-yellow-100'}
                                        `}>
                                            {sesion.estado === 'completada' ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            ) : sesion.estado === 'con_errores' ? (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            ) : (
                                                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium">
                                                {sesion.sabana_archivo || `Sesión ${sesion.id.slice(0, 8)}`}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(new Date(sesion.created_at!), "EEEE d, HH:mm", { locale: es })}
                                                {sesion.usuario && ` • ${sesion.usuario.nombre || sesion.usuario.email}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* Estadísticas */}
                                        <div className="hidden md:flex items-center gap-3">
                                            <div className="text-center">
                                                <p className="text-xs text-muted-foreground">Total</p>
                                                <p className="font-semibold">{sesion.total_comprobantes}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-green-600">Válidos</p>
                                                <p className="font-semibold text-green-600">{sesion.validados}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-red-600">No encontrados</p>
                                                <p className="font-semibold text-red-600">{sesion.no_encontrados}</p>
                                            </div>
                                        </div>

                                        {/* Monto acreditado */}
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Acreditado</p>
                                            <p className="font-bold text-green-600">
                                                {new Intl.NumberFormat('es-AR', {
                                                    style: 'currency',
                                                    currency: 'ARS',
                                                    minimumFractionDigits: 0
                                                }).format(sesion.monto_total_acreditado)}
                                            </p>
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex gap-2">
                                            {sesion.reporte_url && (
                                                <a href={sesion.reporte_url} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="icon" title="Descargar reporte">
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                </a>
                                            )}
                                            <Link href={`/tesoreria/conciliacion/revisar?sesion=${sesion.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Ver detalle
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    )
}
