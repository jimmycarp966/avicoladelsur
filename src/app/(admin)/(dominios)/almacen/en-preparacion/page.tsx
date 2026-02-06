import { Suspense } from 'react'
import { obtenerPresupuestosEnPreparacionAction } from '@/actions/en-preparacion.actions'
import { EnPreparacionRealtime } from '@/components/almacen/EnPreparacionRealtime'
import { EnPreparacionSkeleton } from './en-preparacion-skeleton'
import { EnPreparacionContent } from './EnPreparacionContent'

export const metadata = {
  title: 'En Preparación - Almacén - Avícola del Sur ERP',
  description: 'Vista de presupuestos en preparación en cámara frigorífica con notificaciones sonoras',
}

async function EnPreparacionPageContent() {
  // Obtener presupuestos en preparación
  const result = await obtenerPresupuestosEnPreparacionAction()
  const presupuestos = result.data || []

  return (
    <>
      {/* Componente Realtime - invisible pero funcional para notificaciones */}
      <EnPreparacionRealtime />

      {/* Contenido principal con acciones de marcar/desmarcar */}
      <EnPreparacionContent presupuestos={presupuestos} />
    </>
  )
}

export default function EnPreparacionPage() {
  return (
    <Suspense fallback={<EnPreparacionSkeleton />}>
      <EnPreparacionPageContent />
    </Suspense>
  )
}
