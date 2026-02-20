'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNotificationStore } from '@/store/notificationStore'
import {
  aprobarLiquidacionAction,
  autorizarPagoLiquidacionAction,
  actualizarLiquidacionControlAction,
  marcarLiquidacionPagadaAction,
  recalcularLiquidacionAction,
  upsertLiquidacionJornadaAction,
} from '@/actions/rrhh.actions'
import type { AdelantoCuota, Liquidacion, LiquidacionJornada } from '@/types/domain.types'

type CuotaWithPlan = AdelantoCuota & {
  plan?: {
    tipo?: string
    monto_total?: number
    descripcion?: string
    cantidad_cuotas?: number
  }
}

type Props = {
  liquidacion: Liquidacion
  jornadas: LiquidacionJornada[]
  cuotas: CuotaWithPlan[]
}

function toNum(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

function getOrigenBadge(origen: string | null | undefined) {
  switch (origen) {
    case 'hik':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
          HIK
        </Badge>
      )
    case 'asistencia':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
          Asist.
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200 text-xs">
          Manual
        </Badge>
      )
  }
}

export function LiquidacionDetalleClient({ liquidacion, jornadas, cuotas }: Props) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [rows, setRows] = useState<LiquidacionJornada[]>(jornadas)
  const [loading, setLoading] = useState(false)

  // Sincronizar rows cuando el Server Component se refresca con nuevas jornadas
  useEffect(() => {
    setRows(jornadas)
  }, [jornadas])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<LiquidacionJornada | null>(null)

  const [control, setControl] = useState({
    puesto_override: liquidacion.puesto_override || '',
    dias_cajero: liquidacion.dias_cajero || 0,
    diferencia_turno_cajero: liquidacion.diferencia_turno_cajero || 0,
    orden_pago: liquidacion.orden_pago || 0,
    observaciones: liquidacion.observaciones || '',
  })

  const [newRow, setNewRow] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'general',
    tarea: '',
    horas_mensuales: 0,
    horas_adicionales: 0,
    turno_especial_unidades: 0,
    tarifa_hora_base: liquidacion.valor_hora || 0,
    tarifa_hora_extra: liquidacion.valor_hora || 0,
    tarifa_turno_especial: 0,
    observaciones: '',
  })

  const [motivoNoAutorizado, setMotivoNoAutorizado] = useState(liquidacion.motivo_no_autorizado || '')

  const cuotasPeriodo = useMemo(() => {
    return cuotas.filter(
      (c) => c.periodo_mes === liquidacion.periodo_mes && c.periodo_anio === liquidacion.periodo_anio,
    )
  }, [cuotas, liquidacion.periodo_mes, liquidacion.periodo_anio])

  const control30Anticipos = liquidacion.control_30_anticipos ?? 0
  const control30Limite = liquidacion.control_30_limite ?? 0
  const control30Pct =
    control30Limite > 0 ? Math.min(Math.round((control30Anticipos / control30Limite) * 100), 100) : 0

  const handleSaveRow = async (row: LiquidacionJornada) => {
    setLoading(true)
    try {
      const result = await upsertLiquidacionJornadaAction(liquidacion.id, {
        id: row.id,
        fecha: row.fecha,
        turno: row.turno,
        tarea: row.tarea,
        horas_mensuales: row.horas_mensuales,
        horas_adicionales: row.horas_adicionales,
        turno_especial_unidades: row.turno_especial_unidades,
        tarifa_hora_base: row.tarifa_hora_base,
        tarifa_hora_extra: row.tarifa_hora_extra,
        tarifa_turno_especial: row.tarifa_turno_especial,
        origen: row.origen,
        observaciones: row.observaciones,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar la jornada', 'Error')
        return
      }

      showToast('success', 'Jornada guardada y liquidacion recalculada', 'Guardado')
      setSheetOpen(false)
      setEditingRow(null)
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar jornada', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRow = async () => {
    setLoading(true)
    try {
      const result = await upsertLiquidacionJornadaAction(liquidacion.id, {
        fecha: newRow.fecha,
        turno: newRow.turno,
        tarea: newRow.tarea,
        horas_mensuales: newRow.horas_mensuales,
        horas_adicionales: newRow.horas_adicionales,
        turno_especial_unidades: newRow.turno_especial_unidades,
        tarifa_hora_base: newRow.tarifa_hora_base,
        tarifa_hora_extra: newRow.tarifa_hora_extra,
        tarifa_turno_especial: newRow.tarifa_turno_especial,
        origen: 'manual',
        observaciones: newRow.observaciones,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo agregar la jornada', 'Error')
        return
      }

      setNewRow((prev) => ({
        ...prev,
        tarea: '',
        horas_mensuales: 0,
        horas_adicionales: 0,
        turno_especial_unidades: 0,
        observaciones: '',
      }))
      showToast('success', 'Fila agregada correctamente', 'Guardado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al agregar fila', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveControl = async () => {
    setLoading(true)
    try {
      const result = await actualizarLiquidacionControlAction(liquidacion.id, {
        puesto_override: control.puesto_override || null,
        dias_cajero: control.dias_cajero,
        diferencia_turno_cajero: control.diferencia_turno_cajero,
        orden_pago: control.orden_pago || null,
        observaciones: control.observaciones || null,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar control', 'Error')
        return
      }

      showToast('success', 'Control actualizado y liquidacion recalculada', 'Guardado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar control', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleRecalcular = async () => {
    setLoading(true)
    try {
      const result = await recalcularLiquidacionAction(liquidacion.id)
      if (!result.success) {
        showToast('error', result.error || 'No se pudo recalcular', 'Error')
        return
      }
      showToast('success', 'Liquidacion recalculada', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleAutorizar = async (autorizado: boolean) => {
    setLoading(true)
    try {
      const result = await autorizarPagoLiquidacionAction(
        liquidacion.id,
        autorizado,
        autorizado ? undefined : motivoNoAutorizado,
      )
      if (!result.success) {
        showToast('error', result.error || 'No se pudo actualizar autorizacion', 'Error')
        return
      }
      showToast('success', autorizado ? 'Pago autorizado' : 'Pago no autorizado', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleAprobar = async () => {
    setLoading(true)
    try {
      const result = await aprobarLiquidacionAction(liquidacion.id)
      if (!result.success) {
        showToast('error', result.error || 'No se pudo aprobar', 'Error')
        return
      }
      showToast('success', 'Liquidacion aprobada', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handlePagar = async () => {
    setLoading(true)
    try {
      const result = await marcarLiquidacionPagadaAction(liquidacion.id)
      if (!result.success) {
        showToast('error', result.error || 'No se pudo marcar como pagada', 'Error')
        return
      }
      showToast('success', 'Liquidacion marcada como pagada', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const rowTotal = (row: LiquidacionJornada) => {
    const base = (row.horas_mensuales || 0) * (row.tarifa_hora_base || 0)
    const extra = (row.horas_adicionales || 0) * (row.tarifa_hora_extra || 0)
    const especial = (row.turno_especial_unidades || 0) * (row.tarifa_turno_especial || 0)
    return base + extra + especial
  }

  const openEditSheet = (row: LiquidacionJornada) => {
    setEditingRow({ ...row })
    setSheetOpen(true)
  }

  const updateEditingRow = (patch: Partial<LiquidacionJornada>) => {
    setEditingRow((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  return (
    <div className="space-y-6">
      {/* Stat cards — siempre visibles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total sin descuentos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(liquidacion.total_sin_descuentos)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Anticipos periodo</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(liquidacion.control_30_anticipos)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total a percibir</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-blue-600">
            {formatMoney(liquidacion.total_neto)}
          </CardContent>
        </Card>

        {/* QW-3: Progress bar para Control 30% */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Control 30%</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs">
                {formatMoney(control30Anticipos)} / {formatMoney(control30Limite)}
              </span>
              <span
                className={`font-semibold text-sm ${
                  control30Pct >= 100
                    ? 'text-red-600'
                    : control30Pct >= 70
                      ? 'text-amber-600'
                      : 'text-green-600'
                }`}
              >
                {control30Pct}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  control30Pct >= 100
                    ? 'bg-red-500'
                    : control30Pct >= 70
                      ? 'bg-amber-400'
                      : 'bg-green-500'
                }`}
                style={{ width: `${control30Pct}%` }}
              />
            </div>
            {liquidacion.control_30_superado && (
              <Badge variant="destructive" className="text-xs">
                Superado
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MM-2: Tabs de secciones */}
      <Tabs defaultValue="control" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="control">Control y Autorización</TabsTrigger>
          <TabsTrigger value="jornadas" className="flex items-center gap-2">
            Detalle de Horas
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5">
              {rows.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="anticipos" className="flex items-center gap-2">
            Anticipos
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5">
              {cuotasPeriodo.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Control y Autorización */}
        <TabsContent value="control" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Control de liquidación</CardTitle>
              <CardDescription>Campos operativos equivalentes a la planilla principal.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Puesto override</Label>
                <Input
                  value={control.puesto_override}
                  onChange={(e) => setControl((p) => ({ ...p, puesto_override: e.target.value }))}
                />
              </div>
              <div>
                <Label>Orden de pago</Label>
                <Input
                  type="number"
                  value={control.orden_pago}
                  onChange={(e) => setControl((p) => ({ ...p, orden_pago: toNum(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Días como cajero</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={control.dias_cajero}
                  onChange={(e) => setControl((p) => ({ ...p, dias_cajero: toNum(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Diferencia turno cajero</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={control.diferencia_turno_cajero}
                  onChange={(e) =>
                    setControl((p) => ({ ...p, diferencia_turno_cajero: toNum(e.target.value) }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={control.observaciones}
                  onChange={(e) => setControl((p) => ({ ...p, observaciones: e.target.value }))}
                />
              </div>

              {/* QW-2: Botones de edición */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleSaveControl} disabled={loading}>
                    Guardar control
                  </Button>
                  <Button variant="outline" onClick={handleRecalcular} disabled={loading}>
                    Recalcular
                  </Button>
                </div>

                {/* QW-2: Separador de acciones de flujo */}
                <Separator />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Acciones de flujo
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleAprobar}
                    disabled={
                      loading ||
                      liquidacion.estado === 'aprobada' ||
                      liquidacion.estado === 'pagada'
                    }
                  >
                    Aprobar
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handlePagar}
                    disabled={loading || liquidacion.estado !== 'aprobada'}
                  >
                    Marcar pagada
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Autorización de pago</CardTitle>
              <CardDescription>Si supera control 30%, requiere autorización manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={liquidacion.pago_autorizado ? 'outline' : 'secondary'}>
                  {liquidacion.pago_autorizado ? 'Autorizado' : 'Pendiente'}
                </Badge>
                <Button size="sm" onClick={() => handleAutorizar(true)} disabled={loading}>
                  Autorizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAutorizar(false)} disabled={loading}>
                  No autorizar
                </Button>
              </div>
              <div>
                <Label>Motivo no autorizado</Label>
                <Textarea
                  value={motivoNoAutorizado}
                  onChange={(e) => setMotivoNoAutorizado(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Detalle de Horas — MM-3: Tabla read-only + Sheet */}
        <TabsContent value="jornadas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle control hs</CardTitle>
              <CardDescription>
                Haga clic en el ícono de lápiz para editar una jornada. Cada guardado recalcula la
                liquidación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Tarea</TableHead>
                      <TableHead className="text-right">Hs Mens.</TableHead>
                      <TableHead className="text-right">Hs Adic.</TableHead>
                      <TableHead className="text-right">T. Especial</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                          No hay jornadas registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.fecha?.slice(0, 10) ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm">{row.turno || 'general'}</TableCell>
                          <TableCell className="text-sm max-w-[120px] truncate">{row.tarea || '—'}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {row.horas_mensuales ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {row.horas_adicionales ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {row.turno_especial_unidades ?? 0}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium tabular-nums">
                            {formatMoney(rowTotal(row))}
                          </TableCell>
                          <TableCell>{getOrigenBadge(row.origen)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditSheet(row)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Formulario nueva fila */}
              <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-medium text-muted-foreground">Agregar jornada manual</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Fecha</Label>
                    <Input
                      type="date"
                      value={newRow.fecha}
                      onChange={(e) => setNewRow((p) => ({ ...p, fecha: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Turno</Label>
                    <Input
                      placeholder="ej: general"
                      value={newRow.turno}
                      onChange={(e) => setNewRow((p) => ({ ...p, turno: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tarea</Label>
                    <Input
                      placeholder="Descripción"
                      value={newRow.tarea}
                      onChange={(e) => setNewRow((p) => ({ ...p, tarea: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hs mensuales</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.horas_mensuales}
                      onChange={(e) =>
                        setNewRow((p) => ({ ...p, horas_mensuales: toNum(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hs adicionales</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.horas_adicionales}
                      onChange={(e) =>
                        setNewRow((p) => ({ ...p, horas_adicionales: toNum(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Turno especial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.turno_especial_unidades}
                      onChange={(e) =>
                        setNewRow((p) => ({ ...p, turno_especial_unidades: toNum(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tarifa base</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.tarifa_hora_base}
                      onChange={(e) =>
                        setNewRow((p) => ({ ...p, tarifa_hora_base: toNum(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tarifa extra</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.tarifa_hora_extra}
                      onChange={(e) =>
                        setNewRow((p) => ({ ...p, tarifa_hora_extra: toNum(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tarifa especial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.tarifa_turno_especial}
                      onChange={(e) =>
                        setNewRow((p) => ({ ...p, tarifa_turno_especial: toNum(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-3">
                    <Label className="text-xs">Observaciones</Label>
                    <Input
                      placeholder="Opcional"
                      value={newRow.observaciones}
                      onChange={(e) => setNewRow((p) => ({ ...p, observaciones: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={handleAddRow} disabled={loading} size="sm">
                  Agregar fila manual
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Anticipos */}
        <TabsContent value="anticipos">
          <Card>
            <CardHeader>
              <CardTitle>Cuotas de anticipos del período</CardTitle>
            </CardHeader>
            <CardContent>
              {cuotasPeriodo.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay cuotas aplicadas para este período.
                </p>
              ) : (
                <div className="space-y-2">
                  {cuotasPeriodo.map((cuota) => (
                    <div
                      key={cuota.id}
                      className="flex items-center justify-between border rounded-md p-3"
                    >
                      <div className="text-sm">
                        <span className="font-medium">Cuota #{cuota.nro_cuota}</span>
                        <span className="text-muted-foreground ml-2">
                          — {cuota.plan?.tipo || 'N/A'}
                        </span>
                        {cuota.plan?.descripcion && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({cuota.plan.descripcion})
                          </span>
                        )}
                      </div>
                      <div className="font-semibold tabular-nums">{formatMoney(cuota.monto_cuota)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                    <span>Total anticipos período</span>
                    <span>{formatMoney(cuotasPeriodo.reduce((s, c) => s + (c.monto_cuota ?? 0), 0))}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MM-3: Sheet lateral para edición de jornada */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Jornada</SheetTitle>
          </SheetHeader>

          {editingRow && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={editingRow.fecha?.slice(0, 10) ?? ''}
                    onChange={(e) => updateEditingRow({ fecha: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Turno</Label>
                  <Input
                    value={editingRow.turno || ''}
                    onChange={(e) => updateEditingRow({ turno: e.target.value })}
                    placeholder="ej: general"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tarea</Label>
                  <Input
                    value={editingRow.tarea || ''}
                    onChange={(e) => updateEditingRow({ tarea: e.target.value })}
                    placeholder="Descripción"
                  />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium">Horas y unidades</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Hs mensuales</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRow.horas_mensuales ?? 0}
                    onChange={(e) => updateEditingRow({ horas_mensuales: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Hs adicionales</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRow.horas_adicionales ?? 0}
                    onChange={(e) => updateEditingRow({ horas_adicionales: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Turno especial (unidades)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRow.turno_especial_unidades ?? 0}
                    onChange={(e) => updateEditingRow({ turno_especial_unidades: toNum(e.target.value) })}
                  />
                </div>
              </div>

              <Separator />
              <p className="text-sm font-medium">Tarifas</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Tarifa hora base</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRow.tarifa_hora_base ?? 0}
                    onChange={(e) => updateEditingRow({ tarifa_hora_base: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tarifa hora extra</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRow.tarifa_hora_extra ?? 0}
                    onChange={(e) => updateEditingRow({ tarifa_hora_extra: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tarifa turno especial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRow.tarifa_turno_especial ?? 0}
                    onChange={(e) => updateEditingRow({ tarifa_turno_especial: toNum(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea
                  value={editingRow.observaciones || ''}
                  onChange={(e) => updateEditingRow({ observaciones: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="pt-2 border-t text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total jornada:</span>
                  <span>{formatMoney(rowTotal(editingRow))}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    setRows((prev) =>
                      prev.map((r) => (r.id === editingRow.id ? { ...editingRow } : r)),
                    )
                    void handleSaveRow(editingRow)
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  Guardar y recalcular
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSheetOpen(false)
                    setEditingRow(null)
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
