'use client'

import { useEffect, useState } from 'react'
import { Bell, Settings, Save, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'

type ConfiguracionNotificacion = {
    categoria: string
    nombre: string
    descripcion: string
    habilitada: boolean
    push_habilitado: boolean
}

const CATEGORIAS_NOTIFICACION: ConfiguracionNotificacion[] = [
    {
        categoria: 'pedidos',
        nombre: 'Pedidos',
        descripcion: 'Nuevos pedidos, cambios de estado, cancelaciones',
        habilitada: true,
        push_habilitado: true,
    },
    {
        categoria: 'whatsapp',
        nombre: 'WhatsApp',
        descripcion: 'Mensajes entrantes de clientes por WhatsApp',
        habilitada: true,
        push_habilitado: true,
    },
    {
        categoria: 'stock',
        nombre: 'Stock',
        descripcion: 'Alertas de stock bajo, predicciones de demanda',
        habilitada: true,
        push_habilitado: false,
    },
    {
        categoria: 'clientes',
        nombre: 'Clientes',
        descripcion: 'Clientes en riesgo, nuevos clientes, actualizaciones',
        habilitada: true,
        push_habilitado: false,
    },
    {
        categoria: 'tesoreria',
        nombre: 'Tesorería',
        descripcion: 'Cobros, pagos, alertas de caja, fraudes detectados',
        habilitada: true,
        push_habilitado: true,
    },
    {
        categoria: 'reparto',
        nombre: 'Reparto',
        descripcion: 'Rutas iniciadas, entregas completadas, incidencias',
        habilitada: true,
        push_habilitado: true,
    },
    {
        categoria: 'produccion',
        nombre: 'Producción',
        descripcion: 'Órdenes de producción, lotes creados, mermas',
        habilitada: true,
        push_habilitado: false,
    },
    {
        categoria: 'rrhh',
        nombre: 'Recursos Humanos',
        descripcion: 'Solicitudes de licencia, adelantos, evaluaciones',
        habilitada: true,
        push_habilitado: false,
    },
    {
        categoria: 'ia',
        nombre: 'Inteligencia Artificial',
        descripcion: 'Sugerencias de IA, predicciones, detección de anomalías',
        habilitada: true,
        push_habilitado: false,
    },
    {
        categoria: 'sistema',
        nombre: 'Sistema',
        descripcion: 'Actualizaciones del sistema, mantenimiento',
        habilitada: true,
        push_habilitado: false,
    },
]

export default function ConfiguracionNotificacionesPage() {
    const [configuraciones, setConfiguraciones] = useState<ConfiguracionNotificacion[]>(CATEGORIAS_NOTIFICACION)
    const [saving, setSaving] = useState(false)
    const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
    const supabase = createClient()

    useEffect(() => {
        loadConfiguracion()
        if ('Notification' in window) {
            setPushPermission(Notification.permission)
        }
    }, [])

    async function loadConfiguracion() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('configuracion_notificaciones')
                .select('*')
                .eq('usuario_id', user.id)

            if (error && error.code !== 'PGRST116') throw error

            if (data && data.length > 0) {
                // Merge con configuración por defecto
                const merged = CATEGORIAS_NOTIFICACION.map((cat) => {
                    const saved = data.find((d: any) => d.categoria === cat.categoria)
                    return saved
                        ? {
                            ...cat,
                            habilitada: saved.habilitada,
                            push_habilitado: saved.push_habilitado,
                        }
                        : cat
                })
                setConfiguraciones(merged)
            }
        } catch (error) {
            console.error('Error cargando configuración:', error)
        }
    }

    async function saveConfiguracion() {
        try {
            setSaving(true)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Upsert cada configuración
            for (const config of configuraciones) {
                const { error } = await supabase
                    .from('configuracion_notificaciones')
                    .upsert(
                        {
                            usuario_id: user.id,
                            categoria: config.categoria,
                            habilitada: config.habilitada,
                            push_habilitado: config.push_habilitado,
                        },
                        { onConflict: 'usuario_id,categoria' }
                    )

                if (error) throw error
            }

            toast.success('Configuración guardada correctamente')
        } catch (error) {
            console.error('Error guardando configuración:', error)
            toast.error('Error al guardar configuración')
        } finally {
            setSaving(false)
        }
    }

    async function requestPushPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission()
            setPushPermission(permission)
            if (permission === 'granted') {
                toast.success('Notificaciones push habilitadas')
            }
        }
    }

    function toggleCategoria(categoria: string, field: 'habilitada' | 'push_habilitado') {
        setConfiguraciones((prev) =>
            prev.map((c) =>
                c.categoria === categoria ? { ...c, [field]: !c[field] } : c
            )
        )
    }

    return (
        <div className="container mx-auto py-6 px-4 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/notificaciones">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex items-center gap-3">
                    <Settings className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Configuración de Notificaciones</h1>
                        <p className="text-muted-foreground text-sm">
                            Elige qué notificaciones recibir y cómo
                        </p>
                    </div>
                </div>
            </div>

            {/* Push Notifications Card */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-lg">Notificaciones del Navegador</CardTitle>
                    <CardDescription>
                        Recibe notificaciones incluso cuando la aplicación no está abierta
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {pushPermission === 'granted' ? (
                        <div className="flex items-center gap-2 text-green-600">
                            <Bell className="h-5 w-5" />
                            <span>Notificaciones push habilitadas</span>
                        </div>
                    ) : pushPermission === 'denied' ? (
                        <div className="flex items-center gap-2 text-red-600">
                            <Bell className="h-5 w-5" />
                            <span>Notificaciones bloqueadas. Habilitalas desde la configuración del navegador.</span>
                        </div>
                    ) : (
                        <Button onClick={requestPushPermission}>
                            <Bell className="h-4 w-4 mr-2" />
                            Habilitar notificaciones push
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Categorías */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Categorías de Notificaciones</CardTitle>
                    <CardDescription>
                        Activa o desactiva las notificaciones por categoría
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {configuraciones.map((config) => (
                        <div
                            key={config.categoria}
                            className="flex items-start justify-between py-4 border-b last:border-b-0"
                        >
                            <div className="flex-1">
                                <Label className="text-base font-medium">{config.nombre}</Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {config.descripcion}
                                </p>
                            </div>
                            <div className="flex items-center gap-6 ml-4">
                                <div className="flex flex-col items-center gap-1">
                                    <Switch
                                        checked={config.habilitada}
                                        onCheckedChange={() =>
                                            toggleCategoria(config.categoria, 'habilitada')
                                        }
                                    />
                                    <span className="text-xs text-muted-foreground">En app</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <Switch
                                        checked={config.push_habilitado && pushPermission === 'granted'}
                                        disabled={pushPermission !== 'granted' || !config.habilitada}
                                        onCheckedChange={() =>
                                            toggleCategoria(config.categoria, 'push_habilitado')
                                        }
                                    />
                                    <span className="text-xs text-muted-foreground">Push</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end mt-6">
                <Button onClick={saveConfiguracion} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
            </div>
        </div>
    )
}
