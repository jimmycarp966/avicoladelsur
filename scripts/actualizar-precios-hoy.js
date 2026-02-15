// Script para actualizar precios desde el presupuesto creado hoy
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function actualizarPreciosDesdePresupuestoHoy() {
  console.log('=== BUSCANDO PRESUPUESTO DE HOY ===\n')

  try {
    // Hoy en formato ISO
    const hoy = new Date().toISOString().split('T')[0]
    console.log(`📅 Fecha de hoy: ${hoy}\n`)

    // Buscar presupuestos de hoy (usando zona horaria Argentina)
    const { data: presupuestos, error } = await supabase
      .from('presupuestos')
      .select('*')
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error buscando presupuestos:', error)
      return
    }

    if (!presupuestos || presupuestos.length === 0) {
      console.log('⚠️  No se encontraron presupuestos de hoy')
      return
    }

    console.log(`📋 Se encontraron ${presupuestos.length} presupuesto(s) de hoy:\n`)

    for (const p of presupuestos) {
      const fecha = new Date(p.created_at).toLocaleString('es-AR')
      console.log(`   #${p.numero_presupuesto} - ${fecha} - ${p.estado} - ${p.items?.length || 0} items`)
    }

    // Usar el presupuesto más reciente
    const presupuesto = presupuestos[0]
    console.log(`\n✅ Usando el presupuesto más reciente: #${presupuesto.numero_presupuesto}`)

    // Obtener los items del presupuesto
    const { data: items, error: itemsError } = await supabase
      .from('presupuesto_items')
      .select(`
        id,
        producto_id,
        cantidad_solicitada,
        precio_unit_est,
        producto:productos(nombre, codigo, precio_venta)
      `)
      .eq('presupuesto_id', presupuesto.id)

    if (itemsError) {
      console.error('❌ Error obteniendo items:', itemsError)
      return
    }

    if (!items || items.length === 0) {
      console.log('⚠️  El presupuesto no tiene items')
      return
    }

    console.log(`\n📦 Items del presupuesto (${items.length}):\n`)
    console.log('='.repeat(100))
    console.log('Producto'.padEnd(50) + ' | ' + 'Precio Unit.')
    console.log('='.repeat(100))

    for (const item of items) {
      const nombre = (item.producto?.nombre || item.producto_id).substring(0, 50)
      console.log(`${nombre.padEnd(50)} | $${item.precio_unit_est}`)
    }

    console.log('='.repeat(100))
    console.log(`\n⏳  Actualizando ${items.length} precios en Lista Mayorista...`)

    const listaMayoristaId = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

    let actualizados = 0
    let insertados = 0
    let errores = 0

    for (const item of items) {
      // Verificar si ya existe un precio para este producto en la lista
      const { data: existente } = await supabase
        .from('precios_productos')
        .select('id')
        .eq('lista_precio_id', listaMayoristaId)
        .eq('producto_id', item.producto_id)
        .single()

      if (existente) {
        // Actualizar precio existente
        const { error: updateError } = await supabase
          .from('precios_productos')
          .update({
            precio: item.precio_unit_est,
            updated_at: new Date().toISOString()
          })
          .eq('id', existente.id)

        if (updateError) {
          console.error(`❌ Error actualizando ${item.producto?.nombre}:`, updateError.message)
          errores++
        } else {
          actualizados++
        }
      } else {
        // Insertar nuevo precio
        const { error: insertError } = await supabase
          .from('precios_productos')
          .insert({
            lista_precio_id: listaMayoristaId,
            producto_id: item.producto_id,
            precio: item.precio_unit_est,
            activo: true
          })

        if (insertError) {
          console.error(`❌ Error insertando ${item.producto?.nombre}:`, insertError.message)
          errores++
        } else {
          insertados++
        }
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('✅ PROCESO FINALIZADO')
    console.log(`   Precios actualizados: ${actualizados}`)
    console.log(`   Precios insertados: ${insertados}`)
    console.log(`   Errores: ${errores}`)
    console.log(`   Total procesados: ${actualizados + insertados}`)
    console.log('='.repeat(100))

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

actualizarPreciosDesdePresupuestoHoy().then(() => {
  console.log('\n=== FIN DEL PROCESO ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
