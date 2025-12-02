import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()

        console.log('🚀 Asignando 1000 unidades a TODOS los productos existentes...')

        // Paso 1: Obtener TODOS los productos existentes (sin crear nada nuevo)
        const { data: productos, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, codigo')

        if (productosError) {
            return NextResponse.json({
                success: false,
                error: 'Error obteniendo productos: ' + productosError.message
            }, { status: 500 })
        }

        if (!productos || productos.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No hay productos en el sistema'
            }, { status: 400 })
        }

        console.log(`📦 Encontrados ${productos.length} productos existentes`)

        // Paso 2: Usar primera sucursal disponible (sin crear nuevas)
        const { data: sucursales } = await supabase
            .from('sucursales')
            .select('id, nombre')
            .limit(1)

        let sucursalId = sucursales?.[0]?.id || null

        console.log(`🏭 Usando sucursal existente: ${sucursales?.[0]?.nombre || 'Sin sucursal'}`)
        console.log(`🏭 Sucursal ID: ${sucursales?.[0]?.id || 'NULL'}`)

        // Paso 3: Crear lotes para cada producto existente
        let procesados = 0
        let errores = 0

        console.log('🔄 Asignando 1000 unidades a cada producto...')

        for (const producto of productos) {
            try {
                // Crear lote con las columnas que REALMENTE existen en la tabla
                const loteData: any = {
                    producto_id: producto.id,
                    cantidad_ingresada: 1000,
                    cantidad_disponible: 1000,
                    costo_unitario: 1.0, // Esta columna SÍ existe
                    estado: 'disponible',
                    fecha_ingreso: new Date().toISOString().split('T')[0], // Formato DATE
                    fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Formato DATE
                    numero_lote: `STOCK-${producto.id.substring(0, 6)}-${Date.now()}`,
                    ubicacion_almacen: 'Almacén Principal' // Esta columna SÍ existe
                }

                // Solo incluir sucursal_id si existe una sucursal válida
                if (sucursalId) {
                    loteData.sucursal_id = sucursalId
                }

                const { error: createError } = await supabase
                    .from('lotes')
                    .insert(loteData)

                if (!createError) {
                    procesados++
                    if (procesados % 100 === 0) {
                        console.log(`✅ Procesados ${procesados} productos...`)
                    }
                } else {
                    // Si hay error (duplicado), intentar actualizar
                    let updateQuery = supabase
                        .from('lotes')
                        .update({
                            cantidad_ingresada: 1000,
                            cantidad_disponible: 1000,
                            costo_unitario: 1.0
                        })
                        .eq('producto_id', producto.id)

                    // Solo filtrar por sucursal_id si existe
                    if (sucursalId) {
                        updateQuery = updateQuery.eq('sucursal_id', sucursalId)
                    }

                    const { error: updateError } = await updateQuery

                    if (!updateError) {
                        procesados++
                    } else {
                        errores++
                        console.log(`❌ Error con ${producto.nombre}: ${createError.message}`)
                    }
                }
            } catch (error) {
                errores++
                console.log(`❌ Error procesando ${producto.nombre}`)
            }
        }

        console.log(`🎉 ¡FINALIZADO! ${procesados} productos tienen 1000 unidades`)

        return NextResponse.json({
            success: true,
            message: `¡PERFECTO! ${procesados} productos existentes tienen ahora 1000 unidades cada uno`,
            data: {
                productos_total: productos.length,
                productos_con_stock: procesados,
                productos_errores: errores,
                unidades_totales: procesados * 1000,
                sucursal_usada: sucursales?.[0]?.nombre || 'Default',
                productos_ejemplo: productos.slice(0, 5).map(p => `${p.nombre} (${p.codigo})`)
            }
        })

    } catch (error: any) {
        console.error('❌ Error general:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
