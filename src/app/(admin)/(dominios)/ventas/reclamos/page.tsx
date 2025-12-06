import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { ReclamosTableWrapper } from './reclamos-table-wrapper'
import { ReclamosFiltros } from './reclamos-filtros'

export const metadata = {
  title: 'Reclamos | Avícola del Sur',
  description: 'Gestión de reclamos de clientes',
}

export const revalidate = 300 // Revalida cada 5 minutos

function ReclamosTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded" />
    </div>
  )
}

export default function ReclamosPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Reclamos</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Gestión y seguimiento de reclamos de clientes
            </p>
          </div>
          <Button asChild>
            <Link href="/ventas/reclamos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Reclamo
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<ReclamosTableSkeleton />}>
        <ReclamosFiltros />
      </Suspense>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Reclamos</CardTitle>
          <CardDescription className="text-base mt-1">
            Todos los reclamos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ReclamosTableSkeleton />}>
            <ReclamosTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

