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

  // Contar total de productos
  const totalProductos = listaPreparacion.reduce((acc, grupo) => acc + grupo.productos.length, 0)

  const handlePrint = async () => {
    if (totalProductos === 0) {
      toast.error('No hay productos para imprimir')
      return
    }

    setIsLoading(true)
    try {
      // Construir HTML por partes para mejor rendimiento (evita tildado)
      const htmlParts: string[] = []

      // Header HTML
      htmlParts.push(`<!DOCTYPE html>
<html>
<head>
  <title>Lista de Preparación - ${fecha}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 15px; font-size: 12px; }
    h1 { font-size: 16px; margin: 0 0 5px 0; }
    h2 { font-size: 12px; color: #666; margin: 0 0 15px 0; }
    .zona-section { page-break-after: always; margin-bottom: 20px; }
    .zona-section:last-child { page-break-after: auto; }
    .zona-header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 10px 15px; border-radius: 6px 6px 0 0; font-weight: bold; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; font-size: 11px; }
    .cantidad { font-weight: bold; text-align: right; }
    .pesable-row { background-color: #fef3c7 !important; }
    .pesable-badge { background-color: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 5px; }
    .unidad-badge { background-color: #6b7280; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 5px; }
    .footer { font-size: 9px; color: #666; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 5px; }
    @media print {
      body { margin: 0; padding: 10px; }
      .zona-section { page-break-after: always; }
      .zona-section:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>`)

      // Una sección por cada zona
      listaPreparacion.forEach((grupo, index) => {
        const isLast = index === listaPreparacion.length - 1
        const productosPesables = grupo.productos.filter(p => p.pesable)
        const productosNoPesables = grupo.productos.filter(p => !p.pesable)

        htmlParts.push(`
  <div class="zona-section${isLast ? ' last' : ''}">
    <h1>📦 Lista de Preparación - ${fecha}</h1>
    <h2>${grupo.zona} ${grupo.turno !== 'Sin turno' ? `• Turno ${grupo.turno}` : ''}</h2>
    
    <div class="zona-header">
      ${grupo.zona} ${grupo.turno !== 'Sin turno' ? `- Turno ${grupo.turno}` : ''} 
      (${grupo.productos.length} productos, ${grupo.totalKgPesables.toFixed(1)} kg pesables)
    </div>
    
    <table>
      <thead>
        <tr>
          <th style="width: 50%">Producto</th>
          <th style="width: 20%">Tipo</th>
          <th style="width: 15%">Presupuestos</th>
          <th style="width: 15%" class="cantidad">Cantidad</th>
        </tr>
      </thead>
      <tbody>`)

        // Primero productos pesables (resaltados)
        productosPesables.forEach(producto => {
          htmlParts.push(`
        <tr class="pesable-row">
          <td>
            ${producto.nombre}
            <span class="pesable-badge">⚖️ BALANZA</span>
          </td>
          <td>Pesable</td>
          <td>${producto.presupuestos}</td>
          <td class="cantidad">${producto.totalCantidad.toFixed(1)} kg</td>
        </tr>`)
        })

        // Luego productos no pesables
        productosNoPesables.forEach(producto => {
          htmlParts.push(`
        <tr>
          <td>
            ${producto.nombre}
            <span class="unidad-badge">📦 UNIDAD</span>
          </td>
          <td>Unidad/Caja</td>
          <td>${producto.presupuestos}</td>
          <td class="cantidad">${producto.totalCantidad.toFixed(0)} u</td>
        </tr>`)
        })

        htmlParts.push(`
      </tbody>
    </table>
    
    <div class="footer">
      Resumen: ${productosPesables.length} pesables (${grupo.totalKgPesables.toFixed(1)} kg) + ${productosNoPesables.length} unidades/cajas
      • Impreso: ${new Date().toLocaleString('es-AR')}
    </div>
  </div>`)
      })

      // Footer HTML
      htmlParts.push(`
</body>
</html>`)

      // Unir y abrir ventana de impresión
      const printContent = htmlParts.join('')
      const printWindow = window.open('', '_blank')

      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()

        // Pequeño delay para asegurar que el contenido se renderice
        setTimeout(() => {
          printWindow.print()
        }, 100)

        toast.success('Lista de preparación lista para imprimir')
      } else {
        toast.error('No se pudo abrir la ventana de impresión. ¿Bloqueador de popups activo?')
      }
    } catch (error) {
      console.error('Error al imprimir:', error)
      toast.error('Error al generar la impresión')
    } finally {
      setIsLoading(false)
    }
  }

  if (totalProductos === 0) {
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
      Imprimir ({listaPreparacion.length} zonas)
    </Button>
  )
}
