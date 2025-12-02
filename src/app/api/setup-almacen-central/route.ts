import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        // Usar cliente admin para bypass RLS
        const supabase = createAdminClient()

        console.log('🔄 Configurando stock de 1000 unidades para TODOS los productos existentes...')

        // ID fijo del Almacén Central (Sistema Central)
        const ALMACEN_CENTRAL_ID = '00000000-0000-0000-0000-000000000001'

        // Verificar si el almacén central existe
        let almacenPrincipal
        const { data: almacenExistente, error: almacenError } = await supabase
            .from('sucursales')
            .select('id, nombre')
            .eq('id', ALMACEN_CENTRAL_ID)
            .single()

        if (almacenError || !almacenExistente) {
            console.log('⚠️ No se encontró el almacén central, creándolo...')
            
            // Crear el almacén central con el ID específico
            const { data: nuevoAlmacen, error: createError } = await supabase
                .from('sucursales')
                .insert({
                    id: ALMACEN_CENTRAL_ID,
                    nombre: 'Casa Central',
                    direccion: 'Av. Mate de Luna 1234, San Miguel de Tucumán',
                    telefono: '381-555-0000',
                    active: true
                })
                .select()
                .single()

            if (createError || !nuevoAlmacen) {
                console.error('❌ Error creando almacén central:', createError)
                return NextResponse.json({
                    success: false,
                    error: 'No se pudo crear el almacén central: ' + createError?.message
                }, { status: 500 })
            }

            almacenPrincipal = nuevoAlmacen
            console.log('✅ Almacén central creado:', almacenPrincipal.nombre)
        } else {
            almacenPrincipal = almacenExistente
            console.log('🏭 Usando almacén central existente:', almacenPrincipal.nombre)
        }

        console.log('🏭 Almacén Central ID:', almacenPrincipal.id)

        // Obtener todos los productos existentes
        const { data: productos, error: productosError } = await supabase
            .from('productos')
            .select('id, nombre, codigo, is_central_catalog')

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

        console.log(`📦 Encontrados ${productos.length} productos`)

        // Marcar todos los productos como catálogo central
        const productosActualizados = []
        for (const producto of productos) {
            if (!producto.is_central_catalog) {
                const { error: updateError } = await supabase
                    .from('productos')
                    .update({ is_central_catalog: true })
                    .eq('id', producto.id)

                if (!updateError) {
                    productosActualizados.push(producto.nombre)
                }
            }
        }

        // Crear lotes de desarrollo (1000 unidades cada uno)
        const lotesCreados = []
        const cantidadDesarrollo = 1000

        for (const producto of productos) {
            // Verificar si ya existe lote activo
            const { data: loteExistente } = await supabase
                .from('lotes')
                .select('id, cantidad_disponible')
                .eq('producto_id', producto.id)
                .eq('sucursal_id', almacenPrincipal.id)
                .eq('estado', 'disponible')
                .single()

            if (loteExistente) {
                // Si existe pero tiene menos de 1000, actualizar
                if (loteExistente.cantidad_disponible < cantidadDesarrollo) {
                    const diferencia = cantidadDesarrollo - loteExistente.cantidad_disponible
                    const { error: updateError } = await supabase
                        .from('lotes')
                        .update({
                            cantidad_ingresada: loteExistente.cantidad_disponible + diferencia,
                            cantidad_disponible: cantidadDesarrollo
                        })
                        .eq('id', loteExistente.id)

                    if (!updateError) {
                        lotesCreados.push({
                            producto: producto.nombre,
                            accion: 'actualizado',
                            cantidad_anterior: loteExistente.cantidad_disponible,
                            cantidad_nueva: cantidadDesarrollo
                        })
                    }
                } else {
                    console.log(`Producto ${producto.nombre} ya tiene suficiente stock (${loteExistente.cantidad_disponible})`)
                }
            } else {
                // Crear nuevo lote con el esquema correcto de la BD
                const { data: nuevoLote, error: loteError } = await supabase
                    .from('lotes')
                    .insert({
                        producto_id: producto.id,
                        sucursal_id: almacenPrincipal.id,
                        cantidad_ingresada: cantidadDesarrollo,
                        cantidad_disponible: cantidadDesarrollo,
                        costo_unitario: 8.5,
                        estado: 'disponible',
                        fecha_ingreso: new Date().toISOString().split('T')[0],
                        fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        numero_lote: `DEV-CENTRAL-${producto.id.substring(0, 8)}-${Date.now()}`
                    })
                    .select()
                    .single()

                if (!loteError && nuevoLote) {
                    lotesCreados.push({
                        producto: producto.nombre,
                        accion: 'creado',
                        cantidad: cantidadDesarrollo
                    })
                } else {
                    console.error(`Error creando lote para ${producto.nombre}:`, loteError)
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Almacén central configurado para desarrollo`,
            data: {
                almacen_principal: almacenPrincipal.nombre,
                productos_marcados_catalogo: productosActualizados.length,
                lotes_procesados: lotesCreados.length,
                productos_con_stock: productos.length,
                detalle_lotes: lotesCreados.slice(0, 10), // Primeros 10 para no sobrecargar
                instrucciones: [
                    'Ahora puedes crear transferencias desde almacén central',
                    'Todos los productos tienen 1000 unidades disponibles',
                    'Los productos están marcados como catálogo central'
                ]
            }
        })

    } catch (error: any) {
        console.error('Error en setup-almacen-central:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
