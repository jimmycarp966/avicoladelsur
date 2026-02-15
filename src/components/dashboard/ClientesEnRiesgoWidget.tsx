'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Phone, Clock, TrendingDown, RefreshCw, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AIStrategyBadge } from '@/components/ai/AIStrategyBadge'
import type { AIMetadata } from '@/types/ai.types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

interface ClienteRiesgo {
  id: string
  nombre: string
  email?: string
  telefono?: string
  ultimaCompra: string
  diasSinComprar: number
  reduccionPorcentaje: number
  nivelRiesgo: 'alto' | 'medio' | 'bajo'
  razon: string
  sugerencia: string
}

export function ClientesEnRiesgoWidget() {
  const [clientes, setClientes] = useState<ClienteRiesgo[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [ai, setAi] = useState<AIMetadata | null>(null)

  useEffect(() => {
    void loadClientes()
  }, [])

  async function loadClientes() {
    try {
      setLoading(true)
      const response = await fetch('/api/predictions/customer-risk')
      const data = await response.json()

      if (data.success) {
        setClientes(data.data || [])
        setTotal(data.total || 0)
      }

      setAi(data.ai || null)
    } catch (error) {
      console.error('Error cargando clientes en riesgo:', error)
    } finally {
      setLoading(false)
    }
  }

  function getRiesgoBadge(nivel: string) {
    switch (nivel) {
      case 'alto':
        return <Badge variant="destructive">Alto</Badge>
      case 'medio':
        return (
          <Badge variant="default" className="bg-yellow-500">
            Medio
          </Badge>
        )
      default:
        return <Badge variant="secondary">Bajo</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Clientes en Riesgo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (clientes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-green-500" />
              Clientes en Riesgo
            </CardTitle>
            <AIStrategyBadge ai={ai} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p>No hay clientes en riesgo</p>
            <p className="text-sm mt-1">Todos tus clientes estan comprando regularmente</p>
            {ai?.reason && <p className="text-xs mt-2">{ai.reason}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Clientes en Riesgo
            {total > 0 && <Badge variant="destructive">{total}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <AIStrategyBadge ai={ai} />
            <Button variant="ghost" size="sm" onClick={loadClientes}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {ai?.reason && <p className="text-xs text-muted-foreground mt-1">{ai.reason}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {clientes.slice(0, 5).map((cliente) => (
            <div
              key={cliente.id}
              className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{cliente.nombre}</p>
                  {getRiesgoBadge(cliente.nivelRiesgo)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{cliente.razon}</p>
                <p className="text-xs text-primary mt-1">{cliente.sugerencia}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Ultima compra:{' '}
                    {formatDistanceToNow(new Date(cliente.ultimaCompra), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                  {cliente.reduccionPorcentaje > 0 && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />-{cliente.reduccionPorcentaje}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                {cliente.telefono && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <a href={`tel:${cliente.telefono}`}>
                      <Phone className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/ventas/clientes/${cliente.id}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {total > 5 && (
          <Link href="/ventas/clientes?filtro=riesgo" className="block mt-4">
            <Button variant="outline" size="sm" className="w-full">
              Ver todos ({total})
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
