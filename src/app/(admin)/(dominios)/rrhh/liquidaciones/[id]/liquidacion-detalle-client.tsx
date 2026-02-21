'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { AdelantoCuota, Liquidacion, LiquidacionJornada, LiquidacionReglaPuesto } from '@/types/domain.types'
import { LiquidacionStatCards } from './components/liquidacion-stat-cards'
import { LiquidacionResumenTab } from './components/liquidacion-resumen-tab'
import { LiquidacionJornadasTab } from './components/liquidacion-jornadas-tab'
import { LiquidacionAnticiposTab } from './components/liquidacion-anticipos-tab'
import { LiquidacionControlTab } from './components/liquidacion-control-tab'

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
  feriados: Array<{ fecha: string; descripcion?: string | null }>
  puestosDisponibles: Pick<LiquidacionReglaPuesto, 'puesto_codigo'>[]
}

export function LiquidacionDetalleClient({
  liquidacion,
  jornadas,
  cuotas,
  feriados,
  puestosDisponibles,
}: Props) {
  const router = useRouter()

  const isSucursalEmployee = useMemo(() => {
    const categoriaNombre = liquidacion.empleado?.categoria?.nombre?.toLowerCase() || ''
    return Boolean(liquidacion.empleado?.sucursal_id) || categoriaNombre.includes('sucursal')
  }, [liquidacion.empleado?.categoria?.nombre, liquidacion.empleado?.sucursal_id])

  const cuotasPeriodoCount = useMemo(
    () =>
      cuotas.filter(
        (c) => c.periodo_mes === liquidacion.periodo_mes && c.periodo_anio === liquidacion.periodo_anio,
      ).length,
    [cuotas, liquidacion.periodo_mes, liquidacion.periodo_anio],
  )

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <LiquidacionStatCards liquidacion={liquidacion} />

      {/* Tabs */}
      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="jornadas" className="flex items-center gap-2">
            Detalle de Horas
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5">
              {jornadas.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="anticipos" className="flex items-center gap-2">
            Anticipos
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5">
              {cuotasPeriodoCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="control">Control y Aprobacion</TabsTrigger>
        </TabsList>

        {/* Tab 1: Resumen */}
        <TabsContent value="resumen">
          <LiquidacionResumenTab liquidacion={liquidacion} />
        </TabsContent>

        {/* Tab 2: Detalle de Horas */}
        <TabsContent value="jornadas">
          <LiquidacionJornadasTab
            liquidacion={liquidacion}
            jornadas={jornadas}
            feriados={feriados}
            isSucursalEmployee={isSucursalEmployee}
          />
        </TabsContent>

        {/* Tab 3: Anticipos */}
        <TabsContent value="anticipos">
          <LiquidacionAnticiposTab
            cuotas={cuotas}
            periodoMes={liquidacion.periodo_mes}
            periodoAnio={liquidacion.periodo_anio}
          />
        </TabsContent>

        {/* Tab 4: Control y Aprobacion */}
        <TabsContent value="control">
          <LiquidacionControlTab
            liquidacion={liquidacion}
            puestosDisponibles={puestosDisponibles}
            onRefresh={handleRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
