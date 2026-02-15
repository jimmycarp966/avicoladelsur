// Script para analizar precios distintos en presupuestos
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function analizarPreciosDistintos() {
  console.log('=== ANALIZANDO PRECIOS DISTINTOS EN PRESUPUESTOS ===\n')

  try {
    // Obtener todos los items de presupuestos
    const { data: items, error } = await supabase
      .from('presupuesto_items')
      .select(`
        producto_id,
        precio_unit_est,
        presupuestos!inner(
          id,
          numero_presupuesto,
          created_at,
          lista_precio_id
        )
      `)
      .order('presupuestos(created_at)', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo items:', error)
      return
    }

    // Agrupar precios por producto
    const preciosPorProducto = {}

    for (const item of items || []) {
      const prodId = item.producto_id
      if (!preciosPorProducto[prodId]) {
        preciosPorProducto[prodId] = {
          producto_id: prodId,
          precios: [],
          presupuestos: []
        }
      }
      preciosPorProducto[prodId].precios.push(item.precio_unit_est)
      preciosPorProducto[prodId].presupuestos.push({
        presupuesto: item.presupuestos.numero_presupuesto,
        precio: item.precio_unit_est,
        fecha: item.presupuestos.created_at
      })
    }

    // Buscar productos con más de un precio distinto
    const productosConPreciosDistintos = []

    for (const prodId in preciosPorProducto) {
      const preciosUnicos = [...new Set(preciosPorProducto[prodId].precios)]
      if (preciosUnicos.length > 1) {
        productosConPreciosDistintos.push({
          producto_id: prodId,
          precios_unicos: preciosUnicos,
          cantidad: preciosPorProducto[prodId].presupuestos.length,
          presupuestos: preciosPorProducto[prodId].presupuestos
        })
      }
    }

    console.log(`📊 Total productos analizados: ${Object.keys(preciosPorProducto).length}`)
    console.log(`⚠️  Productos con precios distintos: ${productosConPreciosDistintos.length}\n`)

    if (productosConPreciosDistintos.length > 0) {
      console.log('='.repeat(100))
      console.log('PRODUCTOS CON PRECIOS DISTINTOS:')
      console.log('='.repeat(100))

      // Obtener nombres de productos
      const prodIds = productosConPreciosDistintos.map(p => p.producto_id)
      const { data: productos } = await supabase
        .from('productos')
        .select('id, nombre, codigo')
        .in('id', prodIds)

      const productosMap = {}
      for (const p of productos || []) {
        productosMap[p.id] = p
      }

      for (const item of productosConPreciosDistintos) {
        const prod = productosMap[item.producto_id]
        console.log(`\n📦 ${prod?.nombre || item.producto_id} (${prod?.codigo || 'N/A'})`)
        console.log(`   ID: ${item.producto_id}`)
        console.log(`   Precios distintos: ${item.precios_unicos.length}`)
        console.log(`   Aparece en ${item.cantidad} presupuestos`)

        // Ordenar presupuestos por fecha
        const ordenados = [...item.presupuestos].sort((a, b) =>
          new Date(b.fecha) - new Date(a.fecha)
        )

        // Contar cuántas veces aparece cada precio
        const conteoPrecios = {}
        for (const p of item.presupuestos) {
          conteoPrecios[p.precio] = (conteoPrecios[p.precio] || 0) + 1
        }

        console.log(`   Precios encontrados:`)
        for (const precio of item.precios_unicos) {
          const count = conteoPrecios[precio] || 0
          console.log(`      $${precio} (aparece ${count} vez/veces)`)
        }

        console.log(`   Últimos presupuestos:`)
        for (const p of ordenados.slice(0, 5)) {
          const fecha = new Date(p.fecha).toLocaleDateString('es-AR')
          console.log(`      #${p.presupuesto} - ${fecha} - $${p.precio}`)
        }
      }

      console.log('\n' + '='.repeat(100))
    } else {
      console.log('✅ Todos los productos tienen precios consistentes')
    }

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

analizarPreciosDistintos().then(() => {
  console.log('\n=== FIN DEL ANÁLISIS ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
