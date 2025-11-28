'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, Calculator, Users, TrendingUp, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useNotificationStore } from '@/store/notificationStore'

type ReportType = 'empleados' | 'liquidaciones' | 'adelantos' | 'evaluaciones' | 'asistencia' | 'licencias'

interface ReportConfig {
  type: ReportType
  title: string
  description: string
  icon: React.ReactNode
  color: string
  fields: {
    fecha_desde?: boolean
    fecha_hasta?: boolean
    mes?: boolean
    anio?: boolean
    sucursal?: boolean
    empleado?: boolean
    estado?: boolean
  }
}

const reportConfigs: ReportConfig[] = [
  {
    type: 'empleados',
    title: 'Listado de Empleados',
    description: 'Listado completo de empleados con datos personales y laborales',
    icon: <Users className="w-5 h-5" />,
    color: 'bg-blue-500',
    fields: {
      sucursal: true,
      estado: true,
    },
  },
  {
    type: 'liquidaciones',
    title: 'Liquidaciones de Sueldo',
    description: 'Reporte de sueldos calculados por período',
    icon: <Calculator className="w-5 h-5" />,
    color: 'bg-green-500',
    fields: {
      mes: true,
      anio: true,
      empleado: true,
      estado: true,
    },
  },
  {
    type: 'adelantos',
    title: 'Adelantos y Descuentos',
    description: 'Historial de adelantos y descuentos del personal',
    icon: <FileText className="w-5 h-5" />,
    color: 'bg-purple-500',
    fields: {
      fecha_desde: true,
      fecha_hasta: true,
      empleado: true,
      estado: true,
    },
  },
  {
    type: 'evaluaciones',
    title: 'Evaluaciones de Desempeño',
    description: 'Resultados de evaluaciones por período y sucursal',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'bg-yellow-500',
    fields: {
      mes: true,
      anio: true,
      sucursal: true,
      empleado: true,
    },
  },
  {
    type: 'asistencia',
    title: 'Control de Asistencia',
    description: 'Reporte de asistencia, retrasos y faltas por período',
    icon: <Calendar className="w-5 h-5" />,
    color: 'bg-red-500',
    fields: {
      fecha_desde: true,
      fecha_hasta: true,
      empleado: true,
    },
  },
  {
    type: 'licencias',
    title: 'Licencias y Descansos',
    description: 'Historial de licencias, vacaciones y permisos',
    icon: <FileText className="w-5 h-5" />,
    color: 'bg-indigo-500',
    fields: {
      fecha_desde: true,
      fecha_hasta: true,
      empleado: true,
      estado: true,
    },
  },
]

export function ReportesRRHHForm() {
  const { showToast } = useNotificationStore()
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const [formData, setFormData] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    mes: new Date().getMonth() + 1,
    anio: new Date().getFullYear(),
    sucursal_id: '',
    empleado_id: 'all',
    estado: 'all',
    formato: 'excel' as 'excel' | 'pdf',
  })

  const selectedConfig = reportConfigs.find(config => config.type === selectedReport)

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      showToast('error', 'Debe seleccionar un tipo de reporte', 'Error de validación')
      return
    }

    try {
      setIsGenerating(true)

      // Construir parámetros del reporte
      const params = new URLSearchParams()
      params.append('tipo', selectedReport)
      params.append('formato', formData.formato)

      // Agregar filtros según el tipo de reporte
      if (selectedConfig?.fields.fecha_desde && formData.fecha_desde) {
        params.append('fecha_desde', formData.fecha_desde)
      }
      if (selectedConfig?.fields.fecha_hasta && formData.fecha_hasta) {
        params.append('fecha_hasta', formData.fecha_hasta)
      }
      if (selectedConfig?.fields.mes) {
        params.append('mes', formData.mes.toString())
      }
      if (selectedConfig?.fields.anio) {
        params.append('anio', formData.anio.toString())
      }
      if (selectedConfig?.fields.sucursal && formData.sucursal_id) {
        params.append('sucursal_id', formData.sucursal_id)
      }
      if (selectedConfig?.fields.empleado && formData.empleado_id && formData.empleado_id !== 'all') {
        params.append('empleado_id', formData.empleado_id)
      }
      if (selectedConfig?.fields.estado && formData.estado && formData.estado !== 'all') {
        params.append('estado', formData.estado)
      }

      // Generar URL del endpoint de reporte
      const reportUrl = `/api/rrhh/reportes?${params.toString()}`

      // Crear enlace temporal para descarga
      const link = document.createElement('a')
      link.href = reportUrl
      link.download = `reporte_${selectedReport}_${new Date().toISOString().split('T')[0]}.${formData.formato === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      if (selectedConfig) {
        showToast(
          'success',
          `El reporte de ${selectedConfig.title.toLowerCase()} se está descargando`,
          'Reporte generado'
        )
      } else {
        showToast('success', 'El reporte se está descargando', 'Reporte generado')
      }

    } catch (error) {
      console.error('Error generando reporte:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al generar el reporte',
        'Error al generar reporte'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ]

  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de selección de reporte */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Reporte</CardTitle>
              <CardDescription>
                Elige el tipo de reporte que deseas generar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportConfigs.map((config) => (
                <div
                  key={config.type}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedReport === config.type
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedReport(config.type)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color} text-white`}>
                      {config.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{config.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {config.description}
                      </p>
                    </div>
                    {selectedReport === config.type && (
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Panel de configuración */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Reporte</CardTitle>
              <CardDescription>
                {selectedConfig
                  ? `Configura los filtros para el reporte: ${selectedConfig.title}`
                  : 'Selecciona un tipo de reporte para configurar los filtros'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formato del reporte */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Formato del Reporte</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="formato"
                      value="excel"
                      checked={formData.formato === 'excel'}
                      onChange={(e) => setFormData(prev => ({ ...prev, formato: e.target.value as 'excel' }))}
                      className="text-primary"
                    />
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      📊 Excel (.xlsx)
                    </Badge>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="formato"
                      value="pdf"
                      checked={formData.formato === 'pdf'}
                      onChange={(e) => setFormData(prev => ({ ...prev, formato: e.target.value as 'pdf' }))}
                      className="text-primary"
                    />
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      📄 PDF
                    </Badge>
                  </label>
                </div>
              </div>

              {/* Filtros dinámicos */}
              {selectedConfig && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Filtros</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Fecha desde */}
                    {selectedConfig.fields.fecha_desde && (
                      <div className="space-y-2">
                        <Label htmlFor="fecha_desde">Fecha Desde</Label>
                        <Input
                          id="fecha_desde"
                          type="date"
                          value={formData.fecha_desde}
                          onChange={(e) => setFormData(prev => ({ ...prev, fecha_desde: e.target.value }))}
                        />
                      </div>
                    )}

                    {/* Fecha hasta */}
                    {selectedConfig.fields.fecha_hasta && (
                      <div className="space-y-2">
                        <Label htmlFor="fecha_hasta">Fecha Hasta</Label>
                        <Input
                          id="fecha_hasta"
                          type="date"
                          value={formData.fecha_hasta}
                          onChange={(e) => setFormData(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                        />
                      </div>
                    )}

                    {/* Mes */}
                    {selectedConfig.fields.mes && (
                      <div className="space-y-2">
                        <Label htmlFor="mes">Mes</Label>
                        <Select
                          value={formData.mes.toString()}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, mes: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {meses.map((mes) => (
                              <SelectItem key={mes.value} value={mes.value.toString()}>
                                {mes.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Año */}
                    {selectedConfig.fields.anio && (
                      <div className="space-y-2">
                        <Label htmlFor="anio">Año</Label>
                        <Select
                          value={formData.anio.toString()}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, anio: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {anios.map((anio) => (
                              <SelectItem key={anio} value={anio.toString()}>
                                {anio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Empleado */}
                    {selectedConfig.fields.empleado && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="empleado_id">Empleado (opcional)</Label>
                        <Select
                          value={formData.empleado_id || 'all'}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, empleado_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los empleados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los empleados</SelectItem>
                            {/* Aquí se cargarían los empleados dinámicamente */}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Estado */}
                    {selectedConfig.fields.estado && (
                      <div className="space-y-2">
                        <Label htmlFor="estado">Estado</Label>
                        <Select
                          value={formData.estado || 'all'}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, estado: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Todos los estados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            {selectedReport === 'liquidaciones' && (
                              <>
                                <SelectItem value="borrador">Borrador</SelectItem>
                                <SelectItem value="calculada">Calculada</SelectItem>
                                <SelectItem value="aprobada">Aprobada</SelectItem>
                                <SelectItem value="pagada">Pagada</SelectItem>
                              </>
                            )}
                            {selectedReport === 'adelantos' && (
                              <>
                                <SelectItem value="true">Aprobados</SelectItem>
                                <SelectItem value="false">Pendientes</SelectItem>
                              </>
                            )}
                            {selectedReport === 'licencias' && (
                              <>
                                <SelectItem value="true">Aprobadas</SelectItem>
                                <SelectItem value="false">Pendientes</SelectItem>
                              </>
                            )}
                            {selectedReport === 'empleados' && (
                              <>
                                <SelectItem value="true">Activos</SelectItem>
                                <SelectItem value="false">Inactivos</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botón de generación */}
              <div className="pt-6 border-t">
                <Button
                  onClick={handleGenerateReport}
                  disabled={!selectedReport || isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generando Reporte...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Generar Reporte {selectedConfig ? `de ${selectedConfig.title}` : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
