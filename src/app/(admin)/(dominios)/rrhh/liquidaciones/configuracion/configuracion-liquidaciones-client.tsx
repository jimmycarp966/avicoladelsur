'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw, Save } from 'lucide-react'
import {
  guardarReglaPeriodoAction,
  guardarReglaPuestoAction,
  obtenerConfiguracionLiquidacionAction,
} from '@/actions/rrhh.actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNotificationStore } from '@/store/notificationStore'
import type { LiquidacionReglaPuesto } from '@/types/domain.types'

type GrupoBaseDias = 'galpon' | 'sucursales' | 'rrhh'

type ReglaPuestoEditable = {
  id?: string
  puesto_codigo: string
  categoria_id?: string | null
  grupo_base_dias: GrupoBaseDias
  horas_jornada: number
  tarifa_turno_especial: number
  habilita_cajero: boolean
  tarifa_diferencia_cajero: number
  activo: boolean
}

type ReglaPeriodoEditable = {
  periodo_mes: number
  periodo_anio: number
  dias_base_galpon: number
  dias_base_sucursales: number
  dias_base_rrhh: number
  activo: boolean
}

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function defaultReglaPeriodo(periodoMes: number, periodoAnio: number): ReglaPeriodoEditable {
  return {
    periodo_mes: periodoMes,
    periodo_anio: periodoAnio,
    dias_base_galpon: 27,
    dias_base_sucursales: 31,
    dias_base_rrhh: 22,
    activo: true,
  }
}

function defaultReglaPuesto(): ReglaPuestoEditable {
  return {
    puesto_codigo: '',
    categoria_id: null,
    grupo_base_dias: 'galpon',
    horas_jornada: 9,
    tarifa_turno_especial: 0,
    habilita_cajero: false,
    tarifa_diferencia_cajero: 0,
    activo: true,
  }
}

function mapReglaPuesto(regla: LiquidacionReglaPuesto): ReglaPuestoEditable {
  return {
    id: regla.id,
    puesto_codigo: regla.puesto_codigo,
    categoria_id: regla.categoria_id || null,
    grupo_base_dias: regla.grupo_base_dias,
    horas_jornada: Number(regla.horas_jornada || 0),
    tarifa_turno_especial: Number(regla.tarifa_turno_especial || 0),
    habilita_cajero: !!regla.habilita_cajero,
    tarifa_diferencia_cajero: Number(regla.tarifa_diferencia_cajero || 0),
    activo: !!regla.activo,
  }
}

export function ConfiguracionLiquidacionesClient() {
  const { showToast } = useNotificationStore()
  const now = useMemo(() => new Date(), [])
  const [periodoMes, setPeriodoMes] = useState(now.getMonth() + 1)
  const [periodoAnio, setPeriodoAnio] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [savingPeriodo, setSavingPeriodo] = useState(false)
  const [savingPuestoId, setSavingPuestoId] = useState<string | null>(null)
  const [reglaPeriodo, setReglaPeriodo] = useState<ReglaPeriodoEditable>(
    defaultReglaPeriodo(now.getMonth() + 1, now.getFullYear())
  )
  const [reglasPuesto, setReglasPuesto] = useState<ReglaPuestoEditable[]>([])
  const [nuevaRegla, setNuevaRegla] = useState<ReglaPuestoEditable>(defaultReglaPuesto())

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
  const anios = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i)

  const loadConfiguracion = async (mes: number, anio: number) => {
    try {
      setLoading(true)
      const result = await obtenerConfiguracionLiquidacionAction(mes, anio)

      if (!result.success || !result.data) {
        showToast('error', result.error || 'No se pudo cargar la configuracion', 'Error')
        return
      }

      if (result.data.reglaPeriodo) {
        setReglaPeriodo({
          periodo_mes: result.data.reglaPeriodo.periodo_mes,
          periodo_anio: result.data.reglaPeriodo.periodo_anio,
          dias_base_galpon: Number(result.data.reglaPeriodo.dias_base_galpon || 0),
          dias_base_sucursales: Number(result.data.reglaPeriodo.dias_base_sucursales || 0),
          dias_base_rrhh: Number(result.data.reglaPeriodo.dias_base_rrhh || 0),
          activo: !!result.data.reglaPeriodo.activo,
        })
      } else {
        setReglaPeriodo(defaultReglaPeriodo(mes, anio))
      }

      setReglasPuesto((result.data.reglasPuesto || []).map(mapReglaPuesto))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfiguracion(periodoMes, periodoAnio)
  }, [periodoMes, periodoAnio])

  const handleGuardarPeriodo = async () => {
    try {
      setSavingPeriodo(true)
      const result = await guardarReglaPeriodoAction({
        periodo_mes: periodoMes,
        periodo_anio: periodoAnio,
        dias_base_galpon: reglaPeriodo.dias_base_galpon,
        dias_base_sucursales: reglaPeriodo.dias_base_sucursales,
        dias_base_rrhh: reglaPeriodo.dias_base_rrhh,
        activo: reglaPeriodo.activo,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar la regla de periodo', 'Error')
        return
      }

      showToast('success', 'Regla de periodo guardada', 'Guardado')
      await loadConfiguracion(periodoMes, periodoAnio)
    } finally {
      setSavingPeriodo(false)
    }
  }

  const handleGuardarPuesto = async (regla: ReglaPuestoEditable) => {
    const identifier = regla.id || `nuevo-${regla.puesto_codigo}`
    try {
      setSavingPuestoId(identifier)
      const result = await guardarReglaPuestoAction({
        id: regla.id,
        puesto_codigo: regla.puesto_codigo,
        categoria_id: regla.categoria_id || null,
        grupo_base_dias: regla.grupo_base_dias,
        horas_jornada: regla.horas_jornada,
        tarifa_turno_especial: regla.tarifa_turno_especial,
        habilita_cajero: regla.habilita_cajero,
        tarifa_diferencia_cajero: regla.tarifa_diferencia_cajero,
        activo: regla.activo,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar la regla de puesto', 'Error')
        return
      }

      showToast('success', 'Regla de puesto guardada', 'Guardado')

      if (!regla.id) {
        setNuevaRegla(defaultReglaPuesto())
      }

      await loadConfiguracion(periodoMes, periodoAnio)
    } finally {
      setSavingPuestoId(null)
    }
  }

  const updateReglaPuesto = (index: number, patch: Partial<ReglaPuestoEditable>) => {
    setReglasPuesto((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/rrhh/liquidaciones">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Liquidaciones
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodoMes.toString()} onValueChange={(value) => setPeriodoMes(Number(value))}>
            <SelectTrigger className="w-[140px]">
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

          <Select value={periodoAnio.toString()} onValueChange={(value) => setPeriodoAnio(Number(value))}>
            <SelectTrigger className="w-[110px]">
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

          <Button variant="outline" onClick={() => loadConfiguracion(periodoMes, periodoAnio)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Recargar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regla de Periodo</CardTitle>
          <CardDescription>Dias base que se usan para el calculo mensual del periodo seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm">Dias base Galpon</label>
              <Input
                type="number"
                min={1}
                value={reglaPeriodo.dias_base_galpon}
                onChange={(e) =>
                  setReglaPeriodo((prev) => ({ ...prev, dias_base_galpon: Math.max(1, toNumber(e.target.value)) }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Dias base Sucursales</label>
              <Input
                type="number"
                min={1}
                value={reglaPeriodo.dias_base_sucursales}
                onChange={(e) =>
                  setReglaPeriodo((prev) => ({ ...prev, dias_base_sucursales: Math.max(1, toNumber(e.target.value)) }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Dias base RRHH</label>
              <Input
                type="number"
                min={1}
                value={reglaPeriodo.dias_base_rrhh}
                onChange={(e) =>
                  setReglaPeriodo((prev) => ({ ...prev, dias_base_rrhh: Math.max(1, toNumber(e.target.value)) }))
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="periodo-activo"
              checked={reglaPeriodo.activo}
              onCheckedChange={(value) => setReglaPeriodo((prev) => ({ ...prev, activo: !!value }))}
            />
            <label htmlFor="periodo-activo" className="text-sm">
              Regla de periodo activa
            </label>
          </div>

          <Button onClick={handleGuardarPeriodo} disabled={savingPeriodo}>
            {savingPeriodo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar regla de periodo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas por Puesto</CardTitle>
          <CardDescription>
            Define jornada laboral, tarifa de turno especial y parametros de cajero por puesto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reglasPuesto.length === 0 && !loading && (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No hay reglas de puesto cargadas.
            </div>
          )}

          {reglasPuesto.map((regla, index) => {
            const rowSavingId = regla.id || ''
            const isSaving = savingPuestoId === rowSavingId

            return (
              <div key={regla.id || `regla-${index}`} className="rounded-md border p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs">Puesto codigo</label>
                    <Input
                      value={regla.puesto_codigo}
                      onChange={(e) => updateReglaPuesto(index, { puesto_codigo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Grupo base dias</label>
                    <Select
                      value={regla.grupo_base_dias}
                      onValueChange={(value) => updateReglaPuesto(index, { grupo_base_dias: value as GrupoBaseDias })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="galpon">Galpon</SelectItem>
                        <SelectItem value="sucursales">Sucursales</SelectItem>
                        <SelectItem value="rrhh">RRHH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Horas jornada</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={regla.horas_jornada}
                      onChange={(e) => updateReglaPuesto(index, { horas_jornada: Math.max(0, toNumber(e.target.value)) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Tarifa turno especial</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={regla.tarifa_turno_especial}
                      onChange={(e) =>
                        updateReglaPuesto(index, { tarifa_turno_especial: Math.max(0, toNumber(e.target.value)) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Tarifa diferencia cajero</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={regla.tarifa_diferencia_cajero}
                      onChange={(e) =>
                        updateReglaPuesto(index, { tarifa_diferencia_cajero: Math.max(0, toNumber(e.target.value)) })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`habilita-cajero-${regla.id || index}`}
                      checked={regla.habilita_cajero}
                      onCheckedChange={(value) => updateReglaPuesto(index, { habilita_cajero: !!value })}
                    />
                    <label htmlFor={`habilita-cajero-${regla.id || index}`} className="text-xs">
                      Habilita cajero
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`activo-${regla.id || index}`}
                      checked={regla.activo}
                      onCheckedChange={(value) => updateReglaPuesto(index, { activo: !!value })}
                    />
                    <label htmlFor={`activo-${regla.id || index}`} className="text-xs">
                      Activo
                    </label>
                  </div>

                  <Button size="sm" onClick={() => handleGuardarPuesto(regla)} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nueva Regla de Puesto</CardTitle>
          <CardDescription>Agrega un nuevo puesto para controlar jornada y extras desde RRHH.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs">Puesto codigo</label>
              <Input
                value={nuevaRegla.puesto_codigo}
                onChange={(e) => setNuevaRegla((prev) => ({ ...prev, puesto_codigo: e.target.value }))}
                placeholder="ej: limpieza"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Grupo base dias</label>
              <Select
                value={nuevaRegla.grupo_base_dias}
                onValueChange={(value) => setNuevaRegla((prev) => ({ ...prev, grupo_base_dias: value as GrupoBaseDias }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="galpon">Galpon</SelectItem>
                  <SelectItem value="sucursales">Sucursales</SelectItem>
                  <SelectItem value="rrhh">RRHH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs">Horas jornada</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={nuevaRegla.horas_jornada}
                onChange={(e) => setNuevaRegla((prev) => ({ ...prev, horas_jornada: Math.max(0, toNumber(e.target.value)) }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Tarifa turno especial</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={nuevaRegla.tarifa_turno_especial}
                onChange={(e) =>
                  setNuevaRegla((prev) => ({ ...prev, tarifa_turno_especial: Math.max(0, toNumber(e.target.value)) }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs">Tarifa diferencia cajero</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={nuevaRegla.tarifa_diferencia_cajero}
                onChange={(e) =>
                  setNuevaRegla((prev) => ({
                    ...prev,
                    tarifa_diferencia_cajero: Math.max(0, toNumber(e.target.value)),
                  }))
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="nueva-habilita-cajero"
                checked={nuevaRegla.habilita_cajero}
                onCheckedChange={(value) => setNuevaRegla((prev) => ({ ...prev, habilita_cajero: !!value }))}
              />
              <label htmlFor="nueva-habilita-cajero" className="text-xs">
                Habilita cajero
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="nueva-activa"
                checked={nuevaRegla.activo}
                onCheckedChange={(value) => setNuevaRegla((prev) => ({ ...prev, activo: !!value }))}
              />
              <label htmlFor="nueva-activa" className="text-xs">
                Activa
              </label>
            </div>

            <Button onClick={() => handleGuardarPuesto(nuevaRegla)} disabled={savingPuestoId === `nuevo-${nuevaRegla.puesto_codigo}`}>
              {savingPuestoId === `nuevo-${nuevaRegla.puesto_codigo}` ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar nuevo puesto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

