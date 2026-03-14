'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import type { LiquidacionJornada } from '@/types/domain.types'
import { isAusenciaObservacion } from './liquidacion-utils'

type JornadasCalendarioProps = {
  jornadas: LiquidacionJornada[]
  feriados: Array<{ fecha: string; descripcion?: string | null }>
  periodoMes: number
  periodoAnio: number
  onDiaClick?: (dia: DiaCalendario) => void
}

type DiaCalendario = {
  fecha: string // YYYY-MM-DD
  dia: number
  jornada: LiquidacionJornada | null
  esFeriado: boolean
  feriadoLabel?: string
  esSabado: boolean
  esDomingo: boolean
  esFuturo: boolean
  tipo: 'presente' | 'media_falta' | 'descanso' | 'ausente' | 'no_laboral'
}

function getTodayArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
}

function clasificarDia(dia: DiaCalendario): DiaCalendario['tipo'] {
  if (dia.esSabado || dia.esDomingo || dia.esFeriado) {
    if (!dia.jornada) return 'no_laboral'
  }

  if (!dia.jornada) {
    if (dia.esFuturo) return 'no_laboral'
    return 'ausente'
  }

  const { jornada } = dia
  if (isAusenciaObservacion(jornada.observaciones)) return 'ausente'
  if (jornada.origen === 'auto_licencia_descanso') return 'descanso'

  const hs = jornada.horas_mensuales ?? 0
  const turno = jornada.turno?.toLowerCase() ?? ''
  const esMedioTurno = turno.startsWith('medio_turno') || hs === 0.5

  if (esMedioTurno) return 'media_falta'
  if (hs >= 4) return 'presente'
  if (hs > 0) return 'media_falta'

  return 'presente'
}

const TIPO_CONFIG: Record<
  DiaCalendario['tipo'],
  { bg: string; text: string; label: string; icon: string }
> = {
  presente: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    label: 'Presente',
    icon: '✓',
  },
  media_falta: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    label: 'Media falta',
    icon: '½',
  },
  descanso: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    label: 'Descanso',
    icon: '~',
  },
  ausente: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    label: 'Ausente',
    icon: '✗',
  },
  no_laboral: {
    bg: 'bg-gray-50 border-gray-100',
    text: 'text-gray-400',
    label: '',
    icon: '',
  },
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function JornadasCalendario({
  jornadas,
  feriados,
  periodoMes,
  periodoAnio,
  onDiaClick,
}: JornadasCalendarioProps) {
  const today = getTodayArgentina()

  const feriadosMap = useMemo(
    () =>
      new Map<string, string>(
        feriados
          .filter((f) => Boolean(f.fecha))
          .map((f) => [String(f.fecha).slice(0, 10), (f.descripcion || 'Feriado').trim() || 'Feriado']),
      ),
    [feriados],
  )

  const jornadasMap = useMemo(
    () =>
      new Map<string, LiquidacionJornada>(
        jornadas
          .filter((j) => Boolean(j.fecha))
          .map((j) => [String(j.fecha).slice(0, 10), j]),
      ),
    [jornadas],
  )

  const dias = useMemo<DiaCalendario[]>(() => {
    const ultimoDia = new Date(periodoAnio, periodoMes, 0).getDate()
    const result: DiaCalendario[] = []

    for (let d = 1; d <= ultimoDia; d++) {
      const mes = String(periodoMes).padStart(2, '0')
      const dStr = String(d).padStart(2, '0')
      const fecha = `${periodoAnio}-${mes}-${dStr}`
      const dateObj = new Date(`${fecha}T12:00:00`)
      const dow = dateObj.getDay()
      const esFeriado = feriadosMap.has(fecha)
      const esFuturo = fecha > today
      const jornada = jornadasMap.get(fecha) ?? null

      const dia: DiaCalendario = {
        fecha,
        dia: d,
        jornada,
        esFeriado,
        feriadoLabel: feriadosMap.get(fecha),
        esSabado: dow === 6,
        esDomingo: dow === 0,
        esFuturo,
        tipo: 'no_laboral',
      }
      dia.tipo = clasificarDia(dia)
      result.push(dia)
    }

    return result
  }, [periodoMes, periodoAnio, feriadosMap, jornadasMap, today])

  // Calcular offset del primer día del mes para alinear grid
  const primerDia = new Date(`${periodoAnio}-${String(periodoMes).padStart(2, '0')}-01T12:00:00`)
  const offsetInicio = primerDia.getDay() // 0=Dom

  // Contadores
  const contadores = useMemo(
    () =>
      dias.reduce(
        (acc, d) => {
          if (d.tipo !== 'no_laboral') acc[d.tipo] = (acc[d.tipo] ?? 0) + 1
          return acc
        },
        {} as Record<DiaCalendario['tipo'], number>,
      ),
    [dias],
  )

  return (
    <div className="space-y-3">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(['presente', 'media_falta', 'descanso', 'ausente'] as DiaCalendario['tipo'][]).map((tipo) => {
          const cfg = TIPO_CONFIG[tipo]
          const count = contadores[tipo] ?? 0
          return (
            <div key={tipo} className={`flex items-center gap-1 rounded px-2 py-0.5 border ${cfg.bg}`}>
              <span className={cfg.text}>{cfg.icon}</span>
              <span className={cfg.text}>{cfg.label}</span>
              <Badge variant="outline" className={`text-[10px] py-0 ${cfg.bg} ${cfg.text} border-current/20`}>
                {count}
              </Badge>
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div className="rounded-md border overflow-hidden">
        {/* Cabecera días de la semana */}
        <div className="grid grid-cols-7 bg-muted/40 border-b">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1.5">
              {d}
            </div>
          ))}
        </div>

        {/* Días */}
        <div className="grid grid-cols-7">
          {/* Celdas vacías de offset */}
          {Array.from({ length: offsetInicio }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[60px] border-r border-b bg-gray-50/50" />
          ))}

          {dias.map((dia) => {
            const cfg = TIPO_CONFIG[dia.tipo]
            const esHoy = dia.fecha === today
            const esClicable = dia.tipo === 'ausente'

            return (
              <div
                key={dia.fecha}
                className={`min-h-[60px] border-r border-b p-1 relative ${cfg.bg} ${esHoy ? 'ring-2 ring-inset ring-blue-400' : ''} ${esClicable ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400' : ''}`}
                onClick={() => {
                  if (!esClicable) return
                  onDiaClick?.(dia)
                }}
                onKeyDown={(event) => {
                  if (!esClicable) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onDiaClick?.(dia)
                  }
                }}
                role={esClicable ? 'button' : undefined}
                tabIndex={esClicable ? 0 : -1}
                aria-label={esClicable ? `Cargar jornada para el dia ${dia.fecha}` : undefined}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`text-[11px] font-semibold leading-none ${esHoy ? 'text-blue-600' : cfg.text}`}
                  >
                    {dia.dia}
                  </span>
                  {cfg.icon && (
                    <span className={`text-[13px] leading-none ${cfg.text}`}>{cfg.icon}</span>
                  )}
                </div>

                {dia.esFeriado && dia.feriadoLabel && (
                  <p className="text-[9px] text-red-500 leading-tight mt-0.5 truncate">
                    {dia.feriadoLabel}
                  </p>
                )}

                {dia.jornada && (
                  <p className={`text-[9px] leading-tight mt-0.5 truncate ${cfg.text} opacity-80`}>
                    {dia.jornada.horas_mensuales ?? 0}hs
                  </p>
                )}

                {dia.tipo !== 'no_laboral' && cfg.label && (
                  <p className={`text-[9px] leading-tight mt-0.5 ${cfg.text} opacity-70`}>
                    {cfg.label}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
