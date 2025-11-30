'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

type Notification = {
    id: string
    titulo: string
    mensaje: string
    tipo: 'info' | 'success' | 'warning' | 'error'
    leida: boolean
    metadata: any
    created_at: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        loadNotifications()

        // Subscribe to real-time notifications
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

                    // Show browser notification if permitted
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(newNotification.titulo, {
                            body: newNotification.mensaje,
                            icon: '/images/logo-avicola.png',
                        })
                    }
                }
            )
            .subscribe()

        // Request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }

        return () => {
            channel.unsubscribe()
        }
    }, [])

    async function loadNotifications() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('notificaciones')
                .select('*')
                .or(`usuario_id.eq.${user.id},usuario_id.is.null`) // Notificaciones del usuario o globales
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error

            setNotifications(data || [])
            setUnreadCount(data?.filter((n) => !n.leida).length || 0)
        } catch (error) {
            console.error('Error cargando notificaciones:', error)
        }
    }

    async function markAsRead(notificationId: string) {
        try {
            const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .eq('id', notificationId)

            if (error) throw error

            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, leida: true } : n))
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))
        } catch (error) {
            console.error('Error marcando notificación como leída:', error)
        }
    }

    async function markAllAsRead() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('notificaciones')
                .update({ leida: true })
                .or(`usuario_id.eq.${user.id},usuario_id.is.null`)
                .eq('leida', false)

            if (error) throw error

            setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })))
            setUnreadCount(0)
        } catch (error) {
            console.error('Error marcando todas como leídas:', error)
        }
    }

    function getNotificationIcon(tipo: string) {
        switch (tipo) {
            case 'success':
                return '✅'
            case 'warning':
                return '⚠️'
            case 'error':
                return '❌'
            default:
                return '📝'
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
                            Marcar todas como leídas
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No hay notificaciones
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <DropdownMenuItem
                            key={notification.id}
                            className={`flex flex-col items-start p-3 cursor-pointer ${!notification.leida ? 'bg-blue-50' : ''
                                }`}
                            onClick={() => {
                                if (!notification.leida) {
                                    markAsRead(notification.id)
                                }
                            }}
                        >
                            <div className="flex items-start gap-2 w-full">
                                <span className="text-lg">{getNotificationIcon(notification.tipo)}</span>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-semibold text-sm ${getNotificationColor(notification.tipo)}`}>
                                        {notification.titulo}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {notification.mensaje}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(notification.created_at), {
                                            addSuffix: true,
                                            locale: es,
                                        })}
                                    </p>
                                </div>
                                {!notification.leida && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                )}
                            </div>
                        </DropdownMenuItem>
                    ))
                )}

                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link
                                href="/notificaciones"
                                className="text-center text-sm text-primary cursor-pointer w-full"
                            >
                                Ver todas las notificaciones
                            </Link>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
