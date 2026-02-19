'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

export function LiquidacionDetalleClient({ liquidacion, jornadas, cuotas }: Props) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [rows, setRows] = useState<LiquidacionJornada[]>(jornadas)
  const [loading, setLoading] = useState(false)

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
    return cuotas.filter((c) => c.periodo_mes === liquidacion.periodo_mes && c.periodo_anio === liquidacion.periodo_anio)
  }, [cuotas, liquidacion.periodo_mes, liquidacion.periodo_anio])

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
      router.refresh()
    } catch (error) {
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

      setNewRow((prev) => ({ ...prev, tarea: '', horas_mensuales: 0, horas_adicionales: 0, turno_especial_unidades: 0, observaciones: '' }))
      showToast('success', 'Fila agregada correctamente', 'Guardado')
      router.refresh()
    } catch (error) {
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
    } catch (error) {
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total sin descuentos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(liquidacion.total_sin_descuentos)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Anticipos periodo</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(liquidacion.control_30_anticipos)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total a percibir</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-blue-600">{formatMoney(liquidacion.total_neto)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Control 30%</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={liquidacion.control_30_superado ? 'destructive' : 'outline'}>
              {liquidacion.control_30_superado ? 'Superado' : 'OK'}
            </Badge>
            <div className="text-sm text-muted-foreground mt-2">
              Límite: {formatMoney(liquidacion.control_30_limite)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Control de liquidación</CardTitle>
          <CardDescription>Campos operativos equivalentes a la planilla principal.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Puesto override</Label>
            <Input value={control.puesto_override} onChange={(e) => setControl((p) => ({ ...p, puesto_override: e.target.value }))} />
          </div>
          <div>
            <Label>Orden de pago</Label>
            <Input type="number" value={control.orden_pago} onChange={(e) => setControl((p) => ({ ...p, orden_pago: toNum(e.target.value) }))} />
          </div>
          <div>
            <Label>Días como cajero</Label>
            <Input type="number" step="0.01" value={control.dias_cajero} onChange={(e) => setControl((p) => ({ ...p, dias_cajero: toNum(e.target.value) }))} />
          </div>
          <div>
            <Label>Diferencia turno cajero</Label>
            <Input type="number" step="0.01" value={control.diferencia_turno_cajero} onChange={(e) => setControl((p) => ({ ...p, diferencia_turno_cajero: toNum(e.target.value) }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Observaciones</Label>
            <Textarea value={control.observaciones} onChange={(e) => setControl((p) => ({ ...p, observaciones: e.target.value }))} />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={handleSaveControl} disabled={loading}>Guardar control</Button>
            <Button variant="outline" onClick={handleRecalcular} disabled={loading}>Recalcular</Button>
            <Button variant="outline" onClick={handleAprobar} disabled={loading || liquidacion.estado === 'aprobada' || liquidacion.estado === 'pagada'}>Aprobar</Button>
            <Button variant="outline" onClick={handlePagar} disabled={loading || liquidacion.estado !== 'aprobada'}>Marcar pagada</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autorización de pago</CardTitle>
          <CardDescription>Si supera control 30%, requiere autorización manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={liquidacion.pago_autorizado ? 'outline' : 'secondary'}>
              {liquidacion.pago_autorizado ? 'Autorizado' : 'Pendiente'}
            </Badge>
            <Button size="sm" onClick={() => handleAutorizar(true)} disabled={loading}>Autorizar</Button>
            <Button size="sm" variant="outline" onClick={() => handleAutorizar(false)} disabled={loading}>No autorizar</Button>
          </div>
          <div>
            <Label>Motivo no autorizado</Label>
            <Textarea value={motivoNoAutorizado} onChange={(e) => setMotivoNoAutorizado(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle control hs</CardTitle>
          <CardDescription>Edición por jornada/turno. Cada guardado recalcula la liquidación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Hs Mensuales</TableHead>
                  <TableHead>Hs Adicionales</TableHead>
                  <TableHead>Turno Especial</TableHead>
                  <TableHead>Tarifa Base</TableHead>
                  <TableHead>Tarifa Extra</TableHead>
                  <TableHead>Tarifa Especial</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input type="date" value={row.fecha?.slice(0, 10)} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, fecha: e.target.value } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input value={row.turno || 'general'} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, turno: e.target.value } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input value={row.tarea || ''} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, tarea: e.target.value } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={row.horas_mensuales || 0} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, horas_mensuales: toNum(e.target.value) } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={row.horas_adicionales || 0} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, horas_adicionales: toNum(e.target.value) } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={row.turno_especial_unidades || 0} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, turno_especial_unidades: toNum(e.target.value) } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={row.tarifa_hora_base || 0} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, tarifa_hora_base: toNum(e.target.value) } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={row.tarifa_hora_extra || 0} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, tarifa_hora_extra: toNum(e.target.value) } : r))} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={row.tarifa_turno_especial || 0} onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, tarifa_turno_especial: toNum(e.target.value) } : r))} />
                    </TableCell>
                    <TableCell>{formatMoney(rowTotal(row))}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleSaveRow(row)} disabled={loading}>Guardar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <Input type="date" value={newRow.fecha} onChange={(e) => setNewRow((p) => ({ ...p, fecha: e.target.value }))} />
            <Input placeholder="Turno" value={newRow.turno} onChange={(e) => setNewRow((p) => ({ ...p, turno: e.target.value }))} />
            <Input placeholder="Tarea" value={newRow.tarea} onChange={(e) => setNewRow((p) => ({ ...p, tarea: e.target.value }))} />
            <Input type="number" step="0.01" placeholder="Hs mensuales" value={newRow.horas_mensuales} onChange={(e) => setNewRow((p) => ({ ...p, horas_mensuales: toNum(e.target.value) }))} />
            <Input type="number" step="0.01" placeholder="Hs adicionales" value={newRow.horas_adicionales} onChange={(e) => setNewRow((p) => ({ ...p, horas_adicionales: toNum(e.target.value) }))} />
            <Input type="number" step="0.01" placeholder="Turno especial" value={newRow.turno_especial_unidades} onChange={(e) => setNewRow((p) => ({ ...p, turno_especial_unidades: toNum(e.target.value) }))} />
            <Input type="number" step="0.01" placeholder="Tarifa base" value={newRow.tarifa_hora_base} onChange={(e) => setNewRow((p) => ({ ...p, tarifa_hora_base: toNum(e.target.value) }))} />
            <Input type="number" step="0.01" placeholder="Tarifa extra" value={newRow.tarifa_hora_extra} onChange={(e) => setNewRow((p) => ({ ...p, tarifa_hora_extra: toNum(e.target.value) }))} />
            <Input type="number" step="0.01" placeholder="Tarifa especial" value={newRow.tarifa_turno_especial} onChange={(e) => setNewRow((p) => ({ ...p, tarifa_turno_especial: toNum(e.target.value) }))} />
            <Input placeholder="Observaciones" value={newRow.observaciones} onChange={(e) => setNewRow((p) => ({ ...p, observaciones: e.target.value }))} className="md:col-span-2" />
            <Button onClick={handleAddRow} disabled={loading}>Agregar fila manual</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuotas de anticipos del período</CardTitle>
        </CardHeader>
        <CardContent>
          {cuotasPeriodo.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cuotas aplicadas para este período.</p>
          ) : (
            <div className="space-y-2">
              {cuotasPeriodo.map((cuota) => (
                <div key={cuota.id} className="flex items-center justify-between border rounded p-3">
                  <div className="text-sm">
                    Cuota #{cuota.nro_cuota} - {cuota.plan?.tipo || 'N/A'}
                  </div>
                  <div className="font-semibold">{formatMoney(cuota.monto_cuota)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

