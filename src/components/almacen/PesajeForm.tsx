'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Scale, CheckCircle, AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { PesajeItemCard } from './PesajeItemCard'
import { useEffect } from 'react'

interface ItemPesable {
  id: string
  pesable: boolean
  peso_final?: number | null
  cantidad_solicitada: number
  cantidad_reservada: number
  subtotal_est: number
  subtotal_final?: number | null
  producto?: {
    nombre?: string
    codigo?: string
    categoria?: string
    precio_venta?: number
    venta_mayor_habilitada?: boolean
    kg_por_unidad_mayor?: number | null
    unidad_mayor_nombre?: string
    unidad_medida?: string | null
  }
  lista_precio?: {
    tipo?: string | null
  } | null
}

interface Presupuesto {
  id: string
  numero_presupuesto: string
  total_estimado?: number
  total_final?: number | null
  cliente?: {
    nombre?: string
  }
  lista_precio?: {
    tipo?: string | null
  } | null
}

interface PesajeFormProps {
  presupuesto: Presupuesto
  itemsPesables: ItemPesable[]
  presupuestoId: string
}

export function PesajeForm({ presupuesto, itemsPesables, presupuestoId }: PesajeFormProps) {
  const router = useRouter()
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run-debug-4',hypothesisId:'H6',location:'PesajeForm:mount',message:'PesajeForm mounted',data:{presupuestoId,listaTipo:presupuesto.lista_precio?.tipo,totalItems:itemsPesables.length,items:itemsPesables.slice(0,5).map(it=>({id:it.id,cant:it.cantidad_solicitada,reservada:it.cantidad_reservada,pesable:it.pesable,producto:{codigo:it.producto?.codigo,venta_mayor:it.producto?.venta_mayor_habilitada,kg_por_unidad_mayor:it.producto?.kg_por_unidad_mayor}}))},timestamp:Date.now()})}).catch(()=>{})
  }, [presupuestoId, presupuesto.lista_precio?.tipo, itemsPesables])
  // #endregion

  // Helper para determinar si un item es pesable
  function esItemPesable(item: ItemPesable): boolean {
    if (item.pesable === true) {
      return true
    }
    return Boolean(
      item.producto?.categoria &&
      typeof item.producto.categoria === 'string' &&
      item.producto.categoria.toUpperCase().trim() === 'BALANZA'
    )
  }

  const itemsCompletados = itemsPesables.filter((item) => item.peso_final)
  const progresoPesaje = itemsPesables.length > 0 ? (itemsCompletados.length / itemsPesables.length) * 100 : 0
  const todosPesados = itemsCompletados.length === itemsPesables.length

  const handleActualizarPeso = async (itemId: string, peso: number) => {
    setUpdatingItems((prev) => new Set(prev).add(itemId))
    try {
      const response = await fetch('/api/almacen/presupuesto/pesaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuesto_item_id: itemId,
          peso_final: peso
        })
      })

      const result = await response.json()

      if (result.success) {
        router.refresh()
      } else {
        alert(result.message || 'Error al actualizar el peso')
      }
    } catch (error) {
      console.error('Error actualizando peso:', error)
      alert('Error de conexión')
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  // Finalizar pesaje sin convertir a pedido (solo actualiza totales, mantiene en 'en_almacen')
  const handleFinalizarPesaje = async () => {
    setIsFinalizing(true)
    try {
      const response = await fetch('/api/almacen/presupuesto/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presupuesto_id: presupuestoId
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || 'Pesaje finalizado correctamente. El presupuesto seguirá disponible en Presupuestos del Día.')
        router.push('/almacen/presupuestos-dia')
      } else {
        alert(result.message || 'Error al finalizar el pesaje')
        setIsFinalizing(false)
      }
    } catch (error) {
      console.error('Error finalizando pesaje:', error)
      alert('Error de conexión')
      setIsFinalizing(false)
    }
  }

  // Convertir a pedido y finalizar (convierte a pedido, cambia estado a 'facturado')
  const handleConvertirAPedido = async () => {
    setIsConverting(true)
    try {
      const formData = new FormData()
      formData.append('presupuesto_id', presupuestoId)

      const response = await fetch('/api/almacen/presupuesto/convertir-pedido', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message || 'Presupuesto convertido a pedido exitosamente')
        if (result.data?.pedido_id) {
          router.push(`/almacen/pedidos/${result.data.pedido_id}`)
        } else if (result.data?.numero_pedido) {
          // Si tenemos el número de pedido, buscar el ID
          router.push('/almacen/pedidos')
        } else {
          router.push('/almacen/presupuestos-dia')
        }
      } else {
        alert(result.message || 'Error al convertir a pedido')
        setIsConverting(false)
      }
    } catch (error) {
      console.error('Error convirtiendo a pedido:', error)
      alert('Error de conexión')
      setIsConverting(false)
    }
  }

  const handleSimularPeso = async (itemId: string) => {
    try {
      // Buscar el item para obtener cantidad solicitada
      const item = itemsPesables.find((i) => i.id === itemId)
      if (!item) return

      const response = await fetch(`/api/almacen/simular-peso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuesto_item_id: itemId })
      })
      const data = await response.json()
      if (data.success && data.peso_simulado) {
        const input = document.getElementById(`peso-${itemId}`) as HTMLInputElement
        if (input) {
          input.value = data.peso_simulado.toString()
          // Disparar evento onChange para actualizar la previsualización
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    } catch (error) {
      console.error('Error simulando peso:', error)
    }
  }

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
          <Button
            type="button"
            size="lg"
            className="bg-green-600 hover:bg-green-700"
            onClick={handleFinalizarPesaje}
            disabled={isFinalizing}
          >
            {isFinalizing ? (
              <>
                <Scale className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Finalizar Presupuesto
              </>
            )}
          </Button>
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
        {itemsPesables.map((item) => {
          const estaPesado = !!item.peso_final
          const estaActualizando = updatingItems.has(item.id)

          return (
            <PesajeItemCard
              key={item.id}
              item={item}
          esMayorista={
            item.producto?.venta_mayor_habilitada === true &&
            (item.lista_precio?.tipo === 'mayorista' || presupuesto.lista_precio?.tipo === 'mayorista')
          }
          kgPorUnidadMayor={item.producto?.kg_por_unidad_mayor}
          unidadMayorNombre={item.producto?.unidad_mayor_nombre}
              estaPesado={estaPesado}
              estaActualizando={estaActualizando}
              onSimularPeso={async () => {
                await handleSimularPeso(item.id)
              }}
              onAplicarPeso={async (peso: number) => {
                await handleActualizarPeso(item.id, peso)
              }}
            />
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

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <CheckCircle className="h-4 w-4" />
                <span>Si solo finalizas el pesaje, el presupuesto seguirá disponible en Presupuestos del Día para convertir a pedido más tarde.</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Si conviertes a pedido, se creará el pedido real y se descontarán las existencias del almacén.</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="lg"
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
                onClick={handleFinalizarPesaje}
                disabled={isFinalizing || isConverting}
              >
                {isFinalizing ? (
                  <>
                    <Scale className="mr-2 h-4 w-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Solo Finalizar Pesaje
                  </>
                )}
              </Button>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConvertirAPedido}
                disabled={isFinalizing || isConverting}
              >
                {isConverting ? (
                  <>
                    <Scale className="mr-2 h-4 w-4 animate-spin" />
                    Convirtiendo...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Convertir a Pedido y Finalizar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

