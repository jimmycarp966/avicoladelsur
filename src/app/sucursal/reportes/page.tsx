'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Download, FileText, TrendingUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ReporteTipo = 'ventas' | 'inventario' | 'financiero'
type FormatoTipo = 'pdf' | 'excel' | 'csv'

export default function SucursalReportesPage() {
  const [generandoReporte, setGenerandoReporte] = useState<ReporteTipo | null>(null)

  const generarReporte = async (tipo: ReporteTipo, formato: FormatoTipo = 'pdf') => {
    setGenerandoReporte(tipo)

    try {
      // Simular generación de reporte
      await new Promise(resolve => setTimeout(resolve, 2000))

      toast.success(`Reporte de ${tipo} generado en formato ${formato.toUpperCase()}`)

      // En el futuro aquí iría la lógica real para generar y descargar el reporte
      // Por ahora solo mostramos el mensaje

    } catch (error) {
      toast.error('Error al generar el reporte')
    } finally {
      setGenerandoReporte(null)
    }
  }

  const reportes = [
    {
      tipo: 'ventas' as ReporteTipo,
      titulo: 'Reporte de Ventas',
      descripcion: 'Ventas por período, productos más vendidos y análisis de ingresos',
      icono: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      tipo: 'inventario' as ReporteTipo,
      titulo: 'Reporte de Inventario',
      descripcion: 'Estado actual del inventario, productos con stock bajo y valoración',
      icono: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      tipo: 'financiero' as ReporteTipo,
      titulo: 'Reporte Financiero',
      descripcion: 'Movimientos de caja, ingresos vs egresos y balance mensual',
      icono: BarChart3,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Reportes de Sucursal
          </h1>
          <p className="text-muted-foreground">
            Genera reportes específicos de tu sucursal en múltiples formatos
          </p>
        </div>
      </div>

      {/* Información de Reportes */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Reportes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Badge variant="default">PDF</Badge>
                <span>Profesional</span>
              </h4>
              <p className="text-sm text-muted-foreground">
                Reportes formateados con gráficos, tablas y paginación automática
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Badge variant="secondary">Excel</Badge>
                <span>Análisis</span>
              </h4>
              <p className="text-sm text-muted-foreground">
                Datos tabulares para análisis avanzado y manipulaciones
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Badge variant="outline">CSV</Badge>
                <span>Simple</span>
              </h4>
              <p className="text-sm text-muted-foreground">
                Exportación básica de datos compatible con cualquier aplicación
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Reportes */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        {reportes.map((reporte) => {
          const Icono = reporte.icono
          const isGenerating = generandoReporte === reporte.tipo

          return (
            <Card key={reporte.tipo} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${reporte.bgColor}`}>
                    <Icono className={`w-6 h-6 ${reporte.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{reporte.titulo}</CardTitle>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {reporte.descripcion}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generarReporte(reporte.tipo, 'pdf')}
                    disabled={isGenerating}
                    className="flex items-center gap-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generarReporte(reporte.tipo, 'excel')}
                    disabled={isGenerating}
                    className="flex items-center gap-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Excel
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generarReporte(reporte.tipo, 'csv')}
                    disabled={isGenerating}
                    className="flex items-center gap-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    CSV
                  </Button>
                </div>

                {isGenerating && (
                  <div className="text-center text-sm text-muted-foreground">
                    Generando reporte...
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Información Adicional */}
      <Card>
        <CardHeader>
          <CardTitle>Reportes Disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold">Contenido de Reportes</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Reporte de Ventas:</strong> Resumen diario, productos más vendidos, tendencias</li>
                <li>• <strong>Reporte de Inventario:</strong> Stock actual, productos críticos, valoración</li>
                <li>• <strong>Reporte Financiero:</strong> Movimientos de caja, balance, proyecciones</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Características</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Datos en tiempo real de tu sucursal</li>
                <li>• Filtros por período (diario, semanal, mensual)</li>
                <li>• Gráficos y visualizaciones incluidas</li>
                <li>• Descarga automática al generar</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
