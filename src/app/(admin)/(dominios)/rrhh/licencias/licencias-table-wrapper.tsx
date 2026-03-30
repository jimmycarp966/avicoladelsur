'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotificationStore } from '@/store/notificationStore'
import { aprobarLicenciaAction, rechazarLicenciaAction } from '@/actions/rrhh.actions'
import { LicenciasTable } from '@/components/tables/LicenciasTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { getEmpleadoNombre } from '@/lib/utils/empleado-display'
import type { Licencia } from '@/types/domain.types'

type LicenciasTableWrapperProps = {
  licencias: Licencia[]
  canApprove: boolean
}

export function LicenciasTableWrapper({ licencias, canApprove }: LicenciasTableWrapperProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [selectedLicencia, setSelectedLicencia] = useState<Licencia | null>(null)

  const handleApprove = async (licencia: Licencia) => {
    const result = await aprobarLicenciaAction(licencia.id)

    if (result.success) {
      showToast('success', result.message || 'Licencia aprobada exitosamente', 'Licencia aprobada')
      setSelectedLicencia(null)
      router.refresh()
      return
    }

    showToast('error', result.error || 'No se pudo aprobar la licencia', 'Error')
  }

  const handleReject = async (licencia: Licencia) => {
    const result = await rechazarLicenciaAction(licencia.id)

    if (result.success) {
      showToast('success', result.message || 'Licencia rechazada exitosamente', 'Licencia rechazada')
      setSelectedLicencia(null)
      router.refresh()
      return
    }

    showToast('error', result.error || 'No se pudo rechazar la licencia', 'Error')
  }

  const licenciaSeleccionada = useMemo(() => {
    if (!selectedLicencia) return null
    return licencias.find((licencia) => licencia.id === selectedLicencia.id) || selectedLicencia
  }, [licencias, selectedLicencia])

  const handleView = (licencia: Licencia) => {
    setSelectedLicencia(licencia)
  }

  const certificadoUrl =
    licenciaSeleccionada?.certificado_signed_url || licenciaSeleccionada?.certificado_url || null
  const empleadoNombre = licenciaSeleccionada?.empleado
    ? getEmpleadoNombre(licenciaSeleccionada.empleado)
    : 'Sin nombre'

  const renderRevisionBadge = () => {
    switch (licenciaSeleccionada?.estado_revision) {
      case 'aprobado':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprobada</Badge>
      case 'rechazado':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rechazada</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente</Badge>
    }
  }

  return (
    <>
      <LicenciasTable
        licencias={licencias}
        onView={handleView}
        onApprove={canApprove ? handleApprove : undefined}
        onReject={canApprove ? handleReject : undefined}
      />

      <Dialog open={Boolean(licenciaSeleccionada)} onOpenChange={(open) => !open && setSelectedLicencia(null)}>
        <DialogContent className="flex max-h-[95vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col overflow-hidden p-0 sm:w-full">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle>Detalle de licencia</DialogTitle>
            <DialogDescription>
              Revisa la información y el certificado antes de aprobar o rechazar la solicitud.
            </DialogDescription>
          </DialogHeader>

          {licenciaSeleccionada && (
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="grid gap-4 rounded-lg border bg-slate-50/60 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empleado</p>
                    <p className="text-sm font-semibold text-foreground">{empleadoNombre}</p>
                    {licenciaSeleccionada.empleado?.legajo && (
                      <p className="text-xs text-muted-foreground">Legajo: {licenciaSeleccionada.empleado.legajo}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo</p>
                    <p className="text-sm font-semibold capitalize text-foreground">
                      {licenciaSeleccionada.tipo.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periodo</p>
                    <p className="text-sm text-foreground">
                      {formatDate(licenciaSeleccionada.fecha_inicio)} al {formatDate(licenciaSeleccionada.fecha_fin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dias</p>
                    <p className="text-sm text-foreground">{licenciaSeleccionada.dias_total} dias</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Presentacion</p>
                    <p className="text-sm text-foreground">
                      {licenciaSeleccionada.fecha_presentacion_certificado
                        ? formatDate(licenciaSeleccionada.fecha_presentacion_certificado)
                        : 'No informada'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Revision</p>
                    <div className="pt-1">{renderRevisionBadge()}</div>
                  </div>
                </div>

                {licenciaSeleccionada.observaciones && (
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observaciones</p>
                    <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                      {licenciaSeleccionada.observaciones}
                    </p>
                  </div>
                )}

                <div className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Certificado adjunto
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {licenciaSeleccionada.tipo === 'vacaciones'
                          ? 'Vacaciones no requieren certificado.'
                          : certificadoUrl
                            ? 'Vista previa disponible para revision.'
                            : 'No hay certificado cargado.'}
                      </p>
                    </div>
                    {certificadoUrl && (
                      <Button type="button" variant="outline" asChild>
                        <a href={certificadoUrl} target="_blank" rel="noreferrer">
                          Abrir en una pestaña
                        </a>
                      </Button>
                    )}
                  </div>

                  {certificadoUrl && (
                    <div className="mt-4 overflow-hidden rounded-lg border bg-slate-100">
                      <iframe
                        src={certificadoUrl}
                        title={`Certificado de ${empleadoNombre}`}
                        className="h-[52vh] min-h-[320px] w-full bg-white sm:h-[60vh]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4 lg:sticky lg:top-0">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado actual</p>
                  <div className="mt-2">{renderRevisionBadge()}</div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {licenciaSeleccionada.fecha_limite_presentacion && (
                    <p>Limite de presentacion: {formatDate(licenciaSeleccionada.fecha_limite_presentacion)}</p>
                  )}
                  <p>La resolucion de esta licencia es completamente manual.</p>
                </div>
              </div>
            </div>
            </div>
          )}

          <DialogFooter className="border-t bg-background px-4 py-4 sm:justify-between sm:px-6">
            <Button type="button" variant="outline" onClick={() => setSelectedLicencia(null)}>
              Cerrar
            </Button>
            {licenciaSeleccionada && canApprove && !licenciaSeleccionada.aprobado && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void handleReject(licenciaSeleccionada)}>
                  Rechazar
                </Button>
                <Button type="button" className="w-full sm:w-auto" onClick={() => void handleApprove(licenciaSeleccionada)}>
                  Aprobar
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
