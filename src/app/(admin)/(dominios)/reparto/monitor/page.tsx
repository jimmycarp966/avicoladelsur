/**
 * Monitor de Reparto en Tiempo Real
 * 
 * Visualiza vehículos, rutas optimizadas y alertas en un mapa interactivo
 */

import MonitorMap from '@/components/reparto/MonitorMap'

export default function MonitorRepartoPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Monitor de Reparto</h1>
        <p className="text-muted-foreground mt-2">
          Visualiza vehículos en tiempo real, rutas optimizadas y alertas de desvío
        </p>
      </div>

      <MonitorMap />
    </div>
  )
}

