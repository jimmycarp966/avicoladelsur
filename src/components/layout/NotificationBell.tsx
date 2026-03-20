'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { resolveNotificationLink } from '@/lib/utils/notification-links'

type Notification = {
  id: string
  titulo: string
  mensaje: string
  tipo: 'info' | 'success' | 'warning' | 'error'
  leida: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadNotifications = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .or(`usuario_id.eq.${user.id},usuario_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setNotifications(data || [])
      setUnreadCount(data?.filter((n) => !n.leida).length || 0)
    } catch (error) {
      console.error('Error cargando notificaciones:', error)
    }
  }, [supabase])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      const wasUnread = notifications.some((n) => n.id === notificationId && !n.leida)

      try {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, leida: true } : n))
        )

        if (wasUnread) {
          setUnreadCount((prev) => Math.max(0, prev - 1))
        }

        const { error } = await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('id', notificationId)

        if (error) throw error
      } catch (error) {
        console.error('Error marcando notificacion como leida:', error)
      }
    },
    [notifications, supabase]
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })))
      setUnreadCount(0)

      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .or(`usuario_id.eq.${user.id},usuario_id.is.null`)
        .eq('leida', false)

      if (error) throw error
    } catch (error) {
      console.error('Error marcando todas como leidas:', error)
    }
  }, [supabase])

  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel('notificaciones')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev])
          setUnreadCount((prev) => prev + 1)

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newNotification.titulo, {
              body: newNotification.mensaje,
              icon: '/images/logo-avicola.svg',
            })
          }
        }
      )
      .subscribe()

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      channel.unsubscribe()
    }
  }, [loadNotifications, supabase])

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
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-blue-600'
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[500px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificaciones</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Marcar todas como leidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No hay notificaciones</div>
        ) : (
          notifications.map((notification) => {
            const target = resolveNotificationLink(notification)
            const isUnread = !notification.leida

            const content = (
              <div className="flex items-start gap-2 w-full">
                <span className="text-lg">{getNotificationIcon(notification.tipo)}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${getNotificationColor(notification.tipo)}`}>
                    {notification.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{notification.mensaje}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                    {target && <span className="text-xs font-medium text-primary">{target.label}</span>}
                  </div>
                </div>
                {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
              </div>
            )

            if (target) {
              return (
                <DropdownMenuItem
                  key={notification.id}
                  asChild
                  className={`flex flex-col items-start p-3 cursor-pointer ${isUnread ? 'bg-blue-50' : ''}`}
                >
                  <Link
                    href={target.href}
                    onClick={() => {
                      if (isUnread) {
                        void markAsRead(notification.id)
                      }
                    }}
                  >
                    {content}
                  </Link>
                </DropdownMenuItem>
              )
            }

            return (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start p-3 cursor-pointer ${isUnread ? 'bg-blue-50' : ''}`}
                onClick={() => {
                  if (isUnread) {
                    void markAsRead(notification.id)
                  }
                }}
              >
                {content}
              </DropdownMenuItem>
            )
          })
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/notificaciones" className="text-center text-sm text-primary cursor-pointer w-full">
                Ver todas las notificaciones
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
