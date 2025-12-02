import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        // Verificar almacén central
        const { data: almacenCentral, error: almacenError } = await supabase
            .from('sucursales')
            .select('*')
            .eq('id', '00000000-0000-0000-0000-000000000001')
            .single()

        if (almacenError) {
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo almacén central: ' + almacenError.message
            }, { status: 500 })
        }

        // Verificar productos en catálogo central
        const { data: productosCatalogo, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, codigo, is_central_catalog')
            .eq('is_central_catalog', true)

        if (productosError) {
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo productos catálogo: ' + productosError.message
            }, { status: 500 })
        }

        // Verificar lotes en almacén central
        const { data: lotesCentral, error: lotesError } = await supabase
            .from('lotes')
            .select(`
                id,
                producto_id,
                cantidad_disponible,
                estado,
                productos(id, nombre, codigo)
            `)
            .eq('sucursal_id', '00000000-0000-0000-0000-000000000001')
            .eq('estado', 'disponible')

        if (lotesError) {
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo lotes central: ' + lotesError.message
            }, { status: 500 })
        }

        // Calcular productos con stock
        const productosConStock = (productosCatalogo || []).map(producto => {
            const lotesProducto = (lotesCentral || []).filter(lote => lote.producto_id === producto.id)
            const stockTotal = lotesProducto.reduce((sum, lote) => sum + (lote.cantidad_disponible || 0), 0)

            return {
                id: producto.id,
                nombre: producto.nombre,
                codigo: producto.codigo,
                stock_total: stockTotal,
                lotes_count: lotesProducto.length
            }
        }).filter(p => p.stock_total > 0)

        return NextResponse.json({
            success: true,
            data: {
                almacen_central: almacenCentral,
                productos_catalogo: productosCatalogo?.length || 0,
                lotes_central: lotesCentral?.length || 0,
                productos_con_stock: productosConStock.length,
                productos_detalle: productosConStock.slice(0, 10), // Primeros 10
                diagnostico: {
                    almacen_central_existe: !!almacenCentral,
                    hay_productos_catalogo: (productosCatalogo?.length || 0) > 0,
                    hay_lotes_central: (lotesCentral?.length || 0) > 0,
                    hay_productos_con_stock: productosConStock.length > 0
                }
            }
        })

    } catch (error: any) {
        console.error('Error en debug-transferencias:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
