import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AI_CAPABILITY_REGISTRY } from '@/lib/ai/capability-registry'

const strategyLabel: Record<string, string> = {
  none: 'Sin IA',
  assisted: 'IA asistida',
  primary: 'IA primaria',
}

const providerLabel: Record<string, string> = {
  none: 'Ninguno',
  gemini: 'Gemini',
  vertex: 'Vertex',
  document_ai: 'Document AI',
}

export default function IACapacidadesPage() {
  const capacidades = Object.values(AI_CAPABILITY_REGISTRY)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Capacidades IA</h1>
        <p className="text-muted-foreground max-w-3xl">
          Inventario operativo de modulos IA del sistema. Muestra estrategia, proveedor y endpoints
          asociados para reducir ambiguedad tecnica.
        </p>
      </div>

      <div className="grid gap-4">
        {capacidades.map((capacidad) => (
          <Card key={capacidad.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{capacidad.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{strategyLabel[capacidad.strategy]}</Badge>
                  <Badge variant="secondary">{providerLabel[capacidad.provider]}</Badge>
                </div>
              </div>
              <CardDescription>{capacidad.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Endpoints</p>
                <div className="text-muted-foreground">
                  {capacidad.endpoints.map((endpoint) => (
                    <div key={endpoint}>
                      <code>{endpoint}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium">UI</p>
                <div className="text-muted-foreground">
                  {capacidad.uiPaths.map((path) => (
                    <div key={path}>
                      <code>{path}</code>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

