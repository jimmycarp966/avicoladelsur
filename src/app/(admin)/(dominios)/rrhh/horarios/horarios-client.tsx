'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { RefreshCw, Clock3, UserCheck, UserX, Database, CheckSquare, CalendarSync } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerHorariosHoyDesdeHikAction, sincronizarMesDesdeHikAction } from '@/actions/rrhh-horarios.actions'
import type { HorariosHoyData } from '@/types/domain.types'

export function HorariosClient() {
  const { showToast } = useNotificationStore()
  const [isPending, startTransition] = useTransition()
  const [isSyncingMes, setIsSyncingMes] = useState(false)
  const [data, setData] = useState<HorariosHoyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])

  const now = new Date()
  const [syncMes, setSyncMes] = useState(now.getMonth() + 1)
  const [syncAnio, setSyncAnio] = useState(now.getFullYear())

  const loadData = useCallback((targetDate?: string) => {
    const dateToQuery = targetDate || fecha
    startTransition(async () => {
      const result = await obtenerHorariosHoyDesdeHikAction(dateToQuery)
      if (!result.success || !result.data) {
        const message = result.error || 'No se pudieron cargar horarios.'
        setError(message)
        setData(null)
        showToast('error', message, 'Hik-Connect')
        return
      }

      setError(null)
      setData(result.data)

      if (result.data.warnings.length > 0) {
        showToast('warning', `Carga con advertencias (${result.data.warnings.length}).`, 'Hik-Connect')
      }
    })
  }, [showToast, fecha])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSincronizarMes = useCallback(async () => {
    setIsSyncingMes(true)
    try {
      const result = await sincronizarMesDesdeHikAction(syncMes, syncAnio)
      if (result.success && result.data) {
        showToast(
          'success',
          `${result.data.registros_sincronizados} registros sincronizados en ${result.data.dias_procesados} días.`,
          'Sync Mes HikConnect',
        )
      } else {
        showToast('error', result.error || 'Error al sincronizar mes.', 'Sync Mes HikConnect')
      }
    } finally {
      setIsSyncingMes(false)
    }
  }, [syncMes, syncAnio, showToast])

  const stats = useMemo(() => {
    const registros = data?.registros || []
    const mapeados = registros.filter((item) => item.mapeado).length
    const noMapeados = registros.length - mapeados
    const completos = registros.filter((item) => item.hora_entrada && item.hora_salida).length

    return {
      totalEventos: data?.total_eventos || 0,
      totalRegistros: registros.length,
      mapeados,
      noMapeados,
      completos,
      sincronizados: data?.sincronizados || 0,
    }
  }, [data])

  const mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const aniosDisponibles = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Horarios"
        description="Lectura de marcaciones de entrada y salida desde Hik-Connect."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Sync día */}
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm"
            />
            <Button onClick={() => loadData(fecha)} disabled={isPending}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
              Ver día
            </Button>
            {/* Sync mes completo */}
            <div className="flex items-center gap-1 border-l pl-2">
              <select
                value={syncMes}
                onChange={(e) => setSyncMes(Number(e.target.value))}
                className="h-9 rounded-md border px-2 text-sm"
              >
                {mesesNombres.map((nombre, i) => (
                  <option key={i + 1} value={i + 1}>{nombre}</option>
                ))}
              </select>
              <select
                value={syncAnio}
                onChange={(e) => setSyncAnio(Number(e.target.value))}
                className="h-9 rounded-md border px-2 text-sm"
              >
                {aniosDisponibles.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <Button variant="outline" onClick={handleSincronizarMes} disabled={isSyncingMes}>
                <CalendarSync className={`w-4 h-4 mr-2 ${isSyncingMes ? 'animate-spin' : ''}`} />
                {isSyncingMes ? 'Sincronizando...' : 'Sincronizar Mes'}
              </Button>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Eventos Crudos" value={stats.totalEventos} subtitle="Recibidos desde Hik" icon={Database} variant="primary" />
        <StatCard title="Personas Detectadas" value={stats.totalRegistros} subtitle="Con al menos una marcación" icon={Clock3} variant="info" />
        <StatCard title="Mapeados" value={stats.mapeados} subtitle="Vinculados a empleados RRHH" icon={UserCheck} variant="success" />
        <StatCard title="No Mapeados" value={stats.noMapeados} subtitle="Sin match por documento" icon={UserX} variant="warning" />
        <StatCard title="Sincronizados" value={stats.sincronizados} subtitle="Escritos en Asistencia" icon={CheckSquare} variant="success" />
      </div>

      {stats.sincronizados > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{stats.sincronizados}</strong> marcaciones se sincronizaron automáticamente con <strong>Asistencia</strong> (RRHH → Asistencia).
            Los registros editados manualmente no se sobrescriben.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Marcaciones del Día</CardTitle>
          <CardDescription>
            Fecha de negocio: <strong>{data?.fecha || '-'}</strong>. Registros completos (entrada + salida): {stats.completos}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && data?.warnings?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium mb-2">Advertencias de integración:</p>
              <ul className="list-disc pl-5 space-y-1">
                {data.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Empleado</th>
                  <th className="text-left px-4 py-3 font-medium">Documento</th>
                  <th className="text-left px-4 py-3 font-medium text-blue-700">Ent. Mañana</th>
                  <th className="text-left px-4 py-3 font-medium text-blue-700">Sal. Mañana</th>
                  <th className="text-left px-4 py-3 font-medium text-orange-700">Ent. Tarde</th>
                  <th className="text-left px-4 py-3 font-medium text-orange-700">Sal. Tarde</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(data?.registros || []).length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      {isPending ? 'Consultando Hik-Connect...' : 'Sin marcaciones para mostrar en el día seleccionado.'}
                    </td>
                  </tr>
                ) : (
                  (data?.registros || []).map((item) => (
                    <tr key={`${item.employee_no}-${item.empleado_id || 'na'}`} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.empleado_nombre || item.employee_no}</div>
                        {!item.mapeado && (
                          <div className="text-xs text-amber-600">No mapeado — código: {item.employee_no}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.dni || item.employee_no}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{item.hora_entrada_manana || '-'}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{item.hora_salida_manana || '-'}</td>
                      <td className="px-4 py-3 font-mono text-orange-700">{item.hora_entrada_tarde || '-'}</td>
                      <td className="px-4 py-3 font-mono text-orange-700">{item.hora_salida_tarde || '-'}</td>
                      <td className="px-4 py-3">
                        {item.mapeado ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Mapeado</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">No mapeado</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
