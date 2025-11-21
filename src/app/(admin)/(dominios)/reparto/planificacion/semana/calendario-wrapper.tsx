'use client'

import { useRouter } from 'next/navigation'
import CalendarioSemanal from './calendario-semanal'

type ZonaOption = { id: string; nombre: string }
type RepartidorOption = { id: string; nombre: string; apellido?: string | null }
type Plan = {
  id: string
  zona_id: string
  dia_semana: number
  turno: 'mañana' | 'tarde'
  repartidor_id: string | null
  zonas?: { nombre: string } | null
  usuarios?: { nombre: string; apellido?: string | null } | null
}

interface CalendarioSemanalWrapperProps {
  semanaInicio: string
  planes: Plan[]
  zonas: ZonaOption[]
  repartidores: RepartidorOption[]
}

export default function CalendarioSemanalWrapper({
  semanaInicio,
  planes,
  zonas,
  repartidores,
}: CalendarioSemanalWrapperProps) {
  const router = useRouter()

  const handlePlanChange = () => {
    router.refresh()
  }

  // Transformar planes para que coincidan con el tipo esperado
  const planesTransformados = planes.map((plan) => ({
    ...plan,
    zona: plan.zonas ? { nombre: plan.zonas.nombre } : undefined,
    repartidor: plan.usuarios
      ? { nombre: plan.usuarios.nombre, apellido: plan.usuarios.apellido }
      : undefined,
  }))

  return (
    <CalendarioSemanal
      semanaInicio={semanaInicio}
      planes={planesTransformados}
      zonas={zonas}
      repartidores={repartidores}
      onPlanChange={handlePlanChange}
    />
  )
}

