import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()

        // Obtener sucursales activas
        const { data: sucursales, error: sucursalesError } = await supabase
            .from('sucursales')
            .select('id, nombre')
            .eq('active', true)

        if (sucursalesError) throw sucursalesError

        // Obtener productos disponibles
        const { data: productosExistentes, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, codigo, is_central_catalog')
            .limit(10)

        if (productosError) throw productosError

        let productos = productosExistentes || []

        // Si no hay productos, crear algunos básicos
        if (!productos || productos.length === 0) {
            console.log('Creando productos básicos...')

            const productosBasicos = [
                { nombre: 'Pollo Entero', codigo: 'POLLO001', unidad_medida: 'kg', precio_venta: 15.00 },
                { nombre: 'Pechuga de Pollo', codigo: 'PECHUGA001', unidad_medida: 'kg', precio_venta: 18.00 },
                { nombre: 'Muslo de Pollo', codigo: 'MUSLO001', unidad_medida: 'kg', precio_venta: 12.00 },
                { nombre: 'Alas de Pollo', codigo: 'ALAS001', unidad_medida: 'kg', precio_venta: 14.00 },
                { nombre: 'Hígado de Pollo', codigo: 'HIGADO001', unidad_medida: 'kg', precio_venta: 8.00 },
                { nombre: 'Huevos Grandes', codigo: 'HUEVO001', unidad_medida: 'docena', precio_venta: 25.00 },
                { nombre: 'Huevos Medianos', codigo: 'HUEVO002', unidad_medida: 'docena', precio_venta: 22.00 },
            ]

            for (const prod of productosBasicos) {
                const { data: nuevoProducto, error: createError } = await supabase
                    .from('productos')
                    .insert({
                        nombre: prod.nombre,
                        codigo: prod.codigo,
                        unidad_medida: prod.unidad_medida,
                        precio_venta: prod.precio_venta,
                        precio_costo: prod.precio_venta * 0.7,
                        is_central_catalog: true,
                        activo: true
                    })
                    .select()
                    .single()

                if (!createError && nuevoProducto) {
                    productos.push(nuevoProducto)
                }
            }

            console.log(`Creados ${productos.length} productos básicos`)
        }

        // Asegurar que los productos estén en el catálogo central
        for (const producto of productos) {
            if (!producto.is_central_catalog) {
                await supabase
                    .from('productos')
                    .update({ is_central_catalog: true })
                    .eq('id', producto.id)
            }
        }

        // Tomar solo los primeros 5 para crear lotes
        productos = productos.slice(0, 5)

        const resultados = []

        // Crear lotes de prueba para el almacén central primero
        const almacenCentral = sucursales.find(s => s.id === '00000000-0000-0000-0000-000000000001')
        if (almacenCentral) {
            console.log('Creando productos en almacén central...')
            const lotesCentral = []

            // Crear stock para TODOS los productos (1000 unidades cada uno - modo desarrollo)
            for (const producto of productos) {
                // Verificar si ya existe un lote para este producto en almacén central
                const { data: loteExistente } = await supabase
                    .from('lotes')
                    .select('id')
                    .eq('producto_id', producto.id)
                    .eq('sucursal_id', almacenCentral.id)
                    .eq('estado', 'disponible')
                    .single()

                if (loteExistente) {
                    console.log(`Producto ${producto.nombre} ya tiene lote en almacén central`)
                    continue
                }

                const cantidad = 1000 // 1000 unidades para desarrollo

                const { data: lote, error: loteError } = await supabase
                    .from('lotes')
                    .insert({
                        producto_id: producto.id,
                        sucursal_id: almacenCentral.id,
                        cantidad_ingresada: cantidad,
                        cantidad_disponible: cantidad,
                        precio_costo_unitario: 8.5,
                        precio_venta_sugerido: 12.0,
                        estado: 'disponible',
                        fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 año
                        numero_lote: `DEV-CENTRAL-${producto.id.substring(0, 8)}-${Date.now()}`,
                        observaciones: 'Lote de desarrollo - 1000 unidades en almacén central'
                    })
                    .select()
                    .single()

                if (loteError) {
                    console.error('Error creando lote en central:', loteError)
                } else {
                    lotesCentral.push({
                        producto: producto.nombre,
                        cantidad: cantidad
                    })
                }
            }

            resultados.push({
                sucursal: almacenCentral.nombre + ' (ALMACÉN CENTRAL)',
                lotesCreados: lotesCentral.length,
                productos: lotesCentral,
                mensaje: `Creados ${lotesCentral.length} lotes con 1000 unidades cada uno para desarrollo`
            })
        }

        // Crear lotes de prueba para las sucursales operativas
        const sucursalesOperativas = sucursales.filter(s => s.id !== '00000000-0000-0000-0000-000000000001')

        for (const sucursal of sucursalesOperativas) {
            const lotesCreados = []

            for (const producto of productos.slice(0, 2)) { // Solo 2 productos por sucursal operativa
                const cantidad = Math.floor(Math.random() * 20) + 5 // 5-25 unidades (menos que central)

                const { data: lote, error: loteError } = await supabase
                    .from('lotes')
                    .insert({
                        producto_id: producto.id,
                        sucursal_id: sucursal.id,
                        cantidad_ingresada: cantidad,
                        cantidad_disponible: cantidad,
                        precio_costo_unitario: 10.5,
                        precio_venta_sugerido: 15.0,
                        estado: 'disponible',
                        fecha_vencimiento: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 días
                        numero_lote: `SUC-${sucursal.id.substring(0, 8)}-${producto.id.substring(0, 8)}`,
                        observaciones: 'Lote de sucursal creado automáticamente'
                    })
                    .select()
                    .single()

                if (loteError) {
                    console.error('Error creando lote:', loteError)
                } else {
                    lotesCreados.push({
                        producto: producto.nombre,
                        cantidad: cantidad
                    })
                }
            }

            resultados.push({
                sucursal: sucursal.nombre,
                lotesCreados: lotesCreados.length,
                productos: lotesCreados
            })
        }

        return NextResponse.json({
            success: true,
            message: 'Datos de prueba creados exitosamente',
            data: resultados
        })

    } catch (error: any) {
        console.error('Error en setup-test-stock:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
