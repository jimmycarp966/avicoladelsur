'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  FileBarChart,
  AlertTriangle,
  TrendingUp,
  Users,
  Tag,
  DollarSign,
  Scale,
  Calendar,
  Loader2,
  Download,
  RefreshCw,
  Percent,
} from 'lucide-react'
import {
  obtenerReporteUsoListasAction,
  obtenerReporteMargenesAction,
  obtenerAlertasComportamientoAction,
  type ReporteUsoListas,
  type ReporteMargenes,
  type AlertaComportamiento,
} from '@/actions/ventas-sucursal.actions'

// ===========================================
// TIPOS
// ===========================================

interface AuditoriaData {
  sucursalId: string
  sucursalNombre: string
  usuarios: Array<{ id: string; nombre: string }>
  listasPrecio: Array<{ id: string; nombre: string; tipo: string }>
}

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

export function AuditoriaListasContent({ data }: { data: AuditoriaData }) {
  // Estado de filtros
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() - 7)
    return fecha.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [diasAlertas, setDiasAlertas] = useState<number>(7)

  // Estado de datos
  const [reporteUsoListas, setReporteUsoListas] = useState<ReporteUsoListas[]>([])
  const [reporteMargenes, setReporteMargenes] = useState<ReporteMargenes[]>([])
  const [alertas, setAlertas] = useState<AlertaComportamiento[]>([])

  // Estado de carga
  const [cargandoUsoListas, setCargandoUsoListas] = useState(false)
  const [cargandoMargenes, setCargandoMargenes] = useState(false)
  const [cargandoAlertas, setCargandoAlertas] = useState(false)

  // Cargar reporte de uso de listas
  const cargarReporteUsoListas = async () => {
    setCargandoUsoListas(true)
    try {
      const result = await obtenerReporteUsoListasAction(
        data.sucursalId,
        fechaDesde,
        fechaHasta
      )
      if (result.success && result.data) {
        setReporteUsoListas(result.data)
      } else {
        toast.error(result.error || 'Error al cargar reporte')
      }
    } catch (error) {
      toast.error('Error al cargar reporte de uso de listas')
    } finally {
      setCargandoUsoListas(false)
    }
  }

  // Cargar reporte de márgenes
  const cargarReporteMargenes = async () => {
    setCargandoMargenes(true)
    try {
      const result = await obtenerReporteMargenesAction(
        data.sucursalId,
        fechaDesde,
        fechaHasta
      )
      if (result.success && result.data) {
        setReporteMargenes(result.data)
      } else {
        toast.error(result.error || 'Error al cargar reporte')
      }
    } catch (error) {
      toast.error('Error al cargar reporte de márgenes')
    } finally {
      setCargandoMargenes(false)
    }
  }

  // Cargar alertas
  const cargarAlertas = async () => {
    setCargandoAlertas(true)
    try {
      const result = await obtenerAlertasComportamientoAction(
        data.sucursalId,
        diasAlertas
      )
      if (result.success && result.data) {
        setAlertas(result.data)
      } else {
        toast.error(result.error || 'Error al cargar alertas')
      }
    } catch (error) {
      toast.error('Error al cargar alertas')
    } finally {
      setCargandoAlertas(false)
    }
  }

  // Cargar datos al montar
  useEffect(() => {
    cargarReporteUsoListas()
    cargarReporteMargenes()
    cargarAlertas()
  }, [])

  // Recargar al cambiar fechas
  const handleActualizarReportes = () => {
    cargarReporteUsoListas()
    cargarReporteMargenes()
  }

  // Calcular estadísticas
  const totalVentasMinorista = reporteUsoListas
    .filter((r) => r.tipoLista === 'minorista')
    .reduce((sum, r) => sum + r.cantidadVentas, 0)
  const totalVentasMayorista = reporteUsoListas
    .filter((r) => r.tipoLista === 'mayorista')
    .reduce((sum, r) => sum + r.cantidadVentas, 0)
  const totalVentas = totalVentasMinorista + totalVentasMayorista
  const porcentajeMayorista = totalVentas > 0 
    ? ((totalVentasMayorista / totalVentas) * 100).toFixed(1)
    : '0'

  const margenPromedioTotal = reporteMargenes.length > 0
    ? (
        reporteMargenes.reduce((sum, r) => sum + (r.porcentajeMargen || 0), 0) /
        reporteMargenes.length
      ).toFixed(1)
    : '0'

  // Obtener badge de tipo de lista
  const getTipoListaBadge = (tipo: string) => {
    switch (tipo) {
      case 'mayorista':
        return <Badge variant="default">Mayorista</Badge>
      case 'minorista':
        return <Badge variant="secondary">Minorista</Badge>
      case 'distribuidor':
        return <Badge variant="outline">Distribuidor</Badge>
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  // Obtener badge de tipo de alerta
  const getAlertaBadge = (tipo: string) => {
    switch (tipo) {
      case 'alto_mayorista':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Alto % Mayorista
          </Badge>
        )
      case 'mayorista_bajo_volumen':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Bajo Volumen
          </Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="w-8 h-8" />
            Auditoría de Listas de Precios
          </h1>
          <p className="text-muted-foreground">
            {data.sucursalNombre} - Control de uso de precios mayorista/minorista
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={handleActualizarReportes}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alertas de comportamiento sospechoso */}
      {alertas.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Comportamiento
            </CardTitle>
            <CardDescription>
              Patrones sospechosos detectados en los últimos {diasAlertas} días
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertas.map((alerta, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{alerta.usuarioNombre}</span>
                      {getAlertaBadge(alerta.tipoAlerta)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {alerta.descripcion}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alerta.fechaDeteccion).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estadísticas resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Minorista</CardTitle>
            <Tag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVentasMinorista}</div>
            <p className="text-xs text-muted-foreground">
              En el período seleccionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Mayorista</CardTitle>
            <Tag className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVentasMayorista}</div>
            <p className="text-xs text-muted-foreground">
              En el período seleccionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Mayorista</CardTitle>
            <Percent className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {porcentajeMayorista}%
            </div>
            <p className="text-xs text-muted-foreground">
              Del total de ventas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {margenPromedioTotal}%
            </div>
            <p className="text-xs text-muted-foreground">
              Sobre ventas totales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de reportes */}
      <Tabs defaultValue="uso-listas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="uso-listas" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Uso por Usuario
          </TabsTrigger>
          <TabsTrigger value="margenes" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Márgenes por Día
          </TabsTrigger>
        </TabsList>

        {/* Reporte de uso de listas por usuario */}
        <TabsContent value="uso-listas">
          <Card>
            <CardHeader>
              <CardTitle>Uso de Listas de Precios por Usuario</CardTitle>
              <CardDescription>
                Detalle de ventas por tipo de lista y usuario
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cargandoUsoListas ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : reporteUsoListas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileBarChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Tipo Lista</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Kg Totales</TableHead>
                      <TableHead className="text-right">Monto Total</TableHead>
                      <TableHead className="text-right">% del Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporteUsoListas.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {row.usuarioNombre}
                        </TableCell>
                        <TableCell>{getTipoListaBadge(row.tipoLista)}</TableCell>
                        <TableCell className="text-right">
                          {row.cantidadVentas}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Scale className="w-3 h-3 text-muted-foreground" />
                            {row.kgTotales.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            {row.montoTotal.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              row.porcentajeVentas > 50
                                ? 'default'
                                : row.porcentajeVentas > 25
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {row.porcentajeVentas.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reporte de márgenes por día */}
        <TabsContent value="margenes">
          <Card>
            <CardHeader>
              <CardTitle>Márgenes por Día y Tipo de Lista</CardTitle>
              <CardDescription>
                Análisis de rentabilidad por tipo de venta
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cargandoMargenes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : reporteMargenes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileBarChart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo Lista</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Venta Total</TableHead>
                      <TableHead className="text-right">Costo Total</TableHead>
                      <TableHead className="text-right">Margen Bruto</TableHead>
                      <TableHead className="text-right">% Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporteMargenes.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(row.fecha).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>{getTipoListaBadge(row.tipoLista)}</TableCell>
                        <TableCell className="text-right">
                          {row.cantidadVentas}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${row.ventaTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${row.costoTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              row.margenBruto > 0
                                ? 'text-green-600 font-medium'
                                : row.margenBruto < 0
                                ? 'text-red-600 font-medium'
                                : ''
                            }
                          >
                            ${row.margenBruto.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              row.porcentajeMargen > 20
                                ? 'default'
                                : row.porcentajeMargen > 10
                                ? 'secondary'
                                : 'destructive'
                            }
                            className={
                              row.porcentajeMargen > 20
                                ? 'bg-green-600'
                                : row.porcentajeMargen > 10
                                ? ''
                                : ''
                            }
                          >
                            {row.porcentajeMargen.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

