'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useNotificationStore } from '@/store/notificationStore'
import {
  aprobarLiquidacionAction,
  autorizarPagoLiquidacionAction,
  actualizarLiquidacionControlAction,
  marcarLiquidacionPagadaAction,
  recalcularLiquidacionAction,
} from '@/actions/rrhh.actions'
import { FieldWithTooltip } from './field-with-tooltip'
import type { Liquidacion, LiquidacionReglaPuesto } from '@/types/domain.types'

function toNum(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

type ConfirmFlowAction = 'aprobar' | 'pagar' | 'no_autorizar'

type LiquidacionControlTabProps = {
  liquidacion: Liquidacion
  puestosDisponibles: Pick<LiquidacionReglaPuesto, 'puesto_codigo'>[]
  onRefresh: () => void
}

export function LiquidacionControlTab({
  liquidacion,
  puestosDisponibles,
  onRefresh,
}: LiquidacionControlTabProps) {
  const { showToast } = useNotificationStore()
  const [loading, setLoading] = useState(false)

  const [control, setControl] = useState({
    puesto_override: liquidacion.puesto_override || '',
    puesto_hs_extra: liquidacion.puesto_hs_extra ?? (null as string | null),
    dias_cajero: liquidacion.dias_cajero || 0,
    diferencia_turno_cajero: liquidacion.diferencia_turno_cajero || 0,
    orden_pago: liquidacion.orden_pago || 0,
    observaciones: liquidacion.observaciones || '',
  })

  const [motivoNoAutorizado, setMotivoNoAutorizado] = useState(liquidacion.motivo_no_autorizado || '')
  const [confirmFlowAction, setConfirmFlowAction] = useState<ConfirmFlowAction | null>(null)
  const trimmedMotivoNoAutorizado = motivoNoAutorizado.trim()

  const control30Anticipos = liquidacion.control_30_anticipos ?? 0
  const control30Limite = liquidacion.control_30_limite ?? 0
  const control30Pct =
    control30Limite > 0 ? Math.min(Math.round((control30Anticipos / control30Limite) * 100), 100) : 0

  const approveBlockedReason =
    liquidacion.estado === 'aprobada' || liquidacion.estado === 'pagada'
      ? 'La liquidacion ya esta aprobada o pagada.'
      : liquidacion.control_30_superado && !liquidacion.pago_autorizado
        ? 'Supera control 30%. Primero autorice el pago.'
        : null

  const payBlockedReason =
    liquidacion.estado !== 'aprobada'
      ? 'Solo se puede pagar una liquidacion aprobada.'
      : null

  const confirmTitle =
    confirmFlowAction === 'aprobar'
      ? 'Confirmar aprobacion'
      : confirmFlowAction === 'pagar'
        ? 'Confirmar pago'
        : 'Confirmar no autorizacion'

  const confirmDescription =
    confirmFlowAction === 'aprobar'
      ? 'Se marcara la liquidacion como aprobada.'
      : confirmFlowAction === 'pagar'
        ? 'Se marcara la liquidacion como pagada.'
        : 'Se registrara la no autorizacion con el motivo cargado.'

  const confirmActionLabel =
    confirmFlowAction === 'aprobar'
      ? 'Aprobar'
      : confirmFlowAction === 'pagar'
        ? 'Marcar pagada'
        : 'No autorizar'

  const handleSaveControl = async () => {
    setLoading(true)
    try {
      const result = await actualizarLiquidacionControlAction(liquidacion.id, {
        puesto_override: control.puesto_override || null,
        puesto_hs_extra: control.puesto_hs_extra || null,
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
      onRefresh()
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
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const handleAutorizar = async (autorizado: boolean) => {
    if (!autorizado && !trimmedMotivoNoAutorizado) {
      showToast('error', 'Ingrese un motivo para no autorizar.', 'Validacion')
      return
    }

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
      onRefresh()
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
      onRefresh()
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
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  const requestAprobar = () => {
    if (approveBlockedReason) {
      showToast('error', approveBlockedReason, 'Accion bloqueada')
      return
    }
    setConfirmFlowAction('aprobar')
  }

  const requestPagar = () => {
    if (payBlockedReason) {
      showToast('error', payBlockedReason, 'Accion bloqueada')
      return
    }
    setConfirmFlowAction('pagar')
  }

  const requestNoAutorizar = () => {
    if (!trimmedMotivoNoAutorizado) {
      showToast('error', 'Ingrese el motivo de no autorizacion antes de continuar.', 'Validacion')
      return
    }
    setConfirmFlowAction('no_autorizar')
  }

  const confirmFlow = async () => {
    const action = confirmFlowAction
    setConfirmFlowAction(null)
    if (!action) return

    if (action === 'aprobar') {
      await handleAprobar()
      return
    }
    if (action === 'pagar') {
      await handlePagar()
      return
    }
    await handleAutorizar(false)
  }

  return (
    <>
      <div className="space-y-4">
        {/* Card 1: Datos de calculo (solo lectura) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos de calculo</CardTitle>
            <CardDescription>Valores de referencia usados para el calculo de esta liquidacion.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <InfoItem label="Sueldo basico" value={formatMoney(liquidacion.sueldo_basico)} />
              <InfoItem label="Valor jornal" value={formatMoney(liquidacion.valor_jornal)} />
              <InfoItem label="Valor hora" value={formatMoney(liquidacion.valor_hora)} />
              <InfoItem label="Dias base" value={String(liquidacion.dias_base ?? '-')} />
              <InfoItem label="Horas jornada" value={String(liquidacion.horas_jornada ?? '-')} />
              <InfoItem label="Puesto resuelto" value={liquidacion.puesto_override || 'Por defecto'} />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Ajustes manuales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ajustes manuales</CardTitle>
            <CardDescription>Campos editables para ajustar la liquidacion antes de aprobar.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldWithTooltip
              label="Sobrescribir puesto"
              tooltip="Si el empleado cambio de puesto este mes, seleccione el nuevo puesto aqui. Solo afecta esta liquidacion."
            >
              <Input
                value={control.puesto_override}
                onChange={(e) => setControl((p) => ({ ...p, puesto_override: e.target.value }))}
              />
            </FieldWithTooltip>

            <FieldWithTooltip
              label="Puesto para horas extra"
              tooltip="Cuando el empleado hizo horas extra en otro rol (ej: almacenista cubriendo reparto), seleccionar ese puesto para que las horas adicionales se paguen a su tarifa."
            >
              <Select
                value={control.puesto_hs_extra ?? 'mismo'}
                onValueChange={(v) =>
                  setControl((p) => ({ ...p, puesto_hs_extra: v === 'mismo' ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mismo puesto (por defecto)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mismo">Mismo puesto (por defecto)</SelectItem>
                  {puestosDisponibles.map((p) => (
                    <SelectItem key={p.puesto_codigo} value={p.puesto_codigo}>
                      {p.puesto_codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWithTooltip>

            <FieldWithTooltip
              label="Dias cajero"
              tooltip="Cantidad de dias que trabajo como cajero para calcular el adicional por caja."
            >
              <Input
                type="number"
                step="0.01"
                value={control.dias_cajero}
                onChange={(e) => setControl((p) => ({ ...p, dias_cajero: toNum(e.target.value) }))}
              />
            </FieldWithTooltip>

            <FieldWithTooltip
              label="Diferencia turno cajero"
              tooltip="Monto adicional por turno de caja. Se multiplica por los dias cajero."
            >
              <Input
                type="number"
                step="0.01"
                value={control.diferencia_turno_cajero}
                onChange={(e) =>
                  setControl((p) => ({ ...p, diferencia_turno_cajero: toNum(e.target.value) }))
                }
              />
            </FieldWithTooltip>

            <FieldWithTooltip
              label="Orden de pago"
              tooltip="Numero secuencial para ordenar los pagos al momento de emitir."
            >
              <Input
                type="number"
                value={control.orden_pago}
                onChange={(e) => setControl((p) => ({ ...p, orden_pago: toNum(e.target.value) }))}
              />
            </FieldWithTooltip>

            <div className="space-y-1">
              {/* observaciones no necesita tooltip */}
            </div>

            <div className="md:col-span-2 space-y-1">
              <FieldWithTooltip
                label="Observaciones"
                tooltip="Notas internas sobre esta liquidacion. No se muestran al empleado."
              >
                <Textarea
                  value={control.observaciones}
                  onChange={(e) => setControl((p) => ({ ...p, observaciones: e.target.value }))}
                />
              </FieldWithTooltip>
            </div>

            <div className="md:col-span-2 flex gap-2 flex-wrap pt-1">
              <Button onClick={handleSaveControl} disabled={loading}>
                Guardar control
              </Button>
              <Button variant="outline" onClick={handleRecalcular} disabled={loading}>
                Recalcular
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Control 30% y Autorizacion */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Control 30% y autorizacion</CardTitle>
            <CardDescription>
              Los anticipos no pueden superar el 30% del sueldo sin descuentos. Si supera, requiere autorizacion manual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar Control 30% */}
            <div className="rounded-md border bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Anticipos: {formatMoney(control30Anticipos)} / Limite: {formatMoney(control30Limite)}
                </span>
                <span
                  className={`font-semibold ${
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
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
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
                  Superado — requiere autorizacion
                </Badge>
              )}
            </div>

            <Separator />

            {/* Autorizacion */}
            <div className="rounded-md border bg-slate-50 p-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={liquidacion.pago_autorizado ? 'outline' : 'secondary'}>
                  {liquidacion.pago_autorizado ? 'Pago autorizado' : 'Autorizacion pendiente'}
                </Badge>
                <Button size="sm" onClick={() => handleAutorizar(true)} disabled={loading}>
                  Autorizar
                </Button>
                <Button size="sm" variant="outline" onClick={requestNoAutorizar} disabled={loading}>
                  No autorizar
                </Button>
              </div>
              <div>
                <FieldWithTooltip
                  label="Motivo no autorizado"
                  tooltip="Obligatorio si decide no autorizar el pago. Se registra como motivo de rechazo."
                >
                  <Textarea
                    value={motivoNoAutorizado}
                    onChange={(e) => setMotivoNoAutorizado(e.target.value)}
                    placeholder="Obligatorio para no autorizar"
                  />
                </FieldWithTooltip>
                {!trimmedMotivoNoAutorizado && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Si decide no autorizar, debe completar este motivo.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Aprobar y pagar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aprobar y pagar</CardTitle>
            <CardDescription>Acciones de flujo para avanzar el estado de la liquidacion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={requestAprobar}
                disabled={loading || Boolean(approveBlockedReason)}
              >
                Aprobar liquidacion
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={requestPagar}
                disabled={loading || Boolean(payBlockedReason)}
              >
                Marcar como pagada
              </Button>
            </div>
            {approveBlockedReason && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {approveBlockedReason}
              </p>
            )}
            {payBlockedReason && (
              <p className="text-xs text-muted-foreground">{payBlockedReason}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(confirmFlowAction)} onOpenChange={(open) => !open && setConfirmFlowAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmFlow()} disabled={loading}>
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-slate-50 p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium text-sm tabular-nums mt-0.5">{value}</p>
    </div>
  )
}
