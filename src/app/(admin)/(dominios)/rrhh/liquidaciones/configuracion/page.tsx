import { ConfiguracionLiquidacionesClient } from './configuracion-liquidaciones-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Configuracion de Liquidaciones - Avicola del Sur ERP',
  description: 'Parametros de jornada y reglas para liquidaciones de sueldos',
}

export default function ConfiguracionLiquidacionesPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <h1 className="text-3xl font-bold tracking-tight">Configuracion de Liquidaciones</h1>
        <p className="text-muted-foreground mt-1">
          Define jornada laboral, dias base y parametros de calculo para RRHH.
        </p>
      </div>

      <ConfiguracionLiquidacionesClient />
    </div>
  )
}

