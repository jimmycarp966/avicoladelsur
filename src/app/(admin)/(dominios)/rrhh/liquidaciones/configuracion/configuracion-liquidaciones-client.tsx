'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, CalendarDays, ChevronDown, ChevronUp, Info, Loader2, Plus, RefreshCw, Save, Store, Users } from 'lucide-react'
import {
  guardarReglaPeriodoAction,
  guardarReglaPuestoAction,
  obtenerConfiguracionLiquidacionAction,
} from '@/actions/rrhh.actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNotificationStore } from '@/store/notificationStore'
import type { LiquidacionReglaPuesto } from '@/types/domain.types'

type GrupoBaseDias = 'galpon' | 'sucursales' | 'rrhh' | 'lun_sab'

type ReglaPuestoEditable = {
  id?: string
  puesto_codigo: string
  categoria_id?: string | null
  grupo_base_dias: GrupoBaseDias
  horas_jornada: number
  valor_hora_override?: number | null
  tarifa_turno_trabajado: number
  tarifa_turno_especial: number
  habilita_cajero: boolean
  tarifa_diferencia_cajero: number
  tipo_calculo: 'hora' | 'turno'
  activo: boolean
  _dirty?: boolean
}

type ReglaPeriodoEditable = {
  periodo_mes: number
  periodo_anio: number
  dias_base_galpon: number
  dias_base_sucursales: number
  dias_base_rrhh: number
  dias_base_lun_sab: number
  activo: boolean
}

type CategoriaLiquidacion = {
  id: string
  nombre: string
  sueldo_basico: number
}

function toNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableNumber(value: string): number | null {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function getDaysInMonth(periodoMes: number, periodoAnio: number): number {
  return new Date(periodoAnio, periodoMes, 0).getDate()
}

function defaultReglaPeriodo(periodoMes: number, periodoAnio: number): ReglaPeriodoEditable {
  return {
    periodo_mes: periodoMes,
    periodo_anio: periodoAnio,
    dias_base_galpon: 27,
    dias_base_sucursales: getDaysInMonth(periodoMes, periodoAnio),
    dias_base_rrhh: 22,
    dias_base_lun_sab: 26,
    activo: true,
  }
}

function defaultReglaPuesto(): ReglaPuestoEditable {
  return {
    puesto_codigo: '',
    categoria_id: null,
    grupo_base_dias: 'galpon',
    horas_jornada: 9,
    valor_hora_override: null,
    tarifa_turno_trabajado: 0,
    tarifa_turno_especial: 0,
    habilita_cajero: false,
    tarifa_diferencia_cajero: 0,
    tipo_calculo: 'hora',
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
    valor_hora_override: regla.valor_hora_override ?? null,
    tarifa_turno_trabajado: Number((regla as unknown as { tarifa_turno_trabajado?: number }).tarifa_turno_trabajado || 0),
    tarifa_turno_especial: Number(regla.tarifa_turno_especial || 0),
    habilita_cajero: !!regla.habilita_cajero,
    tarifa_diferencia_cajero: Number(regla.tarifa_diferencia_cajero || 0),
    tipo_calculo: regla.tipo_calculo || 'hora',
    activo: !!regla.activo,
    _dirty: false,
  }
}

const GRUPO_INFO = {
  galpon: {
    label: 'Galpón',
    description: 'Empleados de campo y producción',
    icon: Building2,
    colorClass: 'bg-orange-50 border-orange-200 text-orange-800',
    iconClass: 'text-orange-600',
  },
  sucursales: {
    label: 'Sucursales',
    description: 'Personal de tiendas y puntos de venta',
    icon: Store,
    colorClass: 'bg-blue-50 border-blue-200 text-blue-800',
    iconClass: 'text-blue-600',
  },
  rrhh: {
    label: 'RRHH / Oficina',
    description: 'Personal administrativo',
    icon: Users,
    colorClass: 'bg-green-50 border-green-200 text-green-800',
    iconClass: 'text-green-600',
  },
  lun_sab: {
    label: 'Lunes a sabado',
    description: 'Administrativos con jornada de lunes a sabado',
    icon: CalendarDays,
    colorClass: 'bg-violet-50 border-violet-200 text-violet-800',
    iconClass: 'text-violet-600',
  },
} as const

export function ConfiguracionLiquidacionesClient() {
  const { showToast } = useNotificationStore()
  const now = useMemo(() => new Date(), [])
  const [instruccionesOpen, setInstruccionesOpen] = useState(false)
  const [periodoMes, setPeriodoMes] = useState(now.getMonth() + 1)
  const [periodoAnio, setPeriodoAnio] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [savingPeriodo, setSavingPeriodo] = useState(false)
  const [savingPuestoId, setSavingPuestoId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [modoPersonalizado, setModoPersonalizado] = useState(false)
  const [reglaPeriodoPersistida, setReglaPeriodoPersistida] = useState(false)
  const [reglaPeriodo, setReglaPeriodo] = useState<ReglaPeriodoEditable>(
    defaultReglaPeriodo(now.getMonth() + 1, now.getFullYear()),
  )
  const [reglasPuesto, setReglasPuesto] = useState<ReglaPuestoEditable[]>([])
  const [nuevaRegla, setNuevaRegla] = useState<ReglaPuestoEditable>(defaultReglaPuesto())
  const [categorias, setCategorias] = useState<CategoriaLiquidacion[]>([])

  const codigosExistentes = useMemo(
    () => new Set(reglasPuesto.map((r) => r.puesto_codigo.toLowerCase())),
    [reglasPuesto],
  )
  const categoriasSinRegla = useMemo(
    () => categorias.filter((c) => !codigosExistentes.has(c.nombre.toLowerCase())),
    [categorias, codigosExistentes],
  )
  const categoriasCubiertas = useMemo(
    () => categorias.filter((c) => codigosExistentes.has(c.nombre.toLowerCase())),
    [categorias, codigosExistentes],
  )
  const categoriasById = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria])),
    [categorias],
  )
  const categoriasByNombre = useMemo(
    () => new Map(categorias.map((categoria) => [normalizeText(categoria.nombre), categoria])),
    [categorias],
  )

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
        setReglaPeriodoPersistida(true)
        setReglaPeriodo({
          periodo_mes: result.data.reglaPeriodo.periodo_mes,
          periodo_anio: result.data.reglaPeriodo.periodo_anio,
          dias_base_galpon: Number(result.data.reglaPeriodo.dias_base_galpon || 0),
          dias_base_sucursales: getDaysInMonth(mes, anio),
          dias_base_rrhh: Number(result.data.reglaPeriodo.dias_base_rrhh || 0),
          dias_base_lun_sab: Number(result.data.reglaPeriodo.dias_base_lun_sab || 0),
          activo: !!result.data.reglaPeriodo.activo,
        })
      } else {
        setReglaPeriodoPersistida(false)
        setReglaPeriodo(defaultReglaPeriodo(mes, anio))
      }

      setReglasPuesto((result.data.reglasPuesto || []).map(mapReglaPuesto))
      setCategorias(result.data.categorias ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfiguracion(periodoMes, periodoAnio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoMes, periodoAnio])

  const handleGuardarPeriodo = async () => {
    try {
      setSavingPeriodo(true)
      const diasBaseSucursales = getDaysInMonth(periodoMes, periodoAnio)
      const result = await guardarReglaPeriodoAction({
        periodo_mes: periodoMes,
        periodo_anio: periodoAnio,
        dias_base_galpon: reglaPeriodo.dias_base_galpon,
        dias_base_sucursales: diasBaseSucursales,
        dias_base_rrhh: reglaPeriodo.dias_base_rrhh,
        dias_base_lun_sab: reglaPeriodo.dias_base_lun_sab,
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
        periodo_mes: periodoMes,
        periodo_anio: periodoAnio,
        grupo_base_dias: regla.grupo_base_dias,
        horas_jornada: regla.horas_jornada,
        valor_hora_override: regla.valor_hora_override ?? null,
        tarifa_turno_trabajado: regla.tarifa_turno_trabajado,
        tarifa_turno_especial: regla.tarifa_turno_especial,
        habilita_cajero: regla.habilita_cajero,
        tarifa_diferencia_cajero: regla.tarifa_diferencia_cajero,
        tipo_calculo: regla.tipo_calculo,
        activo: regla.activo,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar la regla de puesto', 'Error')
        return
      }

      showToast('success', 'Regla de puesto guardada', 'Guardado')

      if (!regla.id) {
        setNuevaRegla(defaultReglaPuesto())
        setModoPersonalizado(false)
        setDialogOpen(false)
      }

      await loadConfiguracion(periodoMes, periodoAnio)
    } finally {
      setSavingPuestoId(null)
    }
  }

  const updateReglaPuesto = (index: number, patch: Partial<ReglaPuestoEditable>) => {
    setReglasPuesto((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch, _dirty: true } : item)),
    )
  }

  const getDiasBase = (grupoBaseDias: GrupoBaseDias): number => {
    switch (grupoBaseDias) {
      case 'sucursales':
        return getDaysInMonth(periodoMes, periodoAnio)
      case 'rrhh':
        return reglaPeriodo.dias_base_rrhh
      case 'lun_sab':
        return reglaPeriodo.dias_base_lun_sab
      case 'galpon':
      default:
        return reglaPeriodo.dias_base_galpon
    }
  }

  const getCategoriaForRegla = (regla: ReglaPuestoEditable): CategoriaLiquidacion | null => {
    if (regla.categoria_id && categoriasById.has(regla.categoria_id)) {
      return categoriasById.get(regla.categoria_id) || null
    }

    return categoriasByNombre.get(normalizeText(regla.puesto_codigo)) || null
  }

  const getValorHoraCalculado = (regla: ReglaPuestoEditable): number | null => {
    const categoria = getCategoriaForRegla(regla)
    const diasBase = getDiasBase(regla.grupo_base_dias)
    const horasJornada = Number(regla.horas_jornada || 0)

    if (!categoria || diasBase <= 0 || horasJornada <= 0) {
      return null
    }

    return roundMoney(Number(categoria.sueldo_basico || 0) / diasBase / horasJornada)
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

      {/* Panel de instrucciones colapsable */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader
          className="cursor-pointer select-none pb-3"
          onClick={() => setInstruccionesOpen((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm text-blue-800">¿Cómo funciona esta configuración?</CardTitle>
            </div>
            {instruccionesOpen ? (
              <ChevronUp className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-blue-600" />
            )}
          </div>
        </CardHeader>

        {instruccionesOpen && (
          <CardContent className="pt-0 space-y-4 text-sm text-blue-900">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="font-semibold">Regla de Período</p>
                <p className="text-blue-800/80">
                  Define cuántos días hábiles tiene el mes según el grupo del empleado. Se usa para calcular
                  el valor del jornal diario:
                </p>
                <div className="bg-white/60 rounded-md p-2 font-mono text-xs space-y-1 border border-blue-100">
                  <p>valor_jornal = sueldo ÷ días_base</p>
                  <p>valor_hora = valor_jornal ÷ horas_jornada</p>
                </div>
                <ul className="list-disc list-inside text-blue-800/80 space-y-1 text-xs">
                  <li><strong>Galpón:</strong> empleados de producción y campo (ej: 27 días)</li>
                  <li><strong>Sucursales:</strong> personal de tiendas (auto-calculado por mes calendario)</li>
                  <li><strong>RRHH / Oficina:</strong> administrativos lun-vie (ej: 22 días hábiles)</li>
                  <li><strong>Lunes a sábado:</strong> administrativos con atención los sábados (ej: 26 días)</li>
                </ul>
                <p className="text-xs text-blue-700">
                  Si no existe regla para el período, el sistema usa los valores por defecto (27 / calendario / 22 / 26).
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold">Reglas por Puesto</p>
                <p className="text-blue-800/80">
                  Cada puesto define los parámetros de su jornada. El sistema empareja el puesto del
                  empleado comparando en minúsculas la categoría del empleado con el código de puesto.
                </p>
                <ul className="list-disc list-inside text-blue-800/80 space-y-1 text-xs">
                  <li>
                    <strong>Grupo base días:</strong> determina qué días base usa para el jornal
                  </li>
                  <li>
                    <strong>Tipo de cálculo:</strong>{' '}
                    <em>Por hora</em> — paga horas reales con tope de jornada + adicionales.{' '}
                    <em>Por turno</em> — paga 1 jornal completo por día presente, sin horas extra
                    (usar para repartidores y puestos similares)
                  </li>
                  <li>
                    <strong>Horas diarias:</strong> tope diario de horas normales (solo aplica a
                    tipo <em>por hora</em>). Las horas que superen este tope se pagan por separado
                  </li>
                  <li>
                    <strong>Tarifa turno especial:</strong> monto fijo por unidad de turno especial
                    registrado en la jornada
                  </li>
                  <li>
                    <strong>Cajero:</strong> si está habilitado, permite cargar días como cajero en la
                    planilla. El adicional se calcula como{' '}
                    <span className="font-mono">días_cajero × tarifa_diferencia</span>
                  </li>
                </ul>
                <p className="text-xs text-blue-700">
                  El código de puesto debe coincidir (en minúsculas) con el nombre de categoría del
                  empleado en RRHH. Usá el selector de categorías para evitar errores de tipeo.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* CFG-2: Regla de Período — mini-cards por grupo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Regla de Período</CardTitle>
              <CardDescription>
                Días base utilizados para el cálculo mensual del período seleccionado.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="periodo-activo"
                checked={reglaPeriodo.activo}
                onCheckedChange={(value) => setReglaPeriodo((prev) => ({ ...prev, activo: value }))}
              />
              <label htmlFor="periodo-activo" className="text-sm font-medium">
                Activa
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reglaPeriodoPersistida && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Este periodo todavia no tiene una regla guardada. Estas viendo los valores recomendados para{' '}
              <strong>
                {meses.find((mes) => mes.value === periodoMes)?.label} {periodoAnio}
              </strong>
              : galpon {reglaPeriodo.dias_base_galpon}, sucursales {getDaysInMonth(periodoMes, periodoAnio)}, rrhh{' '}
              {reglaPeriodo.dias_base_rrhh} y lunes a sabado {reglaPeriodo.dias_base_lun_sab}. Guarda esta configuracion para dejar fijo el valor hora del mes.
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <div className="font-medium text-slate-950">
              Reglas visibles para {meses.find((mes) => mes.value === periodoMes)?.label} {periodoAnio}
            </div>
            <ul className="mt-2 space-y-2">
              <li>`Galpon` usa dias habiles configurables; si no hay regla guardada, el valor recomendado es 27.</li>
              <li>`Sucursales` siempre usa dias calendario del mes seleccionado; para este periodo son {getDaysInMonth(periodoMes, periodoAnio)}.</li>
              <li>`RRHH / Oficina` usa dias habiles configurables; si no hay regla guardada, el valor recomendado es 22.</li>
              <li>`Lunes a sabado` usa dias habiles configurables; si no hay regla guardada, el valor recomendado es 26.</li>
              <li>El valor hora se calcula con esta base: `valor_jornal = sueldo / dias_base` y `valor_hora = valor_jornal / horas_jornada`.</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(
              [
                {
                  key: 'dias_base_galpon' as const,
                  grupo: 'galpon',
                  value: reglaPeriodo.dias_base_galpon,
                  autoCalculated: false,
                },
                {
                  key: 'dias_base_sucursales' as const,
                  grupo: 'sucursales',
                  value: getDaysInMonth(periodoMes, periodoAnio),
                  autoCalculated: true,
                },
                {
                  key: 'dias_base_rrhh' as const,
                  grupo: 'rrhh',
                  value: reglaPeriodo.dias_base_rrhh,
                  autoCalculated: false,
                },
                {
                  key: 'dias_base_lun_sab' as const,
                  grupo: 'lun_sab',
                  value: reglaPeriodo.dias_base_lun_sab,
                  autoCalculated: false,
                },
              ] as const
            ).map(({ key, grupo, value, autoCalculated }) => {
              const info = GRUPO_INFO[grupo]
              const Icon = info.icon
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-4 space-y-3 ${info.colorClass}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${info.iconClass}`} />
                    <span className="font-semibold text-sm">{info.label}</span>
                  </div>
                  <p className="text-xs opacity-75">{info.description}</p>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Días base</label>
                    <Input
                      type="number"
                      min={1}
                      value={value}
                      readOnly={autoCalculated}
                      disabled={autoCalculated}
                      className="bg-white/80 disabled:opacity-100 disabled:cursor-default"
                      onChange={(e) => {
                        if (autoCalculated) return
                        setReglaPeriodo((prev) => ({
                          ...prev,
                          [key]: Math.max(1, toNumber(e.target.value)),
                        }))
                      }}
                    />
                    {autoCalculated && (
                      <p className="text-[11px] opacity-80">Auto-calculado según el mes calendario.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Button onClick={handleGuardarPeriodo} disabled={savingPeriodo}>
            {savingPeriodo ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar regla de período
          </Button>
        </CardContent>
      </Card>

      {/* CFG-1: Reglas por Puesto como tabla */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reglas por Puesto</CardTitle>
              <CardDescription>
                Define jornada laboral, tarifa de turno especial y parámetros de cajero por puesto.
              </CardDescription>
            </div>
            {/* CFG-3: Botón nueva regla → Dialog */}
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Regla
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reglasPuesto.length === 0 && !loading ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
              No hay reglas de puesto cargadas. Haga clic en &quot;Nueva Regla&quot; para agregar una.
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Puesto</TableHead>
                    <TableHead>Grupo días</TableHead>
                    <TableHead>Tipo cálculo</TableHead>
                    <TableHead className="text-right">Hs diarias</TableHead>
                    <TableHead className="text-right">Valor hora / turno</TableHead>
                    <TableHead className="text-right">Tarifa especial</TableHead>
                    <TableHead>Cajero</TableHead>
                    <TableHead className="text-right">Tarifa cajero</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reglasPuesto.map((regla, index) => {
                    const rowSavingId = regla.id || ''
                    const isSaving = savingPuestoId === rowSavingId
                    const valorHoraCalculado = getValorHoraCalculado(regla)
                    const categoriaRegla = getCategoriaForRegla(regla)
                    const diasBaseRegla = getDiasBase(regla.grupo_base_dias)

                    return (
                      <TableRow key={regla.id || `regla-${index}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium px-2 py-0.5 bg-muted rounded">
                              {regla.puesto_codigo}
                            </span>
                            {/* CFG-4: badge "Sin guardar" */}
                            {regla._dirty && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 whitespace-nowrap"
                              >
                                Sin guardar
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={regla.grupo_base_dias}
                            onValueChange={(value) =>
                              updateReglaPuesto(index, { grupo_base_dias: value as GrupoBaseDias })
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(GRUPO_INFO).map(([key, gi]) => (
                                <SelectItem key={key} value={key}>
                                  {gi.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={regla.tipo_calculo}
                            onValueChange={(value) =>
                              updateReglaPuesto(index, { tipo_calculo: value as 'hora' | 'turno' })
                            }
                          >
                            <SelectTrigger className="h-8 w-28 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hora">Por hora</SelectItem>
                              <SelectItem value="turno">Por turno</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={regla.horas_jornada}
                            className="h-8 w-20 text-sm text-right ml-auto"
                            onChange={(e) =>
                              updateReglaPuesto(index, {
                                horas_jornada: Math.max(0, toNumber(e.target.value)),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {regla.tipo_calculo === 'turno' ? (
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={regla.tarifa_turno_trabajado}
                              className="h-8 w-24 text-sm text-right ml-auto"
                              onChange={(e) =>
                                updateReglaPuesto(index, {
                                  tarifa_turno_trabajado: Math.max(0, toNumber(e.target.value)),
                                })
                              }
                            />
                          ) : (
                            <div className="text-right space-y-0.5">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={regla.valor_hora_override ?? ''}
                                placeholder={valorHoraCalculado !== null ? valorHoraCalculado.toFixed(2) : 'Auto'}
                                className="h-8 w-28 text-sm text-right ml-auto"
                                onChange={(e) =>
                                  updateReglaPuesto(index, {
                                    valor_hora_override: toNullableNumber(e.target.value),
                                  })
                                }
                              />
                              <div className="text-[11px] text-muted-foreground">
                                {regla.valor_hora_override != null
                                  ? 'Manual. Guardar para recalcular el periodo.'
                                  : categoriaRegla
                                    ? `Auto: sueldo ${Number(categoriaRegla.sueldo_basico || 0).toFixed(0)} / ${diasBaseRegla} dias = ${(valorHoraCalculado ?? 0).toFixed(2)}`
                                    : 'Vacio = usa el valor automatico de la categoria'}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={regla.tarifa_turno_especial}
                            className="h-8 w-24 text-sm text-right ml-auto"
                            onChange={(e) =>
                              updateReglaPuesto(index, {
                                tarifa_turno_especial: Math.max(0, toNumber(e.target.value)),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={regla.habilita_cajero}
                              onCheckedChange={(v) => updateReglaPuesto(index, { habilita_cajero: v })}
                            />
                            {regla.habilita_cajero ? (
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-50 text-green-700 border-green-200"
                              >
                                Sí
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                No
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {regla.habilita_cajero ? (
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={regla.tarifa_diferencia_cajero}
                              className="h-8 w-24 text-sm text-right ml-auto"
                              onChange={(e) =>
                                updateReglaPuesto(index, {
                                  tarifa_diferencia_cajero: Math.max(0, toNumber(e.target.value)),
                                })
                              }
                            />
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={regla.activo}
                            onCheckedChange={(v) => updateReglaPuesto(index, { activo: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={regla._dirty ? 'default' : 'outline'}
                            onClick={() => handleGuardarPuesto(regla)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            <span className="ml-1.5">Guardar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CFG-3: Dialog para nueva regla de puesto */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setModoPersonalizado(false)
            setNuevaRegla(defaultReglaPuesto())
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Regla de Puesto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <label className="text-sm font-medium">Puesto</label>
                <Select
                  onValueChange={(value) => {
                    if (value === '__personalizado__') {
                      setModoPersonalizado(true)
                      setNuevaRegla((prev) => ({ ...prev, puesto_codigo: '' }))
                    } else {
                      setModoPersonalizado(false)
                      setNuevaRegla((prev) => ({ ...prev, puesto_codigo: value }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar puesto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasSinRegla.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Categorías sin regla</SelectLabel>
                        {categoriasSinRegla.map((cat) => (
                          <SelectItem key={cat.id} value={cat.nombre.toLowerCase()}>
                            {cat.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {categoriasCubiertas.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Ya configuradas</SelectLabel>
                        {categoriasCubiertas.map((cat) => (
                          <SelectItem key={cat.id} value={cat.nombre.toLowerCase()} disabled>
                            {cat.nombre} ✓
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    <SelectSeparator />
                    <SelectItem value="__personalizado__">Personalizado (escribir código)...</SelectItem>
                  </SelectContent>
                </Select>
                {modoPersonalizado && (
                  <Input
                    value={nuevaRegla.puesto_codigo}
                    onChange={(e) =>
                      setNuevaRegla((prev) => ({ ...prev, puesto_codigo: e.target.value.toLowerCase() }))
                    }
                    placeholder="ej: deposito, ayudante_zona"
                    className="mt-2"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Grupo base días</label>
                <Select
                  value={nuevaRegla.grupo_base_dias}
                  onValueChange={(value) =>
                    setNuevaRegla((prev) => ({ ...prev, grupo_base_dias: value as GrupoBaseDias }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRUPO_INFO).map(([key, gi]) => (
                      <SelectItem key={key} value={key}>
                        {gi.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Tipo de cálculo</label>
                <Select
                  value={nuevaRegla.tipo_calculo}
                  onValueChange={(value) =>
                    setNuevaRegla((prev) => ({ ...prev, tipo_calculo: value as 'hora' | 'turno' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hora">Por hora</SelectItem>
                    <SelectItem value="turno">Por turno (ej: repartidor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Horas diarias</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nuevaRegla.horas_jornada}
                  onChange={(e) =>
                    setNuevaRegla((prev) => ({
                      ...prev,
                      horas_jornada: Math.max(0, toNumber(e.target.value)),
                    }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {nuevaRegla.tipo_calculo === 'turno' ? 'Tarifa turno trabajado (completo)' : 'Valor hora editable (opcional)'}
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nuevaRegla.tipo_calculo === 'turno' ? nuevaRegla.tarifa_turno_trabajado : nuevaRegla.valor_hora_override ?? ''}
                  onChange={(e) =>
                    setNuevaRegla((prev) => ({
                      ...prev,
                      ...(prev.tipo_calculo === 'turno'
                        ? { tarifa_turno_trabajado: Math.max(0, toNumber(e.target.value)) }
                        : { valor_hora_override: toNullableNumber(e.target.value) }),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Si el día es medio turno (solo mañana o solo tarde), se liquida al 50%.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Tarifa turno especial</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nuevaRegla.tarifa_turno_especial}
                  onChange={(e) =>
                    setNuevaRegla((prev) => ({
                      ...prev,
                      tarifa_turno_especial: Math.max(0, toNumber(e.target.value)),
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 border rounded-md">
              <Switch
                id="nueva-habilita-cajero"
                checked={nuevaRegla.habilita_cajero}
                onCheckedChange={(v) => setNuevaRegla((prev) => ({ ...prev, habilita_cajero: v }))}
              />
              <label htmlFor="nueva-habilita-cajero" className="text-sm font-medium">
                Habilita modalidad cajero
              </label>
            </div>

            {nuevaRegla.habilita_cajero && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Tarifa diferencia cajero</label>
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
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="nueva-activa"
                checked={nuevaRegla.activo}
                onCheckedChange={(value) => setNuevaRegla((prev) => ({ ...prev, activo: !!value }))}
              />
              <label htmlFor="nueva-activa" className="text-sm">
                Regla activa
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleGuardarPuesto(nuevaRegla)}
                disabled={
                  savingPuestoId === `nuevo-${nuevaRegla.puesto_codigo}` ||
                  !nuevaRegla.puesto_codigo.trim()
                }
                className="flex-1"
              >
                {savingPuestoId === `nuevo-${nuevaRegla.puesto_codigo}` ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Guardar nueva regla
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false)
                  setModoPersonalizado(false)
                  setNuevaRegla(defaultReglaPuesto())
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
