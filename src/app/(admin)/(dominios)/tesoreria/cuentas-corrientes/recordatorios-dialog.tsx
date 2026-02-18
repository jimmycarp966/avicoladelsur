'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare, Loader2, Phone, Calendar, CheckCircle, Clock } from 'lucide-react'
import {
    listarRecordatoriosClienteAction,
    crearRecordatorioAction,
    actualizarRecordatorioAction
} from '@/actions/tesoreria.actions'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface RecordatoriosDialogProps {
    clienteId: string
    clienteNombre: string
}

interface Recordatorio {
    id: string
    fecha: string
    nota: string
    tipo: string
    estado: string
    resultado: string | null
    fecha_proximo_contacto: string | null
    hora_proximo_contacto?: string | null
    creador?: { nombre: string; apellido: string }
}

export function RecordatoriosDialog({ clienteId, clienteNombre }: RecordatoriosDialogProps) {
    const [open, setOpen] = useState(false)
    const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const fetchRecordatorios = async () => {
        setIsLoading(true)
        try {
            const result = await listarRecordatoriosClienteAction(clienteId)
            if (result.success) {
                setRecordatorios(result.data || [])
            }
        } catch (error) {
            console.error('Error fetching recordatorios:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchRecordatorios()
        }
    }, [open, clienteId])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const formData = new FormData(e.currentTarget)
            formData.set('cliente_id', clienteId)

            const result = await crearRecordatorioAction(formData)

            if (result.success) {
                toast.success('Recordatorio creado')
                fetchRecordatorios()
                ; (e.target as HTMLFormElement).reset()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error('Error al crear recordatorio')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleMarcarCompletado = async (id: string) => {
        const result = await actualizarRecordatorioAction(id, 'completado')
        if (result.success) {
            toast.success('Recordatorio completado')
            fetchRecordatorios()
        } else {
            toast.error(result.error)
        }
    }

    const getTipoIcon = (tipo: string) => {
        switch (tipo) {
            case 'llamada': return <Phone className="h-3 w-3" />
            case 'whatsapp': return <MessageSquare className="h-3 w-3" />
            default: return <Calendar className="h-3 w-3" />
        }
    }

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'completado':
                return <Badge variant="default" className="bg-green-500">Completado</Badge>
            case 'sin_respuesta':
                return <Badge variant="secondary">Sin respuesta</Badge>
            default:
                return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pendiente</Badge>
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Recordatorios
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Gestion de Cobranza
                    </DialogTitle>
                    <DialogDescription>
                        Historial y recordatorios de pago para <strong>{clienteNombre}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-medium text-sm">Nuevo Recordatorio</h4>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="tipo" className="text-xs">Tipo</Label>
                                <Select name="tipo" defaultValue="llamada">
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="llamada">Llamada</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="visita">Visita</SelectItem>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="otro">Otro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="fecha_proximo_contacto" className="text-xs">Proximo Contacto</Label>
                                <Input
                                    id="fecha_proximo_contacto"
                                    name="fecha_proximo_contacto"
                                    type="date"
                                    className="h-8"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="hora_proximo_contacto" className="text-xs">Hora (GMT-3)</Label>
                                <Input
                                    id="hora_proximo_contacto"
                                    name="hora_proximo_contacto"
                                    type="time"
                                    className="h-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="nota" className="text-xs">Nota *</Label>
                            <Textarea
                                id="nota"
                                name="nota"
                                placeholder="Ej: Llamo a las 10:00, prometio pagar el viernes..."
                                rows={2}
                                required
                            />
                        </div>

                        <Button type="submit" size="sm" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                'Agregar Recordatorio'
                            )}
                        </Button>
                    </form>

                    <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Historial ({recordatorios.length})
                        </h4>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : recordatorios.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay recordatorios registrados
                            </div>
                        ) : (
                            <ScrollArea className="h-[250px]">
                                <div className="space-y-2 pr-4">
                                    {recordatorios.map((rec) => (
                                        <div
                                            key={rec.id}
                                            className={`p-3 rounded-lg border ${rec.estado === 'completado' ? 'bg-green-50 border-green-200' : 'bg-white'}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {getTipoIcon(rec.tipo)}
                                                        <span className="text-xs text-muted-foreground capitalize">
                                                            {rec.tipo}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">•</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDistanceToNow(new Date(rec.fecha), { addSuffix: true, locale: es })}
                                                        </span>
                                                        {getEstadoBadge(rec.estado)}
                                                    </div>
                                                    <p className="text-sm">{rec.nota}</p>
                                                    {rec.fecha_proximo_contacto && (
                                                        <p className="text-xs text-blue-600 mt-1">
                                                            Proximo contacto: {new Date(rec.fecha_proximo_contacto).toLocaleDateString('es-AR')}
                                                            {rec.hora_proximo_contacto ? ` ${rec.hora_proximo_contacto.slice(0, 5)}hs` : ''}
                                                        </p>
                                                    )}
                                                    {rec.creador && (
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Por: {rec.creador.nombre} {rec.creador.apellido}
                                                        </p>
                                                    )}
                                                </div>
                                                {rec.estado === 'pendiente' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => handleMarcarCompletado(rec.id)}
                                                        title="Marcar como completado"
                                                    >
                                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
