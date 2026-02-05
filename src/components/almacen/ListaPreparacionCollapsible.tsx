'use client'

import { useState } from 'react'
import { Package, ChevronDown, MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { ProductoPreparacionCard } from './ProductoPreparacionCard'
import { PrintPreparacionParcial } from './PrintPreparacionParcial'

interface ProductoData {
  nombre: string
  pesable: boolean
  totalCantidad: number
  presupuestos: number
  presupuestosIds: Set<string>
  presupuestosData: Array<{ id: string; numero: string; cliente?: string }>
}

interface CategoriaData {
  nombre: string
  productos: ProductoData[]
}

interface ListaPreparacionData {
  key: string
  zona: string
  turno: string
  totalKgPesables: number
  categorias: CategoriaData[]
}

interface ListaPreparacionCollapsibleProps {
  listaPreparacion: ListaPreparacionData[]
  fecha: string
}

export function ListaPreparacionCollapsible({ listaPreparacion, fecha }: ListaPreparacionCollapsibleProps) {
  const [open, setOpen] = useState(true)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left hover:bg-muted/50 p-2 rounded -m-2 transition-colors">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Lista de preparación del día
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      !open && 'transform -rotate-90'
                    )}
                  />
                </CardTitle>
                <CardDescription className="mt-1">
                  Consolidado de productos por zona, turno y categoría
                </CardDescription>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 mt-2">
            <PrintPreparacionParcial listaPreparacion={listaPreparacion} fecha={fecha} />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {listaPreparacion.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay presupuestos que coincidan con los filtros actuales.
              </div>
            )}

            {listaPreparacion.map((grupo) => (
              <div key={grupo.key} className="rounded-lg border border-dashed border-primary/20 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {grupo.turno === 'Sin turno' ? 'Turno sin asignar' : `Turno ${grupo.turno}`}
                    </p>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {grupo.zona}
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {grupo.totalKgPesables.toFixed(1)} kg pesables
                  </Badge>
                </div>

                <div className="mt-4 space-y-6">
                  {grupo.categorias.map((categoria) => (
                    <div key={categoria.nombre} className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
                        {categoria.nombre}
                      </h4>
                      <div className="space-y-2">
                        {categoria.productos.map((producto) => (
                          <ProductoPreparacionCard
                            key={`${grupo.key}-${categoria.nombre}-${producto.nombre}`}
                            nombre={producto.nombre}
                            pesable={producto.pesable}
                            totalCantidad={producto.totalCantidad}
                            presupuestos={producto.presupuestos}
                            presupuestosIds={producto.presupuestosIds}
                            presupuestosData={producto.presupuestosData}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
