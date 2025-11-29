'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, TrendingUp, Clock, Circle } from 'lucide-react'
import { getRouteColor, getColorName } from '@/lib/colors'

interface RutaInfo {
    id: string
    numero: string
    repartidor: string
    color: string
    progreso: { completadas: number; total: number }
    estado: 'en_curso' | 'completada' | 'retrasada'
}

interface RutasSidebarProps {
    rutas: RutaInfo[]
    onRutaClick: (rutaId: string) => void
    selectedRutaId?: string
}

export default function RutasSidebar({ rutas, onRutaClick, selectedRutaId }: RutasSidebarProps) {
    const [filtro, setFiltro] = useState<'todas' | 'en_curso' | 'completadas'>('todas')

    const rutasFiltradas = rutas.filter(ruta => {
        if (filtro === 'todas') return true
        if (filtro === 'en_curso') return ruta.estado === 'en_curso'
        if (filtro === 'completadas') return ruta.estado === 'completada'
        return true
    })

    const calcularProgresoPorcentaje = (completadas: number, total: number) => {
        if (total === 0) return 0
        return Math.round((completadas / total) * 100)
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Rutas Activas
                </CardTitle>
                <div className="flex gap-2 mt-3">
                    <Button
                        variant={filtro === 'todas' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltro('todas')}
                        className="text-xs"
                    >
                        Todas ({rutas.length})
                    </Button>
                    <Button
                        variant={filtro === 'en_curso' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltro('en_curso')}
                        className="text-xs"
                    >
                        En Curso
                    </Button>
                    <Button
                        variant={filtro === 'completadas' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFiltro('completadas')}
                        className="text-xs"
                    >
                        Completadas
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-2">
                {rutasFiltradas.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        {filtro === 'todas' ? 'No hay rutas activas' : `No hay rutas ${filtro}`}
                    </div>
                ) : (
                    rutasFiltradas.map((ruta) => {
                        const porcentaje = calcularProgresoPorcentaje(ruta.progreso.completadas, ruta.progreso.total)
                        const isSelected = selectedRutaId === ruta.id

                        return (
                            <div
                                key={ruta.id}
                                className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${isSelected ? 'ring-2 ring-primary shadow-md' : ''
                                    }`}
                                onClick={() => onRutaClick(ruta.id)}
                                style={{
                                    borderLeftWidth: '4px',
                                    borderLeftColor: ruta.color,
                                }}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: ruta.color }}
                                        />
                                        <span className="font-semibold text-sm">{ruta.numero}</span>
                                    </div>
                                    <Badge
                                        variant={
                                            ruta.estado === 'completada'
                                                ? 'default'
                                                : ruta.estado === 'retrasada'
                                                    ? 'destructive'
                                                    : 'secondary'
                                        }
                                        className="text-xs"
                                    >
                                        {ruta.estado === 'en_curso' ? 'En Curso' : ruta.estado === 'completada' ? 'Completada' : 'Retrasada'}
                                    </Badge>
                                </div>

                                {/* Repartidor */}
                                <p className="text-xs text-muted-foreground mb-3">{ruta.repartidor}</p>

                                {/* Progreso */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Progreso</span>
                                        <span className="font-medium">
                                            {ruta.progreso.completadas} / {ruta.progreso.total} ({porcentaje}%)
                                        </span>
                                    </div>
                                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${porcentaje}%`,
                                                backgroundColor: ruta.color,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Color tag */}
                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Circle className="h-3 w-3" style={{ fill: ruta.color, color: ruta.color }} />
                                    <span>{getColorName(ruta.color)}</span>
                                </div>
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
