import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FacturasTable } from '@/components/tables/FacturasTable'
import { FacturasTableSkeleton } from '@/components/tables/FacturasTableSkeleton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Facturas - Avícola del Sur ERP',
  description: 'Listado de facturas internas generadas a partir de pedidos',
}

export default function FacturasPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Facturas</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Historial de facturas internas generadas desde pedidos de clientes
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Facturas</CardTitle>
          <CardDescription className="text-base mt-1">
            Todas las facturas emitidas por el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FacturasTableSkeleton />}>
            <FacturasTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}


