'use client'

import { useState } from 'react'
import { Calendar, MapPin, User } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ModalPlan from './modal-plan'

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_SEMANA_COMPLETOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TURNOS = ['mañana', 'tarde'] as const

type ZonaOption = { id: string; nombre: string }
type RepartidorOption = { id: string; nombre: string; apellido?: string | null }
type Plan = {
  id: string
  zona_id: string
  dia_semana: number
  turno: 'mañana' | 'tarde'
  repartidor_id: string | null
  zona?: { nombre: string }
  repartidor?: { nombre: string; apellido?: string | null }
}

interface CalendarioSemanalProps {
  semanaInicio: string // YYYY-MM-DD (lunes)
  planes: Plan[]
  zonas: ZonaOption[]
  repartidores: RepartidorOption[]
  onPlanChange: () => void
}

export default function CalendarioSemanal({
  semanaInicio,
  planes,
  zonas,
  repartidores,
  onPlanChange,
}: CalendarioSemanalProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDia, setSelectedDia] = useState<number | null>(null)
  const [selectedTurno, setSelectedTurno] = useState<'mañana' | 'tarde' | null>(null)

  const getPlan = (diaSemana: number, turno: 'mañana' | 'tarde') => {
    return planes.find((p) => p.dia_semana === diaSemana && p.turno === turno)
  }

  const handleCellClick = (diaSemana: number, turno: 'mañana' | 'tarde') => {
    setSelectedDia(diaSemana)
    setSelectedTurno(turno)
    setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false)
    setSelectedDia(null)
    setSelectedTurno(null)
  }

  const handleSuccess = () => {
    onPlanChange()
  }

  const getPlanExistente = () => {
    if (selectedDia === null || selectedTurno === null) return null
    const plan = getPlan(selectedDia, selectedTurno)
    return plan
      ? {
          id: plan.id,
          zona_id: plan.zona_id,
          repartidor_id: plan.repartidor_id,
        }
      : null
  }

  // Calcular fechas de la semana
  const semanaInicioDate = new Date(semanaInicio)
  const fechasSemana = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(semanaInicioDate)
    fecha.setDate(semanaInicioDate.getDate() + i)
    return fecha
  })

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-8 gap-2">
          {/* Header: Días de la semana */}
          <div className="font-semibold text-sm text-center">Turno / Día</div>
          {DIAS_SEMANA.map((dia, idx) => (
            <div key={idx} className="text-center">
              <div className="font-semibold text-sm">{dia}</div>
              <div className="text-xs text-muted-foreground">
                {fechasSemana[idx].getDate()}/{fechasSemana[idx].getMonth() + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Filas de turnos */}
        {TURNOS.map((turno) => (
          <div key={turno} className="grid grid-cols-8 gap-2">
            <div className="flex items-center justify-center">
              <Badge variant="secondary" className="capitalize">
                {turno}
              </Badge>
            </div>
            {Array.from({ length: 7 }, (_, diaIdx) => {
              const plan = getPlan(diaIdx, turno)
              const tienePlan = !!plan
              const tieneRepartidor = tienePlan && plan.repartidor_id

              return (
                <Card
                  key={`${diaIdx}-${turno}`}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    tienePlan
                      ? 'border-primary bg-primary/5'
                      : 'border-dashed border-muted-foreground/30 bg-muted/30'
                  }`}
                  onClick={() => handleCellClick(diaIdx, turno)}
                >
                  <CardContent className="p-3 space-y-1">
                    {tienePlan ? (
                      <>
                        <div className="flex items-start gap-1 text-xs">
                          <MapPin className="h-3 w-3 mt-0.5 text-primary" />
                          <span className="font-medium line-clamp-1">
                            {plan.zona?.nombre || 'Sin zona'}
                          </span>
                        </div>
                        {tieneRepartidor && (
                          <div className="flex items-start gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3 mt-0.5" />
                            <span className="line-clamp-1">
                              {plan.repartidor?.nombre} {plan.repartidor?.apellido}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground text-center py-2">
                        Vacío
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))}
      </div>

      {selectedDia !== null && selectedTurno !== null && (
        <ModalPlan
          open={modalOpen}
          onClose={handleClose}
          zonas={zonas}
          repartidores={repartidores}
          semanaInicio={semanaInicio}
          diaSemana={selectedDia}
          turno={selectedTurno}
          planExistente={getPlanExistente()}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}

