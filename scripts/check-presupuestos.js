// Script para verificar los últimos presupuestos y sus precios
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno de Supabase no configuradas')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPresupuestos() {
  console.log('=== VERIFICANDO ÚLTIMOS PRESUPUESTOS ===\n')

  try {
    // Obtener los últimos 10 presupuestos
    const { data: presupuestos, error } = await supabase
      .from('presupuestos')
      .select(`
        id,
        numero_presupuesto,
        created_at,
        cliente_id,
        estado,
        total_estimado,
        total_final,
        lista_precio_id,
        items:presupuesto_items(
          id,
          producto_id,
          cantidad_solicitada,
          precio_unit_est,
          precio_unit_final,
          subtotal_est,
          subtotal_final,
          producto:productos(nombre, codigo, precio_venta)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ Error consultando presupuestos:', error)
      return
    }

    if (!presupuestos || presupuestos.length === 0) {
      console.log('⚠️  No hay presupuestos en la base de datos')
      return
    }

    console.log(`✓ Se encontraron ${presupuestos.length} presupuestos\n`)
    console.log('='.repeat(100))

    for (const p of presupuestos) {
      console.log(`\n📋 Presupuesto #${p.numero_presupuesto} (${p.id})`)
      console.log(`   Fecha: ${new Date(p.created_at).toLocaleString('es-AR')}`)
      console.log(`   Estado: ${p.estado}`)
      console.log(`   Lista de precios: ${p.lista_precio_id || 'No asignada'}`)
      console.log(`   Total estimado: $${p.total_estimado?.toFixed(2) || 'N/A'}`)
      console.log(`   Total final: $${p.total_final?.toFixed(2) || 'N/A'}`)
      console.log(`   Items (${p.items?.length || 0}):`)

      if (p.items && p.items.length > 0) {
        for (const item of p.items) {
          const precioVentaProducto = item.producto?.precio_venta || 'N/A'
          const diff = item.precio_unit_est !== precioVentaProducto

          console.log(`      • ${item.producto?.nombre || item.producto_id}`)
          console.log(`        Cantidad: ${item.cantidad_solicitada}`)
          console.log(`        Precio unit. estimado: $${item.precio_unit_est}`)
          console.log(`        Precio unit. final: $${item.precio_unit_final || 'N/A'}`)
          console.log(`        Precio producto (BD): $${precioVentaProducto}`)
          console.log(`        Subtotal estimado: $${item.subtotal_est}`)
          console.log(`        Subtotal final: $${item.subtotal_final || 'N/A'}`)

          if (diff && typeof precioVentaProducto === 'number') {
            const diferencia = item.precio_unit_est - precioVentaProducto
            console.log(`        ⚠️  Diferencia: $${diferencia.toFixed(2)}`)
          }
        }
      } else {
        console.log('      ⚠️  Sin items')
      }

      console.log('-'.repeat(100))
    }

    // Análisis de precios
    console.log('\n\n=== ANÁLISIS DE PRECIOS ===\n')

    let itemsConPrecioDiferente = 0
    let itemsSinPrecio = 0
    let totalItems = 0

    for (const p of presupuestos) {
      for (const item of p.items || []) {
        totalItems++
        if (!item.precio_unit_est || item.precio_unit_est <= 0) {
          itemsSinPrecio++
        }
        if (item.producto?.precio_venta && item.precio_unit_est !== item.producto.precio_venta) {
          itemsConPrecioDiferente++
        }
      }
    }

    console.log(`Total de items analizados: ${totalItems}`)
    console.log(`Items con precio diferente al producto: ${itemsConPrecioDiferente}`)
    console.log(`Items sin precio (o precio <= 0): ${itemsSinPrecio}`)

    if (itemsSinPrecio > 0) {
      console.log('\n⚠️  HAY ITEMS SIN PRECIO - REVISAR PRESUPUESTOS AFECTADOS')
    }

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

checkPresupuestos().then(() => {
  console.log('\n=== FIN DEL ANÁLISIS ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
