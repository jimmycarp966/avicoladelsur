'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { CalendarSync, CheckSquare, Clock3, Database, RefreshCw, TriangleAlert, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerHorariosHoyDesdeHikAction, sincronizarMesDesdeHikAction } from '@/actions/rrhh-horarios.actions'
import { getTodayArgentina } from '@/lib/utils'
import type { HorarioDiarioEmpleado, HorariosHoyData } from '@/types/domain.types'

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function getEstadoBadge(row: HorarioDiarioEmpleado) {
  switch (row.estado_consolidado) {
    case 'vacaciones':
      return <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Vacaciones</Badge>
    case 'enfermedad':
      return <Badge className="bg-red-100 text-red-900 hover:bg-red-100">Enfermedad</Badge>
    case 'ausente':
      return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Ausente</Badge>
    case 'presente':
    default:
      return <Badge className="bg-green-100 text-green-900 hover:bg-green-100">Presente</Badge>
  }
}

function getRowTone(row: HorarioDiarioEmpleado) {
  switch (row.estado_consolidado) {
    case 'ausente':
      return 'bg-amber-50/70'
    case 'vacaciones':
      return 'bg-emerald-50/60'
    case 'enfermedad':
      return 'bg-red-50/60'
    default:
      return ''
  }
}

export function HorariosClient() {
  const { showToast } = useNotificationStore()
  const [isPending, startTransition] = useTransition()
  const [isSyncingMes, setIsSyncingMes] = useState(false)
  const [data, setData] = useState<HorariosHoyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fechaArgentinaHoy = getTodayArgentina()
  const [fecha, setFecha] = useState(() => fechaArgentinaHoy)
  const [syncMes, setSyncMes] = useState(() => Number(fechaArgentinaHoy.slice(5, 7)))
  const [syncAnio, setSyncAnio] = useState(() => Number(fechaArgentinaHoy.slice(0, 4)))

  const loadData = useCallback((targetDate: string) => {
    if (!ISO_DATE_REGEX.test(targetDate)) {
      const message = 'Fecha invalida. Selecciona una fecha completa.'
      setError(message)
      showToast('error', message, 'Horarios')
      return
    }

    startTransition(async () => {
      const result = await obtenerHorariosHoyDesdeHikAction(targetDate)
      if (!result.success || !result.data) {
        const message = result.error || 'No se pudieron cargar horarios.'
        setError(message)
        setData(null)
        showToast('error', message, 'Horarios')
        return
      }

      setError(null)
      setData(result.data)

      if (result.data.warnings.length > 0) {
        showToast('warning', `Se cargaron horarios con ${result.data.warnings.length} advertencia(s).`, 'Horarios')
      }
    })
  }, [showToast])

  useEffect(() => {
    if (ISO_DATE_REGEX.test(fecha)) {
      loadData(fecha)
    }
  }, [fecha, loadData])

  const handleSincronizarMes = useCallback(async () => {
    setIsSyncingMes(true)
    try {
      const result = await sincronizarMesDesdeHikAction(syncMes, syncAnio)
      if (result.success && result.data) {
        showToast(
          'success',
          `${result.data.registros_sincronizados} registros sincronizados en ${result.data.dias_procesados} dias.`,
          'Sync mensual',
        )
      } else {
        showToast('error', result.error || 'Error al sincronizar el mes.', 'Sync mensual')
      }
    } finally {
      setIsSyncingMes(false)
    }
  }, [showToast, syncAnio, syncMes])

  const stats = useMemo(() => {
    const registros = data?.registros || []
    const visibles = registros.filter((item) => item.mapeado)
    const ausentes = visibles.filter((item) => item.estado_consolidado === 'ausente')
    const presentes = visibles.filter((item) => item.estado_consolidado === 'presente')
    const licenciasActivas = visibles.filter((item) => item.licencia_activa)
    const noMapeados = registros.filter((item) => !item.mapeado)
    const completos = visibles.filter((item) => item.hora_entrada && item.hora_salida)

    return {
      totalEventos: data?.total_eventos || 0,
      totalPersonas: visibles.length,
      presentes,
      ausentes,
      licenciasActivas,
      noMapeados,
      completos,
      sincronizados: data?.sincronizados || 0,
    }
  }, [data])

  const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const aniosDisponibles = [syncAnio - 1, syncAnio]
  const fechaValida = ISO_DATE_REGEX.test(fecha)
  const consultaIncompleta = Boolean(data?.consulta_incompleta)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Horarios"
        description="Vista rapida del dia para administracion: presentes, ausentes, licencias activas y sincronizacion con asistencia."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="h-9 rounded-md border px-3 text-sm"
            />
            <Button onClick={() => loadData(fecha)} disabled={isPending || !fechaValida}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
              Ver dia
            </Button>
            <div className="flex items-center gap-1 border-l pl-2">
              <select
                value={syncMes}
                onChange={(event) => setSyncMes(Number(event.target.value))}
                className="h-9 rounded-md border px-2 text-sm"
              >
                {mesesNombres.map((nombre, index) => (
                  <option key={index + 1} value={index + 1}>{nombre}</option>
                ))}
              </select>
              <select
                value={syncAnio}
                onChange={(event) => setSyncAnio(Number(event.target.value))}
                className="h-9 rounded-md border px-2 text-sm"
              >
                {aniosDisponibles.map((anio) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))}
              </select>
              <Button variant="outline" onClick={handleSincronizarMes} disabled={isSyncingMes}>
                <CalendarSync className={`mr-2 h-4 w-4 ${isSyncingMes ? 'animate-spin' : ''}`} />
                {isSyncingMes ? 'Sincronizando...' : 'Sincronizar mes'}
              </Button>
            </div>
          </div>
        }
      />

      {consultaIncompleta && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 shadow-sm">
          <AlertTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            Cobertura parcial de Hik-Connect
          </AlertTitle>
          <AlertDescription className="text-amber-900">
            {data?.consulta_incompleta_motivo || 'La consulta puede estar incompleta por paginacion.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Presentes"
          value={stats.presentes.length}
          subtitle={`${stats.completos.length} con entrada y salida visible`}
          icon={UserCheck}
          variant="success"
        />
        <StatCard
          title="Ausentes"
          value={stats.ausentes.length}
          subtitle="Sin marcacion ni licencia prioritaria del dia"
          icon={UserX}
          variant="warning"
          action={
            stats.ausentes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {stats.ausentes.slice(0, 4).map((row) => (
                  <Badge key={row.empleado_id || row.employee_no} variant="outline" className="border-amber-200 bg-white text-amber-900">
                    {row.empleado_nombre}
                  </Badge>
                ))}
                {stats.ausentes.length > 4 && (
                  <span className="text-xs text-muted-foreground">+{stats.ausentes.length - 4} mas</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin ausentes para la fecha seleccionada.</p>
            )
          }
        />
        <StatCard
          title="Licencias activas"
          value={stats.licenciasActivas.length}
          subtitle="Aprobadas y vigentes durante el dia"
          icon={Clock3}
          variant="info"
        />
        <StatCard
          title="Sincronizados"
          value={stats.sincronizados}
          subtitle={`${stats.noMapeados.length} marcaciones sin vinculo de empleado`}
          icon={CheckSquare}
          variant="primary"
        />
      </div>

      {(stats.noMapeados.length > 0 || stats.totalEventos > 0) && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-muted-foreground" />
              Resumen tecnico
            </CardTitle>
            <CardDescription>
              Informacion secundaria para revisar integracion y mapeos, sin ocupar el centro de la vista.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <Badge variant="outline">Eventos Hik: {stats.totalEventos}</Badge>
            <Badge variant="outline">Personas visibles: {stats.totalPersonas}</Badge>
            <Badge variant="outline">Sin mapear: {stats.noMapeados.length}</Badge>
            {data?.warnings?.length ? <Badge variant="outline">Advertencias: {data.warnings.length}</Badge> : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listado operativo del dia</CardTitle>
          <CardDescription>
            Fecha de negocio: <strong>{data?.fecha || '-'}</strong>. Estado principal por persona: presente, ausente, vacaciones o enfermedad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && data?.warnings?.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Advertencias tecnicas</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Persona</th>
                  <th className="px-4 py-3 text-left font-medium">Documento</th>
                  <th className="px-4 py-3 text-left font-medium text-blue-700">Ent. manana</th>
                  <th className="px-4 py-3 text-left font-medium text-blue-700">Sal. manana</th>
                  <th className="px-4 py-3 text-left font-medium text-orange-700">Ent. tarde</th>
                  <th className="px-4 py-3 text-left font-medium text-orange-700">Sal. tarde</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(data?.registros || []).length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      {isPending ? 'Consultando horarios...' : 'Sin registros para la fecha seleccionada.'}
                    </td>
                  </tr>
                ) : (
                  (data?.registros || []).map((item) => (
                    <tr
                      key={`${item.employee_no}-${item.empleado_id || 'na'}`}
                      className={`border-t transition-colors hover:bg-muted/20 ${getRowTone(item)}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.empleado_nombre || item.employee_no}</div>
                        {item.estado_detalle ? (
                          <div className="mt-1 text-xs text-muted-foreground">{item.estado_detalle}</div>
                        ) : null}
                        {!item.mapeado ? (
                          <div className="mt-1 text-xs text-amber-700">Marcacion sin vinculo con un empleado activo.</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.dni || item.employee_no}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{item.hora_entrada_manana || item.hora_entrada || '-'}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{item.hora_salida_manana || '-'}</td>
                      <td className="px-4 py-3 font-mono text-orange-700">{item.hora_entrada_tarde || '-'}</td>
                      <td className="px-4 py-3 font-mono text-orange-700">{item.hora_salida_tarde || item.hora_salida || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {getEstadoBadge(item)}
                          {item.sincronizado_asistencia ? (
                            <Badge variant="outline" className="border-green-200 bg-white text-green-700">Asistencia sync</Badge>
                          ) : null}
                        </div>
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
