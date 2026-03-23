'use client'

import { useState } from 'react'
import { Package, ChevronDown, MapPin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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

interface ZonaPreparacionGroup {
  zona: string
  totalKgPesables: number
  grupos: ListaPreparacionData[]
}

export function ListaPreparacionCollapsible({ listaPreparacion, fecha }: ListaPreparacionCollapsibleProps) {
  const [open, setOpen] = useState(true)

  const zonasAgrupadas = Object.values(
    listaPreparacion.reduce<Record<string, ZonaPreparacionGroup>>((acc, grupo) => {
      const key = grupo.zona || 'Sin zona'

      if (!acc[key]) {
        acc[key] = {
          zona: key,
          totalKgPesables: 0,
          grupos: [],
        }
      }

      acc[key].totalKgPesables += grupo.totalKgPesables
      acc[key].grupos.push(grupo)
      return acc
    }, {}),
  ).sort((a, b) => b.totalKgPesables - a.totalKgPesables)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between rounded p-2 -m-2 text-left transition-colors hover:bg-muted/50">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Lista de preparación del día
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      !open && 'transform -rotate-90',
                    )}
                  />
                </CardTitle>
                <CardDescription className="mt-1">
                  Consolidado de productos por zona, turno y categoría
                </CardDescription>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="mt-2 flex items-center gap-2">
            <PrintPreparacionParcial listaPreparacion={listaPreparacion} fecha={fecha} />
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {listaPreparacion.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No hay presupuestos que coincidan con los filtros actuales.
              </div>
            )}

            {zonasAgrupadas.map((zona) => (
              <Collapsible key={zona.zona} defaultOpen>
                <div className="rounded-lg border border-dashed border-primary/20 p-4">
                  <CollapsibleTrigger asChild>
                    <button className="group flex w-full items-center justify-between gap-3 text-left transition-colors hover:text-foreground">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold">{zona.zona}</h3>
                          <p className="text-sm text-muted-foreground">
                            {zona.grupos.length} {zona.grupos.length === 1 ? 'turno' : 'turnos'} en preparación
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-sm">
                          {zona.totalKgPesables.toFixed(1)} kg pesables
                        </Badge>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="pt-4">
                    <div className="space-y-4">
                      {zona.grupos.map((grupo) => (
                        <div key={grupo.key} className="rounded-md border border-border/60 bg-muted/20 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {grupo.turno === 'Sin turno' ? 'Turno sin asignar' : `Turno ${grupo.turno}`}
                              </p>
                              <h4 className="flex items-center gap-2 text-base font-semibold">
                                <span className="h-2 w-2 rounded-full bg-primary/60" />
                                Preparación por categoría
                              </h4>
                            </div>
                            <Badge variant="secondary" className="text-sm">
                              {grupo.totalKgPesables.toFixed(1)} kg pesables
                            </Badge>
                          </div>

                          <div className="mt-4 space-y-6">
                            {grupo.categorias.map((categoria) => (
                              <div key={categoria.nombre} className="space-y-3">
                                <h5 className="border-b pb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                  {categoria.nombre}
                                </h5>
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
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
