// Script para cargar los precios más usados de los presupuestos en la lista Mayorista
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function cargarPreciosMayorista() {
  console.log('=== CARGANDO PRECIOS EN LISTA MAYORISTA ===\n')

  try {
    const listaMayoristaId = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

    // Obtener todos los items de presupuestos
    const { data: items, error } = await supabase
      .from('presupuesto_items')
      .select('producto_id, precio_unit_est')

    if (error) {
      console.error('❌ Error obteniendo items:', error)
      return
    }

    console.log(`📊 Total items analizados: ${items.length}`)

    // Calcular el precio más usado para cada producto
    const preciosPorProducto = {}

    for (const item of items) {
      const prodId = item.producto_id
      const precio = item.precio_unit_est

      if (!preciosPorProducto[prodId]) {
        preciosPorProducto[prodId] = {}
      }

      preciosPorProducto[prodId][precio] = (preciosPorProducto[prodId][precio] || 0) + 1
    }

    // Encontrar el precio más usado para cada producto
    const preciosACargar = []
    for (const prodId in preciosPorProducto) {
      const precios = preciosPorProducto[prodId]
      let precioMasUsado = null
      let maxCount = 0

      for (const precio in precios) {
        if (precios[precio] > maxCount) {
          maxCount = precios[precio]
          precioMasUsado = parseFloat(precio)
        }
      }

      if (precioMasUsado !== null) {
        preciosACargar.push({
          producto_id: prodId,
          precio: precioMasUsado,
          cantidad: maxCount
        })
      }
    }

    console.log(`📦 Productos distintos encontrados: ${preciosACargar.length}`)

    // Obtener nombres de productos para mostrar
    const prodIds = preciosACargar.map(p => p.producto_id)
    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre, codigo')
      .in('id', prodIds)

    const productosMap = {}
    for (const p of productos || []) {
      productosMap[p.id] = p
    }

    // Mostrar resumen antes de cargar
    console.log('\n📋 RESUMEN DE PRECIOS A CARGAR:')
    console.log('='.repeat(100))

    for (const item of preciosACargar.slice(0, 20)) {
      const prod = productosMap[item.producto_id]
      console.log(`$${item.precio.toString().padStart(10)} - ${(prod?.nombre || item.producto_id).substring(0, 60)}`)
    }

    if (preciosACargar.length > 20) {
      console.log(`... y ${preciosACargar.length - 20} productos más`)
    }

    console.log('='.repeat(100))

    // Eliminar precios existentes para esta lista
    console.log('\n🗑️  Eliminando precios anteriores de la lista Mayorista...')
    const { error: deleteError } = await supabase
      .from('precios_productos')
      .delete()
      .eq('lista_precio_id', listaMayoristaId)

    if (deleteError) {
      console.error('❌ Error eliminando precios anteriores:', deleteError)
    } else {
      console.log('✅ Precios anteriores eliminados')
    }

    // Insertar los nuevos precios
    console.log('\n💾 Insertando nuevos precios...')

    let insertados = 0
    let errores = 0

    for (const item of preciosACargar) {
      const { error: insertError } = await supabase
        .from('precios_productos')
        .insert({
          lista_precio_id: listaMayoristaId,
          producto_id: item.producto_id,
          precio: item.precio,
          activo: true
        })

      if (insertError) {
        console.error(`❌ Error insertando ${item.producto_id}:`, insertError.message)
        errores++
      } else {
        insertados++
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('✅ PROCESO FINALIZADO')
    console.log(`   Precios insertados: ${insertados}`)
    console.log(`   Errores: ${errores}`)
    console.log('='.repeat(100))

    // Verificar cuántos precios quedaron
    const { count } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', listaMayoristaId)
      .eq('activo', true)

    console.log(`\n📊 Total precios activos en Lista Mayorista: ${count}`)

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

cargarPreciosMayorista().then(() => {
  console.log('\n=== FIN DEL PROCESO ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
