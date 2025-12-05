import { Suspense } from 'react'
import { NuevoAdelantoForm } from './adelanto-form'

export const dynamic = 'force-dynamic'
export default function NuevoAdelantoPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Cargando formulario...</div>}>
        <NuevoAdelantoForm />
      </Suspense>
    </div>
  )
}

