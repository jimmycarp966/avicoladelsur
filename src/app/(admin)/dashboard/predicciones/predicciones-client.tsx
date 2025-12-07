'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, Brain, Radar, Siren } from 'lucide-react'

type Producto = {
  id: string
  nombre: string
}

type Prediccion = {
  productoId: string
  productoNombre: string
  cantidadPredicha: number
  confianza: number
  fechaPrediccion: string
  diasRestantes?: number
  tendencia?: string
  factores?: string[]
}

type Alerta = {
  id: string
  productoId: string
  productoNombre: string
  tipo: string
  mensaje: string
  diasRestantes: number
  stockActual: number
  demandaPrevista: number
  accionSugerida: string
  created_at: string
  resuelta: boolean
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR')
}

export default function PrediccionesClient({ productos }: { productos: Producto[] }) {
  const [productoId, setProductoId] = useState(productos[0]?.id ?? '')
  const [diasFuturos, setDiasFuturos] = useState(7)
  const [prediccionIndividual, setPrediccionIndividual] = useState<Prediccion | null>(null)
  const [prediccionesBatch, setPrediccionesBatch] = useState<Prediccion[]>([])
  const [batchResumen, setBatchResumen] = useState<{ prediccionesGeneradas: number; totalProductos: number } | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [estado, setEstado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  const productosOrdenados = useMemo(
    () => [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [productos]
  )

  const handlePrediccion = async () => {
    if (!productoId) {
      setError('Seleccioná un producto')
      return
    }

    setLoading('prediccion')
    setError(null)
    setEstado(null)

    try {
      const resp = await fetch(
        `/api/predictions/demand?productoId=${productoId}&diasFuturos=${diasFuturos}`,
        { method: 'GET' }
      )
      const data = await resp.json()

      if (!resp.ok || !data.success) {
        setError(data.error || 'No se pudo obtener la predicción')
        return
      }

      setPrediccionIndividual(data.data as Prediccion)
      setEstado('Predicción generada')
    } catch (err: any) {
      setError(err?.message || 'Error desconocido')
    } finally {
      setLoading(null)
    }
  }

  const handleGenerarTodas = async () => {
    setLoading('batch')
    setError(null)
    setEstado(null)
    setPrediccionesBatch([])

    try {
      const resp = await fetch('/api/predictions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diasFuturos }),
      })
      const data = await resp.json()

      if (!resp.ok || !data.success) {
        setError(data.error || 'No se pudieron generar predicciones')
        return
      }

      setPrediccionesBatch((data.data?.predicciones || []) as Prediccion[])
      setBatchResumen({
        prediccionesGeneradas: data.data?.prediccionesGeneradas || 0,
        totalProductos: data.data?.totalProductos || 0,
      })
      setEstado('Predicciones generadas')
    } catch (err: any) {
      setError(err?.message || 'Error desconocido')
    } finally {
      setLoading(null)
    }
  }

  const handleAlertas = async () => {
    setLoading('alertas')
    setError(null)
    setEstado(null)

    try {
      const resp = await fetch('/api/predictions/alerts')
      const data = await resp.json()

      if (!resp.ok || !data.success) {
        setError(data.error || 'No se pudieron obtener las alertas')
        return
      }

      setAlertas((data.data || []) as Alerta[])
      setEstado('Alertas actualizadas')
    } catch (err: any) {
      setError(err?.message || 'Error desconocido')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Brain className="h-5 w-5" />
          Inteligencia Artificial
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Predicciones y Alertas IA</h1>
        <p className="text-muted-foreground max-w-3xl">
          Generá predicciones de demanda, levantá alertas de rotura de stock y centralizá el
          output de Vertex/Document AI en un solo lugar. Todo se ejecuta con los endpoints ya
          configurados en `/api/predictions/*`.
        </p>
        {estado && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            <Radar className="h-4 w-4" />
            {estado}
          </div>
        )}
        {error && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Predicción puntual
            </CardTitle>
            <CardDescription>Consulta rápida por producto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Producto</Label>
              <select
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleccioná un producto</option>
                {productosOrdenados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Días a predecir</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={diasFuturos}
                onChange={(e) => setDiasFuturos(Number(e.target.value) || 7)}
              />
              <p className="text-xs text-muted-foreground">
                Usa Vertex AI si está configurado, sino recurre al modelo básico.
              </p>
            </div>
            <Button
              onClick={handlePrediccion}
              disabled={loading === 'prediccion'}
              className="w-full"
            >
              {loading === 'prediccion' ? 'Calculando...' : 'Generar predicción'}
            </Button>

            {prediccionIndividual && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{prediccionIndividual.productoNombre}</p>
                  <Badge variant="secondary">
                    Confianza {(prediccionIndividual.confianza * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    Cantidad predicha: <span className="font-semibold">{prediccionIndividual.cantidadPredicha} kg</span>
                  </p>
                  <p className="text-muted-foreground">
                    Días restantes de stock:{' '}
                    <span className="font-semibold">
                      {prediccionIndividual.diasRestantes ?? '-'}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Tendencia: <span className="capitalize font-semibold">{prediccionIndividual.tendencia || 'n/d'}</span>
                  </p>
                  {prediccionIndividual.factores && prediccionIndividual.factores.length > 0 && (
                    <div className="text-xs mt-1">
                      Factores: {prediccionIndividual.factores.join(' · ')}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Última predicción: {formatDate(prediccionIndividual.fechaPrediccion)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              Batch de predicciones
            </CardTitle>
            <CardDescription>Genera para todos los productos activos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGenerarTodas}
              disabled={loading === 'batch' || productos.length === 0}
              className="w-full"
            >
              {loading === 'batch' ? 'Generando...' : 'Generar para todos'}
            </Button>
            {batchResumen && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span>Generadas</span>
                  <strong>{batchResumen.prediccionesGeneradas} / {batchResumen.totalProductos}</strong>
                </div>
                <p className="text-muted-foreground">
                  Guardadas en BD vía `fn_registrar_prediccion_demanda`.
                </p>
              </div>
            )}
            {prediccionesBatch.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <p className="text-sm font-semibold">Últimas predicciones</p>
                <ScrollArea className="h-64 rounded-lg border">
                  <div className="divide-y">
                    {prediccionesBatch.map((pred) => (
                      <div key={pred.productoId} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{pred.productoNombre}</p>
                          <Badge variant="outline" className="capitalize">
                            {pred.tendencia || 'media'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pred.cantidadPredicha} kg · Confianza {(pred.confianza * 100).toFixed(0)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Días restantes: {pred.diasRestantes ?? '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-primary" />
              Alertas IA
            </CardTitle>
            <CardDescription>Riesgo de rotura de stock y demanda alta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              onClick={handleAlertas}
              disabled={loading === 'alertas'}
              className="w-full"
            >
              {loading === 'alertas' ? 'Cargando...' : 'Actualizar alertas'}
            </Button>
            {alertas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay alertas activas todavía. Generá predicciones para que se creen automáticamente.
              </p>
            )}
            {alertas.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border">
                <div className="divide-y">
                  {alertas.map((alerta) => (
                    <div key={alerta.id} className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{alerta.productoNombre}</p>
                        <Badge variant="destructive">{alerta.tipo.replace('_', ' ')}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alerta.mensaje}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {formatNumber(alerta.stockActual)} · Demanda diaria: {formatNumber(alerta.demandaPrevista)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Días restantes: {alerta.diasRestantes ?? '-'} · {formatDate(alerta.created_at)}
                      </p>
                      {alerta.accionSugerida && (
                        <p className="text-xs font-medium text-primary">{alerta.accionSugerida}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

