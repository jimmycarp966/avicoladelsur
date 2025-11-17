'use client'

import { useState } from 'react'
import { exportReportSchema, type ExportReportFormData } from '@/lib/schemas/tesoreria.schema'
import { z } from 'zod'
import { useNotificationStore } from '@/store/notificationStore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Download } from 'lucide-react'

const schema = exportReportSchema

export function ReporteExportForm() {
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [tipo, setTipo] = useState<ExportReportFormData['tipo']>('ventas')
  const [formato, setFormato] = useState<ExportReportFormData['formato']>('csv')

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      const payload: ExportReportFormData = { tipo, formato, filtros: {} }
      schema.parse(payload)

      const response = await fetch('/api/reportes/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al generar reporte')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${tipo}-${Date.now()}.${formato}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      showToast('success', 'Reporte generado correctamente')
    } catch (error: any) {
      const message = error instanceof z.ZodError ? error.message : error.message || 'Error al generar reporte'
      showToast('error', message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-l-[3px] border-l-info">
      <CardHeader>
        <CardTitle className="text-info">Exportar datos</CardTitle>
        <CardDescription>Genera un archivo CSV o PDF para compartir o analizar en detalle</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de reporte</label>
            <Select value={tipo} onValueChange={(value) => setTipo(value as ExportReportFormData['tipo'])}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ventas">Ventas por fecha</SelectItem>
                <SelectItem value="gastos">Gastos por categoría</SelectItem>
                <SelectItem value="movimientos_caja">Movimientos de caja</SelectItem>
                <SelectItem value="cuentas_corrientes">Cuentas corrientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Formato</label>
            <Select value={formato} onValueChange={(value) => setFormato(value as 'csv' | 'pdf')}>
              <SelectTrigger>
                <SelectValue placeholder="Formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="button"
          disabled={isLoading}
          onClick={handleDownload}
          className="w-full bg-info hover:bg-info/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

