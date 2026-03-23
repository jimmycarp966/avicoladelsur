'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Package, User, MapPin, CheckCircle2, Loader2, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  marcarPreparacionListoAction,
  desmarcarPreparacionListoAction,
} from '@/actions/en-preparacion.actions'
import { PresupuestoIndividualAccion } from '@/components/almacen/PresupuestosDiaAcciones'
import { esVentaMayorista } from '@/lib/utils'
import { esItemPesable } from '@/lib/utils/pesaje'
import type { PresupuestoEnPreparacion } from '@/types/domain.types'

type PresupuestoEnPreparacionVisible = PresupuestoEnPreparacion & {
  pedido_convertido_id?: string | null
  lista_precio?: {
    tipo?: string | null
  } | null
  items?: Array<{
    id: string
    peso_final?: number | null
    cantidad_solicitada: number
    pesable: boolean
    producto?: {
      nombre?: string
      categoria?: string
      codigo?: string
      requiere_pesaje?: boolean
      venta_mayor_habilitada?: boolean
      kg_por_unidad_mayor?: number | null
      unidad_mayor_nombre?: string | null
      unidad_medida?: string | null
    }
    lista_precio?: {
      tipo?: string | null
    } | null
  }>
}

interface EnPreparacionContentProps {
  presupuestos: PresupuestoEnPreparacionVisible[]
}

export function EnPreparacionContent({ presupuestos }: EnPreparacionContentProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const calcularItemsPesables = (presupuesto: PresupuestoEnPreparacionVisible) =>
    (presupuesto.items || []).filter((item) => esItemPesable(item, esVentaMayorista(presupuesto, item)))

  const presupuestosVisibles = presupuestos.filter((presupuesto) => {
    if (presupuesto.pedido_convertido_id) {
      return false
    }

    const itemsPesables = calcularItemsPesables(presupuesto)

    if (itemsPesables.length === 0) {
      return true
    }

    return itemsPesables.some((item) => !item.peso_final)
  })

  const pendientes = presupuestosVisibles.filter((p) => !p.preparacion_completada)
  const completados = presupuestosVisibles.filter((p) => p.preparacion_completada)

  const handleMarcarListo = async (presupuestoId: string) => {
    setLoading(presupuestoId)
    try {
      const result = await marcarPreparacionListoAction(presupuestoId)
      if (result.success) {
        toast.success(result.message || 'Marcado como listo')
        router.refresh()
      } else {
        toast.error(result.error || 'Error al marcar como listo')
      }
    } catch {
      toast.error('Error al marcar como listo')
    } finally {
      setLoading(null)
    }
  }

  const handleDesmarcar = async (presupuestoId: string) => {
    setLoading(presupuestoId)
    try {
      const result = await desmarcarPreparacionListoAction(presupuestoId)
      if (result.success) {
        toast.success(result.message || 'Desmarcado')
        router.refresh()
      } else {
        toast.error(result.error || 'Error al desmarcar')
      }
    } catch {
      toast.error('Error al desmarcar')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-orange-500" />
            En Preparación
          </h1>
          <p className="text-muted-foreground">
            Presupuestos pendientes de pesaje o listos para pasar a pedido
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pendientes.length > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {completados.length > 0 && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {completados.length} listo{completados.length !== 1 ? 's' : ''} para pesaje
            </Badge>
          )}
        </div>
      </div>

      {/* Lista de presupuestos pendientes */}
      {pendientes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pendientes de Preparación
          </h2>
          <div className="grid gap-4">
            {pendientes.map((p) => (
              <PresupuestoCard
                key={p.id}
                presupuesto={p}
                loading={loading === p.id}
                onMarcarListo={() => handleMarcarListo(p.id)}
                onDesmarcar={() => handleDesmarcar(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lista de presupuestos completados */}
      {completados.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Listos para Pesaje
          </h2>
          <div className="grid gap-4">
            {completados.map((p) => (
              <PresupuestoCard
                key={p.id}
                presupuesto={p}
                loading={loading === p.id}
                onMarcarListo={() => handleMarcarListo(p.id)}
                onDesmarcar={() => handleDesmarcar(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {pendientes.length === 0 && completados.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg">No hay presupuestos en preparación</p>
            <p className="text-sm mt-2">
              Los presupuestos en estado <span className="font-mono bg-muted px-1 rounded">en_almacen</span> aparecerán aquí mientras tengan pesables pendientes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface PresupuestoCardProps {
  presupuesto: PresupuestoEnPreparacionVisible
  loading: boolean
  onMarcarListo: () => void
  onDesmarcar: () => void
}

function PresupuestoCard({ presupuesto, loading, onMarcarListo, onDesmarcar }: PresupuestoCardProps) {
  const itemsPesables = (presupuesto.items || []).filter((item) =>
    esItemPesable(item, esVentaMayorista(presupuesto, item))
  )
  const itemsPesados = itemsPesables.filter((item) => item.peso_final)
  const itemsPendientes = Math.max(itemsPesables.length - itemsPesados.length, 0)
  const tienePesables = itemsPesables.length > 0
  const listoParaConvertir = !tienePesables || itemsPendientes === 0
  const isCompletado = presupuesto.preparacion_completada

  return (
    <Card
      className={`border-l-4 transition-all ${
        isCompletado
          ? 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20'
          : 'border-l-orange-500'
      }`}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            #{presupuesto.numero_presupuesto}
            {isCompletado && (
              <Badge variant="success" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Listo para pesaje
              </Badge>
            )}
            {listoParaConvertir && (
              <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700">
                <Scale className="h-3 w-3 mr-1" />
                Listo para pedido
              </Badge>
            )}
          </CardTitle>
          <Button
            variant={isCompletado ? 'outline' : 'default'}
            size="sm"
            onClick={isCompletado ? onDesmarcar : onMarcarListo}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : isCompletado ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Desmarcar
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Listo
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-1 font-medium">
              <User className="h-4 w-4" />
              {presupuesto.cliente?.nombre || 'Cliente sin nombre'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {presupuesto.zona?.nombre || 'Sin zona'}
            </span>
            <Badge variant={presupuesto.turno === 'mañana' ? 'default' : 'secondary'}>
              {presupuesto.turno || 'Sin turno'}
            </Badge>
            <Badge variant="outline">
              {itemsPesados.length}/{itemsPesables.length} pesados
            </Badge>
          </div>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Productos ({presupuesto.items?.length || 0}):
            </p>
            <div className="flex flex-wrap gap-2">
              {presupuesto.items?.map((item: any) => (
                <Badge key={item.id} variant="outline" className="text-xs">
                  {item.producto?.nombre || 'Producto'} x{item.cantidad_solicitada}
                  {item.pesable && ' ⚖️'}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            {tienePesables && itemsPendientes > 0 ? (
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href={`/almacen/presupuesto/${presupuesto.id}/pesaje`}>
                  <Scale className="mr-2 h-4 w-4" />
                  Pesaje ({itemsPendientes})
                </Link>
              </Button>
            ) : (
              <PresupuestoIndividualAccion presupuesto={presupuesto as any} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
