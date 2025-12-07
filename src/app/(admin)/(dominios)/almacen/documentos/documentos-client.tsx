'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, FileSearch, Sparkles } from 'lucide-react'

type Documento = {
  id: string
  tipo: string
  estado: 'procesando' | 'completado' | 'error'
  archivo_url: string | null
  datos_extraidos?: Record<string, any> | null
  created_at?: string
}

const estadoToVariant: Record<Documento['estado'], 'secondary' | 'default' | 'destructive'> = {
  procesando: 'secondary',
  completado: 'default',
  error: 'destructive',
}

export default function DocumentosClient({ documentos }: { documentos: Documento[] }) {
  const [tipo, setTipo] = useState<'factura' | 'remito' | 'recibo'>('factura')
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<Documento[]>(documentos)
  const [loading, setLoading] = useState(false)
  const [estado, setEstado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async () => {
    if (!file) {
      setError('Seleccioná un archivo')
      return
    }

    setLoading(true)
    setError(null)
    setEstado(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tipo', tipo)
      formData.append('archivoUrl', file.name || 'documento')

      const resp = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData,
      })
      const data = await resp.json()

      if (!resp.ok || !data.success) {
        setError(data.error || 'No se pudo procesar el documento')
        return
      }

      const nuevo: Documento = {
        id: data.data?.id || crypto.randomUUID(),
        tipo: data.data?.tipo || tipo,
        estado: data.data?.estado || 'procesando',
        archivo_url: file.name,
        datos_extraidos: data.data?.datosExtraidos || null,
        created_at: new Date().toISOString(),
      }

      setItems((prev) => [nuevo, ...prev])
      setEstado('Documento enviado a Document AI')
      setFile(null)
    } catch (err: any) {
      setError(err?.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-5 w-5" />
          IA en Almacén
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Procesamiento de Documentos</h1>
        <p className="text-muted-foreground max-w-3xl">
          Sube facturas o remitos y deja que Document AI extraiga la información. Los resultados se
          guardan en `documentos_procesados` junto al enlace del archivo.
        </p>
        {estado && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              Nuevo documento
            </CardTitle>
            <CardDescription>Procesa facturas, remitos o recibos con Document AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="factura">Factura</option>
                <option value="remito">Remito</option>
                <option value="recibo">Recibo</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Archivo (PDF / imagen)</Label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Se envía a `/api/documents/process` y se guarda en `documentos_procesados`.
              </p>
            </div>
            <Button onClick={handleUpload} disabled={loading} className="w-full">
              {loading ? 'Procesando...' : 'Enviar a Document AI'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Últimos documentos
            </CardTitle>
            <CardDescription>Historial reciente almacenado en Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">Todavía no hay documentos procesados.</p>
            )}
            {items.length > 0 && (
              <ScrollArea className="h-80 rounded-lg border">
                <div className="divide-y">
                  {items.map((doc) => (
                    <div key={doc.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold capitalize">{doc.tipo}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.created_at
                              ? new Date(doc.created_at).toLocaleString('es-AR')
                              : 'Ahora mismo'}
                          </p>
                        </div>
                        <Badge variant={estadoToVariant[doc.estado]} className="capitalize">
                          {doc.estado}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground break-all">
                        {doc.archivo_url || 'Sin URL'}
                      </p>
                      {doc.datos_extraidos && (
                        <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">Datos extraídos</p>
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(doc.datos_extraidos, null, 2).slice(0, 600)}
                            {JSON.stringify(doc.datos_extraidos, null, 2).length > 600 ? '...' : ''}
                          </pre>
                        </div>
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

