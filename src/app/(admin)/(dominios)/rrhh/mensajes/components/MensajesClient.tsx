'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Inbox,
    Send,
    Mail,
    MailOpen,
    Trash2,
    Archive,
    Plus,
    Search,
    User,
    Clock,
    CheckCircle,
    Loader2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    enviarMensajeAction,
    marcarComoLeidoAction,
    eliminarMensajeAction,
    type MensajeInterno
} from '@/actions/mensajes.actions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Usuario {
    id: string
    nombre: string
    apellido: string
    email: string
    rol: string
}

interface MensajesClientProps {
    bandeja: MensajeInterno[]
    enviados: MensajeInterno[]
    noLeidos: number
    usuarios: Usuario[]
}

export function MensajesClient({ bandeja, enviados, noLeidos, usuarios }: MensajesClientProps) {
    const [isPending, startTransition] = useTransition()
    const [nuevoMensajeOpen, setNuevoMensajeOpen] = useState(false)
    const [mensajeSeleccionado, setMensajeSeleccionado] = useState<MensajeInterno | null>(null)
    const [busqueda, setBusqueda] = useState('')
    const [tabActiva, setTabActiva] = useState('bandeja')

    // Filtrar mensajes por búsqueda
    const bandejaFiltrada = bandeja.filter(m =>
        m.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.remitente?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.contenido.toLowerCase().includes(busqueda.toLowerCase())
    )

    const enviadosFiltrados = enviados.filter(m =>
        m.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.destinatario?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.contenido.toLowerCase().includes(busqueda.toLowerCase())
    )

    const handleEnviarMensaje = async (formData: FormData) => {
        startTransition(async () => {
            const result = await enviarMensajeAction(formData)
            if (result.success) {
                toast.success('Mensaje enviado correctamente')
                setNuevoMensajeOpen(false)
            } else {
                toast.error(result.error || 'Error al enviar mensaje')
            }
        })
    }

    const handleAbrirMensaje = async (mensaje: MensajeInterno) => {
        setMensajeSeleccionado(mensaje)
        if (!mensaje.leido && tabActiva === 'bandeja') {
            startTransition(async () => {
                await marcarComoLeidoAction(mensaje.id)
            })
        }
    }

    const handleEliminar = async (mensajeId: string, esRemitente: boolean) => {
        startTransition(async () => {
            const result = await eliminarMensajeAction(mensajeId, esRemitente)
            if (result.success) {
                toast.success('Mensaje eliminado')
                setMensajeSeleccionado(null)
            } else {
                toast.error(result.error || 'Error al eliminar')
            }
        })
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel izquierdo - Lista de mensajes */}
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Mensajes
                            </CardTitle>
                            <Dialog open={nuevoMensajeOpen} onOpenChange={setNuevoMensajeOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-1" />
                                        Nuevo
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Nuevo Mensaje</DialogTitle>
                                        <DialogDescription>
                                            Envía un mensaje a otro empleado del sistema
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form action={handleEnviarMensaje} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="destinatario_id">Destinatario</Label>
                                            <Select name="destinatario_id" required>
                                                <SelectTrigger id="destinatario_id">
                                                    <SelectValue placeholder="Selecciona un destinatario" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {usuarios.map((u) => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.nombre} {u.apellido} ({u.rol})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="asunto">Asunto</Label>
                                            <Input
                                                id="asunto"
                                                name="asunto"
                                                placeholder="Escribe el asunto..."
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="contenido">Mensaje</Label>
                                            <Textarea
                                                id="contenido"
                                                name="contenido"
                                                placeholder="Escribe tu mensaje aquí..."
                                                rows={5}
                                                required
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setNuevoMensajeOpen(false)}>
                                                Cancelar
                                            </Button>
                                            <Button type="submit" disabled={isPending}>
                                                {isPending ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="h-4 w-4 mr-1" />
                                                        Enviar
                                                    </>
                                                )}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="relative mt-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar mensajes..."
                                className="pl-9"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Tabs value={tabActiva} onValueChange={setTabActiva}>
                            <TabsList className="w-full justify-start rounded-none border-b px-3">
                                <TabsTrigger value="bandeja" className="gap-1.5">
                                    <Inbox className="h-4 w-4" />
                                    Bandeja
                                    {noLeidos > 0 && (
                                        <Badge variant="destructive" size="sm" className="ml-1">
                                            {noLeidos}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="enviados" className="gap-1.5">
                                    <Send className="h-4 w-4" />
                                    Enviados
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="bandeja" className="m-0">
                                <div className="max-h-[500px] overflow-y-auto divide-y">
                                    {bandejaFiltrada.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                            <p>No hay mensajes en tu bandeja</p>
                                        </div>
                                    ) : (
                                        bandejaFiltrada.map((mensaje) => (
                                            <MensajeItem
                                                key={mensaje.id}
                                                mensaje={mensaje}
                                                tipo="recibido"
                                                seleccionado={mensajeSeleccionado?.id === mensaje.id}
                                                onClick={() => handleAbrirMensaje(mensaje)}
                                            />
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="enviados" className="m-0">
                                <div className="max-h-[500px] overflow-y-auto divide-y">
                                    {enviadosFiltrados.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <Send className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                            <p>No hay mensajes enviados</p>
                                        </div>
                                    ) : (
                                        enviadosFiltrados.map((mensaje) => (
                                            <MensajeItem
                                                key={mensaje.id}
                                                mensaje={mensaje}
                                                tipo="enviado"
                                                seleccionado={mensajeSeleccionado?.id === mensaje.id}
                                                onClick={() => setMensajeSeleccionado(mensaje)}
                                            />
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Panel derecho - Vista del mensaje */}
            <div className="lg:col-span-2">
                <Card className="h-full min-h-[400px]">
                    {mensajeSeleccionado ? (
                        <>
                            <CardHeader className="border-b">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl">{mensajeSeleccionado.asunto}</CardTitle>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <User className="h-4 w-4" />
                                                {tabActiva === 'bandeja' ? (
                                                    <span>De: {mensajeSeleccionado.remitente?.nombre} {mensajeSeleccionado.remitente?.apellido}</span>
                                                ) : (
                                                    <span>Para: {mensajeSeleccionado.destinatario?.nombre} {mensajeSeleccionado.destinatario?.apellido}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                <span>
                                                    {formatDistanceToNow(new Date(mensajeSeleccionado.created_at), {
                                                        addSuffix: true,
                                                        locale: es
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {mensajeSeleccionado.leido && tabActiva === 'enviados' && (
                                            <Badge variant="success" size="sm">
                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                Leído
                                            </Badge>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleEliminar(
                                                mensajeSeleccionado.id,
                                                tabActiva === 'enviados'
                                            )}
                                            disabled={isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                                    {mensajeSeleccionado.contenido}
                                </div>
                            </CardContent>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                            <MailOpen className="h-16 w-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">Selecciona un mensaje</p>
                            <p className="text-sm">Haz clic en un mensaje para ver su contenido</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    )
}

// Componente para cada item de mensaje
function MensajeItem({
    mensaje,
    tipo,
    seleccionado,
    onClick
}: {
    mensaje: MensajeInterno
    tipo: 'recibido' | 'enviado'
    seleccionado: boolean
    onClick: () => void
}) {
    const esNoLeido = tipo === 'recibido' && !mensaje.leido
    const persona = tipo === 'recibido' ? mensaje.remitente : mensaje.destinatario

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left p-4 hover:bg-muted/50 transition-colors",
                seleccionado && "bg-primary/5 border-l-4 border-primary",
                esNoLeido && "bg-primary/5 font-medium"
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn(
                    "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
                    esNoLeido ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                    {persona?.nombre?.charAt(0)}{persona?.apellido?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                            "truncate",
                            esNoLeido && "font-semibold"
                        )}>
                            {persona?.nombre} {persona?.apellido}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(mensaje.created_at), {
                                addSuffix: false,
                                locale: es
                            })}
                        </span>
                    </div>
                    <p className={cn(
                        "text-sm truncate",
                        esNoLeido ? "text-foreground" : "text-muted-foreground"
                    )}>
                        {mensaje.asunto}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {mensaje.contenido.substring(0, 60)}...
                    </p>
                </div>
                {esNoLeido && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
            </div>
        </button>
    )
}
