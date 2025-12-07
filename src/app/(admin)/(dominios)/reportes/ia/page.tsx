'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, BookOpenText, Sparkles } from 'lucide-react'

function getFecha(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().split('T')[0]
}

export default function ReportesIA() {
  const [tipo, setTipo] = useState<'semanal' | 'diario' | 'mensual'>('semanal')
  const [fechaInicio, setFechaInicio] = useState(getFecha(-6))
  const [fechaFin, setFechaFin] = useState(getFecha(0))
  const [reporte, setReporte] = useState<{ titulo?: string; contenido?: string; fecha?: string }>({})
  const [pregunta, setPregunta] = useState('')
  const [respuesta, setRespuesta] = useState<string | null>(null)
  const [estado, setEstado] = useState<string | null>(null)
  const [errorReporte, setErrorReporte] = useState<string | null>(null)
  const [errorChat, setErrorChat] = useState<string | null>(null)
  const [loading, setLoading] = useState<'reporte' | 'chat' | null>(null)

  const hayReporte = useMemo(() => Boolean(reporte?.contenido), [reporte])

  const generarReporte = async () => {
    setLoading('reporte')
    setEstado(null)
    setErrorReporte(null)

    try {
      const resp = await fetch('/api/reportes/ia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, fechaInicio, fechaFin }),
      })

      const data = await resp.json()
      if (!resp.ok || !data.success) {
        setErrorReporte(data.error || 'No se pudo generar el reporte')
        return
      }

      setReporte({
        titulo: data.data?.titulo,
        contenido: data.data?.contenido,
        fecha: data.data?.fechaGeneracion,
      })
      setEstado('Reporte generado con Gemini')
    } catch (err: any) {
      setErrorReporte(err?.message || 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  const preguntar = async () => {
    if (!pregunta.trim()) {
      setErrorChat('Escribí una pregunta')
      return
    }

    setLoading('chat')
    setRespuesta(null)
    setErrorChat(null)
    setEstado(null)

    try {
      const resp = await fetch('/api/reportes/ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        setErrorChat(data.error || 'No se pudo obtener respuesta')
        return
      }

      setRespuesta(data.data?.respuesta || '')
      setEstado('Respuesta generada con Gemini')
    } catch (err: any) {
      setErrorChat(err?.message || 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-5 w-5" />
          Inteligencia Artificial
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes IA y Chat</h1>
        <p className="text-muted-foreground max-w-3xl">
          Generá reportes ejecutivos y hacé preguntas en lenguaje natural sobre tus datos. Usa los
          endpoints `/api/reportes/ia/generate` y `/api/reportes/ia/chat` que ya están conectados a
          Gemini.
        </p>
        {estado && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            {estado}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenText className="h-5 w-5 text-primary" />
              Generar reporte IA
            </CardTitle>
            <CardDescription>Resumen ejecutivo con ventas y productos más vendidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as typeof tipo)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="semanal">Semanal</option>
                  <option value="diario">Diario</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
            </div>

            <Button onClick={generarReporte} disabled={loading === 'reporte'} className="w-full">
              {loading === 'reporte' ? 'Generando...' : 'Generar reporte IA'}
            </Button>

            {errorReporte && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errorReporte}
              </div>
            )}

            {hayReporte && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{reporte.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Generado el {reporte.fecha ? new Date(reporte.fecha).toLocaleString('es-AR') : 'ahora'}
                    </p>
                  </div>
                  <Badge variant="outline">IA</Badge>
                </div>
                <Separator />
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                  {reporte.contenido}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Chat de análisis
            </CardTitle>
            <CardDescription>Preguntas en lenguaje natural sobre tus datos recientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pregunta</Label>
              <Textarea
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                placeholder="Ej: ¿Cómo vienen las ventas de esta semana?"
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Contexto: últimos 30 días de pedidos completados.</span>
            </div>
            <Button onClick={preguntar} disabled={loading === 'chat'} className="w-full" variant="secondary">
              {loading === 'chat' ? 'Consultando...' : 'Preguntar a Gemini'}
            </Button>

            {errorChat && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {errorChat}
              </div>
            )}

            {respuesta && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Respuesta</p>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                  {respuesta}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

