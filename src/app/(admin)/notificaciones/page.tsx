'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, Filter, RefreshCw, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

type Notification = {
  id: string
  titulo: string
  mensaje: string
  tipo: 'info' | 'success' | 'warning' | 'error'
  categoria: string | null
  leida: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

const AREAS: Array<{ value: string; label: string }> = [
  { value: 'ventas', label: 'Ventas' },
  { value: 'almacen', label: 'Almacen' },
  { value: 'reparto', label: 'Reparto' },
  { value: 'tesoreria', label: 'Tesoreria' },
  { value: 'rrhh', label: 'RRHH' },
  { value: 'sucursales', label: 'Sucursales' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'ia', label: 'IA' },
]

const REQUEST_TIMEOUT_MS = 12000

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout al cargar ${label}`))
    }, timeoutMs)

    operation().then(
      (result) => {
        clearTimeout(timeoutId)
        resolve(result)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroLeida, setFiltroLeida] = useState<string>('todos')
  const [filtroArea, setFiltroArea] = useState<string>('todos')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const supabase = useMemo(() => createClient(), [])


  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)

      const {
        data: { session },
      } = await withTimeout(() => supabase.auth.getSession(), REQUEST_TIMEOUT_MS, 'la sesion')

      let userId = session?.user?.id || null
      if (!userId) {
        const {
          data: { user },
        } = await withTimeout(() => supabase.auth.getUser(), REQUEST_TIMEOUT_MS, 'el usuario')
        userId = user?.id || null
      }

      if (!userId) {
        setNotifications([])
        return
      }

      let query = supabase
        .from('notificaciones')
        .select('*')
        .or(`usuario_id.eq.${userId},usuario_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo)
      }

      if (filtroLeida === 'leidas') {
        query = query.eq('leida', true)
      } else if (filtroLeida === 'no_leidas') {
        query = query.eq('leida', false)
      }

      if (filtroArea !== 'todos') {
        if (filtroArea === 'sin_area') {
          query = query.is('categoria', null)
        } else {
          query = query.eq('categoria', filtroArea)
        }
      }

      const { data, error } = await withTimeout(async () => await query, REQUEST_TIMEOUT_MS, 'las notificaciones')
      if (error) throw error

      setNotifications(data || [])
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
      setNotifications([])
      setLoadError('No se pudieron cargar las notificaciones. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [filtroArea, filtroLeida, filtroTipo, supabase])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  async function markAsRead(notificationIds: string[]) {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .in('id', notificationIds)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) => (notificationIds.includes(n.id) ? { ...n, leida: true } : n))
      )
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Error marcando como leida:', error)
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.leida).map((n) => n.id)
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds)
    }
  }

  async function deleteNotifications(notificationIds: string[]) {
    try {
      const { error } = await supabase.from('notificaciones').delete().in('id', notificationIds)
      if (error) throw error

      setNotifications((prev) => prev.filter((n) => !notificationIds.includes(n.id)))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Error eliminando notificaciones:', error)
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  function selectAll() {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)))
    }
  }

  function getNotificationIcon(tipo: string) {
    switch (tipo) {
      case 'success':
        return 'OK'
      case 'warning':
        return '!'
      case 'error':
        return 'X'
      default:
        return 'i'
    }
  }

  function getNotificationColor(tipo: string) {
    switch (tipo) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  function getAreaLabel(area: string | null) {
    if (!area) return 'Sin area'
    return AREAS.find((a) => a.value === area)?.label || area
  }

  const unreadCount = notifications.filter((n) => !n.leida).length

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notificaciones</h1>
            <p className="text-muted-foreground text-sm">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todas leidas'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadNotifications}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Link href="/notificaciones/configuracion">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configuracion
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Exito</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroLeida} onValueChange={setFiltroLeida}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="no_leidas">Sin leer</SelectItem>
                <SelectItem value="leidas">Leidas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroArea} onValueChange={setFiltroArea}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las areas</SelectItem>
                {AREAS.map((area) => (
                  <SelectItem key={area.value} value={area.value}>
                    {area.label}
                  </SelectItem>
                ))}
                <SelectItem value="sin_area">Sin area</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => markAsRead(Array.from(selectedIds))}>
                  <Check className="h-4 w-4 mr-2" />
                  Marcar leida ({selectedIds.size})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteNotifications(Array.from(selectedIds))}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar ({selectedIds.size})
                </Button>
              </div>
            )}

            {unreadCount > 0 && selectedIds.size === 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Marcar todas como leidas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando notificaciones...</div>
        ) : loadError ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <Button variant="outline" size="sm" onClick={loadNotifications}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No hay notificaciones</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-lg">
              <Checkbox
                checked={selectedIds.size === notifications.length}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">
                Seleccionar todas ({notifications.length})
              </span>
            </div>

            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-all ${
                  !notification.leida ? getNotificationColor(notification.tipo) : 'bg-white'
                } ${selectedIds.has(notification.id) ? 'ring-2 ring-primary' : ''}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedIds.has(notification.id)}
                      onCheckedChange={() => toggleSelect(notification.id)}
                    />
                    <span className="text-sm font-semibold w-5 text-center">
                      {getNotificationIcon(notification.tipo)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{notification.titulo}</p>
                          <p className="text-sm text-muted-foreground mt-1">{notification.mensaje}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.leida && (
                            <Badge variant="default" className="bg-blue-500">
                              Nueva
                            </Badge>
                          )}
                          <Badge variant="outline">{getAreaLabel(notification.categoria)}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), 'PPP p', { locale: es })} (
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                        )
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  )
}


