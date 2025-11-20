import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Scale, CheckCircle, AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { obtenerPresupuestoAction, actualizarPesoItemAction, confirmarPresupuestoAction } from '@/actions/presupuestos.actions'
import { PesajeSkeleton } from './pesaje-skeleton'

interface PesajePageProps {
  params: {
    id: string
  }
}

async function PesajeContent({ presupuestoId }: { presupuestoId: string }) {
  const result = await obtenerPresupuestoAction(presupuestoId)

  if (!result.success || !result.data) {
    notFound()
  }

  const presupuesto = result.data

  // Filtrar solo items pesables
  const itemsPesables = presupuesto.items?.filter((item: any) => item.pesable) || []

  if (itemsPesables.length === 0) {
    return (
      <div className="text-center py-8">
        <Scale className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No hay items pesables</h3>
        <p className="text-muted-foreground">
          Este presupuesto no tiene productos que requieran pesaje
        </p>
        <Button asChild className="mt-4">
          <Link href={`/ventas/presupuestos/${presupuestoId}`}>
            Volver al Presupuesto
          </Link>
        </Button>
      </div>
    )
  }

  async function handleActualizarPeso(formData: FormData) {
    'use server'

    const itemId = formData.get('item_id') as string
    const peso = parseFloat(formData.get('peso') as string)

    if (!itemId || !peso || peso <= 0) {
      return { success: false, message: 'Datos inválidos' }
    }

    const result = await actualizarPesoItemAction({
      presupuesto_item_id: itemId,
      peso_final: peso,
    })

    return result
  }

  async function handleFinalizarPesaje() {
    'use server'

    const result = await confirmarPresupuestoAction({
      presupuesto_id: presupuestoId,
      // caja_id opcional
    })

    return result
  }

  const itemsCompletados = itemsPesables.filter((item: any) => item.peso_final)
  const progresoPesaje = itemsPesables.length > 0 ? (itemsCompletados.length / itemsPesables.length) * 100 : 0
  const todosPesados = itemsCompletados.length === itemsPesables.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/almacen/presupuestos-dia">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Presupuestos del Día
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Pesaje - {presupuesto.numero_presupuesto}</h1>
            <Badge variant="outline" className="bg-blue-50">
              <Scale className="mr-1 h-3 w-3" />
              BALANZA
            </Badge>
          </div>
          <p className="text-muted-foreground">Cliente: {presupuesto.cliente?.nombre}</p>
        </div>
        {todosPesados && (
          <form action={handleFinalizarPesaje}>
            <Button type="submit" size="lg" className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" />
              Finalizar Presupuesto
            </Button>
          </form>
        )}
      </div>

      {/* Barra de progreso */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Progreso del Pesaje</h3>
            <Badge variant={todosPesados ? "default" : "secondary"}>
              {itemsCompletados.length}/{itemsPesables.length} items
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progresoPesaje}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground">
            {progresoPesaje.toFixed(0)}% completado
            {todosPesados && " - Listo para finalizar"}
          </p>
        </CardContent>
      </Card>

      {/* Items pesables */}
      <div className="grid gap-4">
        {itemsPesables.map((item: any) => {
          const estaPesado = !!item.peso_final

          return (
            <Card key={item.id} className={estaPesado ? "border-green-200 bg-green-50/50" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${estaPesado ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <Scale className={`h-5 w-5 ${estaPesado ? 'text-green-600' : 'text-orange-600'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{item.producto?.nombre}</CardTitle>
                      <CardDescription>
                        Código: {item.producto?.codigo} |
                        Solicitado: {item.cantidad_solicitada}kg |
                        Reservado: {item.cantidad_reservada}kg
                      </CardDescription>
                    </div>
                  </div>
                  {estaPesado && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Pesado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <form action={handleActualizarPeso} className="space-y-4">
                  <input type="hidden" name="item_id" value={item.id} />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`peso-${item.id}`}>Peso Final (kg)</Label>
                      <Input
                        id={`peso-${item.id}`}
                        name="peso"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        defaultValue={item.peso_final || ""}
                        required
                        className="text-lg"
                      />
                    </div>
                    <div>
                      <Label>Precio por KG</Label>
                      <div className="p-3 bg-gray-50 rounded-md text-lg font-mono">
                        ${item.producto?.precio_venta?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Subtotal estimado: ${(item.subtotal_est || 0).toFixed(2)}
                      {item.subtotal_final && (
                        <span className="ml-2 text-green-600">
                          → Final: ${item.subtotal_final.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          // Simular llamada a API de balanza
                          try {
                            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/almacen/simular-peso`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ presupuesto_item_id: item.id })
                            })
                            const data = await response.json()
                            if (data.success) {
                              // Actualizar el campo de peso
                              const input = document.getElementById(`peso-${item.id}`) as HTMLInputElement
                              if (input) input.value = data.peso_simulado.toString()
                            }
                          } catch (error) {
                            console.error('Error simulando peso:', error)
                          }
                        }}
                      >
                        <Scale className="mr-2 h-4 w-4" />
                        Simular Peso
                      </Button>

                      <Button type="submit" disabled={estaPesado}>
                        {estaPesado ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Actualizado
                          </>
                        ) : (
                          <>
                            <Scale className="mr-2 h-4 w-4" />
                            Aplicar Peso
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Resumen final */}
      {todosPesados && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              Pesaje Completado
            </CardTitle>
            <CardDescription>
              Todos los items pesables han sido procesados. El presupuesto está listo para convertirse en pedido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-sm font-medium">Total Estimado</Label>
                <div className="text-2xl font-bold">${presupuesto.total_estimado?.toFixed(2)}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Final</Label>
                <div className="text-2xl font-bold text-green-600">
                  ${presupuesto.total_final?.toFixed(2) || presupuesto.total_estimado?.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <AlertTriangle className="h-4 w-4" />
              Al finalizar, se creará el pedido real y se descontarán las existencias del almacén.
            </div>

            <form action={handleFinalizarPesaje} className="flex justify-end">
              <Button type="submit" size="lg" className="bg-green-600 hover:bg-green-700">
                <Package className="mr-2 h-4 w-4" />
                Convertir a Pedido y Finalizar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function PesajePage({ params }: PesajePageProps) {
  return (
    <Suspense fallback={<PesajeSkeleton />}>
      <PesajeContent presupuestoId={params.id} />
    </Suspense>
  )
}
