// Script para debug y recargar precios minoristas
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugYRecargar() {
  console.log('=== DEBUG Y RECARGA LISTA MINORISTA ===\n')

  try {
    const listaMinoristaId = 'f1c62e66-7b4c-4c82-b1a5-a7d125e05acd'

    // Verificar que la lista existe
    const { data: lista } = await supabase
      .from('listas_precios')
      .select('*')
      .eq('id', listaMinoristaId)
      .single()

    console.log('📋 Lista Minorista:', lista)

    // Ver si hay precios
    const { data: preciosExistentes, error: errorPrecios } = await supabase
      .from('precios_productos')
      .select('*')
      .eq('lista_precio_id', listaMinoristaId)

    console.log('\n📦 Precios existentes:', preciosExistentes?.length || 0)
    if (errorPrecios) {
      console.log('Error:', errorPrecios)
    }

    // Obtener datos del presupuesto de hoy
    const hoy = new Date().toISOString().split('T')[0]

    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('*')
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)
      .order('created_at', { ascending: false })

    const presupuesto = presupuestos[0]
    console.log(`\n✅ Presupuesto: #${presupuesto.numero_presupuesto}`)

    const { data: items } = await supabase
      .from('presupuesto_items')
      .select(`
        producto_id,
        precio_unit_est,
        producto:productos(nombre)
      `)
      .eq('presupuesto_id', presupuesto.id)

    // Agrupar por producto y encontrar precios mayor/menor
    const preciosPorProducto = {}
    for (const item of items) {
      if (!preciosPorProducto[item.producto_id]) {
        preciosPorProducto[item.producto_id] = {
          nombre: item.producto?.nombre,
          precios: []
        }
      }
      preciosPorProducto[item.producto_id].precios.push(item.precio_unit_est)
    }

    console.log('\n📋 Productos y precios a cargar en MINORISTA:\n')

    // Eliminar todos los precios de la lista minorista primero
    console.log('🗑️  Eliminando precios anteriores...')
    await supabase
      .from('precios_productos')
      .delete()
      .eq('lista_precio_id', listaMinoristaId)

    // Insertar precios minoristas (el mayor para productos con dos precios)
    let insertados = 0
    const productosUnicos = new Set()

    for (const prodId in preciosPorProducto) {
      if (productosUnicos.has(prodId)) continue

      const info = preciosPorProducto[prodId]
      const preciosUnicos = [...new Set(info.precios)]

      // Para minorista usar el precio MAYOR
      const precioMinorista = Math.max(...preciosUnicos)

      const { error } = await supabase
        .from('precios_productos')
        .insert({
          lista_precio_id: listaMinoristaId,
          producto_id: prodId,
          precio: precioMinorista,
          activo: true
        })

      if (error) {
        console.error(`❌ Error insertando ${info.nombre}:`, error.message)
      } else {
        insertados++
        productosUnicos.add(prodId)

        // Mostrar diferencia si hay dos precios
        if (preciosUnicos.length === 2) {
          const precioMenor = Math.min(...preciosUnicos)
          console.log(`📦 ${info.nombre.substring(0, 40)}`)
          console.log(`   Mayorista: $${precioMenor} → Minorista: $${precioMinorista}`)
        }
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log(`✅ Insertados: ${insertados} precios en Lista Minorista`)

    // Verificar
    const { count } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', listaMinoristaId)
      .eq('activo', true)

    console.log(`📊 Total en Lista Minorista: ${count}`)

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

debugYRecargar().then(() => {
  console.log('\n=== FIN ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
