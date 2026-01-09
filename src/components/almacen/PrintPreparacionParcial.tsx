'use client'

import { useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ProductoPreparacion {
    nombre: string
    codigo?: string
    totalCantidad: number
    pesable: boolean
    presupuestos: number
}

interface GrupoPreparacion {
    key: string
    zona: string
    turno: string
    productos: ProductoPreparacion[]
    totalKgPesables: number
}

interface PrintPreparacionParcialProps {
    listaPreparacion: GrupoPreparacion[]
    fecha: string
}

export function PrintPreparacionParcial({ listaPreparacion, fecha }: PrintPreparacionParcialProps) {
    const [isLoading, setIsLoading] = useState(false)

    // Filtrar solo productos pesables (que requieren etiqueta)
    const productosPesables = listaPreparacion.flatMap(grupo =>
        grupo.productos
            .filter(p => p.pesable)
            .map(p => ({
                ...p,
                zona: grupo.zona,
                turno: grupo.turno
            }))
    )

    const handlePrint = async () => {
        if (productosPesables.length === 0) {
            toast.error('No hay productos pesables para imprimir')
            return
        }

        setIsLoading(true)
        try {
            // Generar HTML para impresión
            const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lista de Preparación Parcial - ${fecha}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .cantidad { font-weight: bold; text-align: right; }
            .zona-header { background-color: #e0e7ff; font-size: 14px; }
            .pesable { color: #ea580c; font-size: 10px; }
            @media print {
              body { margin: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>📦 Lista de Preparación Parcial</h1>
          <h2>Fecha: ${fecha} - Productos pendientes de pesaje</h2>
          
          ${listaPreparacion.filter(grupo => grupo.productos.some(p => p.pesable)).map(grupo => `
            <table>
              <thead>
                <tr class="zona-header">
                  <th colspan="3">${grupo.zona} - Turno ${grupo.turno}</th>
                </tr>
                <tr>
                  <th>Producto</th>
                  <th>Presupuestos</th>
                  <th class="cantidad">Cantidad Estimada</th>
                </tr>
              </thead>
              <tbody>
                ${grupo.productos.filter(p => p.pesable).map(producto => `
                  <tr>
                    <td>
                      ${producto.nombre}
                      <span class="pesable">⚖️ BALANZA</span>
                    </td>
                    <td>${producto.presupuestos}</td>
                    <td class="cantidad">${producto.totalCantidad.toFixed(1)} kg</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `).join('')}
          
          <p style="font-size: 10px; color: #666; margin-top: 20px;">
            * Esta lista muestra solo productos que requieren pesaje. 
            Impreso: ${new Date().toLocaleString('es-AR')}
          </p>
        </body>
        </html>
      `

            // Abrir ventana de impresión
            const printWindow = window.open('', '_blank')
            if (printWindow) {
                printWindow.document.write(printContent)
                printWindow.document.close()
                printWindow.print()
                toast.success('Lista de preparación parcial lista para imprimir')
            } else {
                toast.error('No se pudo abrir la ventana de impresión')
            }
        } catch (error) {
            console.error('Error al imprimir:', error)
            toast.error('Error al generar la impresión')
        } finally {
            setIsLoading(false)
        }
    }

    if (productosPesables.length === 0) {
        return null
    }

    return (
        <Button
            onClick={handlePrint}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Printer className="h-4 w-4" />
            )}
            Imprimir Parcial ({productosPesables.length})
        </Button>
    )
}
