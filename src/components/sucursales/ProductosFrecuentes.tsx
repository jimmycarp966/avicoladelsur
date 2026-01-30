'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

interface Producto {
    id: string
    nombre: string
    codigo?: string
    precio_base?: number
    stock_disponible?: number
}

interface ProductosFrecuentesProps {
    productos: Producto[]
    onAgregar: (producto: Producto) => void
    maxItems?: number
}

export function ProductosFrecuentes({
    productos,
    onAgregar,
    maxItems = 8
}: ProductosFrecuentesProps) {
    // Tomar solo los primeros N productos (asumiendo que vienen ordenados por frecuencia)
    const productosMostrar = productos.slice(0, maxItems)

    if (productosMostrar.length === 0) {
        return null
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Productos Frecuentes
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {productosMostrar.map((producto) => (
                        <Button
                            key={producto.id}
                            variant="outline"
                            className="h-auto py-3 px-2 flex flex-col items-center justify-center text-center hover:bg-primary/5 hover:border-primary/50 transition-colors"
                            onClick={() => onAgregar(producto)}
                        >
                            <span className="text-xs font-medium truncate w-full">
                                {producto.nombre}
                            </span>
                            {producto.precio_base && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                    ${producto.precio_base.toFixed(0)}
                                </Badge>
                            )}
                        </Button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                    Toca para agregar rápidamente
                </p>
            </CardContent>
        </Card>
    )
}
