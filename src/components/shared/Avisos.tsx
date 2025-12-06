'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Info, Megaphone, Package, CheckCircle, Clock, TrendingDown, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface AvisosProps {
  scope: 'admin' | 'sucursal' | 'rrhh'
  sucursalId?: string
  className?: string
}

// Tipos de aviso disponibles
type TipoAviso = 'novedad' | 'alerta_stock'

interface AvisoItem {
  id: string
  tipo: TipoAviso
  titulo: string
  mensaje: string
  prioridad: 'urgente' | 'alta' | 'normal' | 'baja'
  fecha: string
  activo: boolean
  metadata?: any
}

export function Avisos({ scope, sucursalId, className = '' }: AvisosProps) {
  const [avisos, setAvisos] = useState<AvisoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAvisos() {
      try {
        const params = new URLSearchParams()
        if (sucursalId) params.append('sucursal_id', sucursalId)
        params.append('scope', scope)

        const response = await fetch(`/api/avisos?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setAvisos(data.data)
          }
        }
      } catch (error) {
        console.error('Error al obtener avisos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAvisos()
  }, [scope, sucursalId])

  // Filtrar avisos según scope
  const getAvisosFiltrados = () => {
    return avisos.filter(aviso => aviso.activo)
  }

  const avisosFiltrados = getAvisosFiltrados()

  const getPrioridadIcon = (prioridad: string) => {
    switch (prioridad) {
      case 'urgente':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'alta':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
      case 'normal':
        return <Info className="w-4 h-4 text-blue-500" />
      case 'baja':
        return <Info className="w-4 h-4 text-gray-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  const getTipoIcon = (tipo: TipoAviso) => {
    switch (tipo) {
      case 'novedad':
        return <Megaphone className="w-4 h-4 text-blue-500" />
      case 'alerta_stock':
        return <Package className="w-4 h-4 text-red-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  const getPrioridadBadge = (prioridad: string) => {
    const variants = {
      urgente: 'destructive',
      alta: 'default',
      normal: 'secondary',
      baja: 'outline'
    } as const

    return (
      <Badge variant={variants[prioridad as keyof typeof variants] || 'outline'}>
        {prioridad}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            Avisos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Cargando avisos...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Avisos
          {avisosFiltrados.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {avisosFiltrados.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {scope === 'sucursal' && 'Novedades importantes y alertas de stock'}
          {scope === 'rrhh' && 'Sistema de comunicaciones internas'}
          {scope === 'admin' && 'Todos los avisos del sistema'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {avisosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p>No hay avisos pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {avisosFiltrados.map((aviso) => (
              <div
                key={aviso.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getTipoIcon(aviso.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm truncate">
                      {aviso.titulo}
                    </h4>
                    {getPrioridadBadge(aviso.prioridad)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {aviso.mensaje}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDate(aviso.fecha)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Acciones según scope */}
        <div className="mt-4 pt-4 border-t">
          {scope === 'sucursal' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/sucursal/alerts">
                  <Package className="w-4 h-4 mr-2" />
                  Ver Alertas Stock
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href="/sucursal/novedades">
                  <Megaphone className="w-4 h-4 mr-2" />
                  Ver Novedades
                </Link>
              </Button>
            </div>
          )}

          {scope === 'rrhh' && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/rrhh/novedades/nueva">
                <Plus className="w-4 h-4 mr-2" />
                Crear Novedad
              </Link>
            </Button>
          )}

          {scope === 'admin' && (
            <Tabs defaultValue="todos" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="novedades">RRHH</TabsTrigger>
                <TabsTrigger value="alertas">Stock</TabsTrigger>
              </TabsList>
              <TabsContent value="todos" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  Vista consolidada de todos los avisos
                </p>
              </TabsContent>
              <TabsContent value="novedades" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  Solo comunicaciones de RRHH
                </p>
              </TabsContent>
              <TabsContent value="alertas" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  Solo alertas de stock por sucursal
                </p>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
