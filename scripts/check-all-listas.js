// Script para verificar todas las listas de precios y sus items
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllListas() {
  console.log('=== VERIFICANDO TODAS LAS LISTAS DE PRECIOS ===\n')

  try {
    // Obtener todas las listas de precios
    const { data: listas, error: listasError } = await supabase
      .from('listas_precios')
      .select('*')
      .order('created_at')

    if (listasError) {
      console.error('❌ Error obteniendo listas de precios:', listasError)
      return
    }

    console.log(`📋 Total listas de precios: ${listas?.length || 0}\n`)

    if (!listas || listas.length === 0) {
      console.log('⚠️  No hay listas de precios en la base de datos')
      return
    }

    for (const lista of listas) {
      console.log('='.repeat(80))
      console.log(`📋 Lista: ${lista.nombre}`)
      console.log(`   Código: ${lista.codigo}`)
      console.log(`   Tipo: ${lista.tipo}`)
      console.log(`   ID: ${lista.id}`)
      console.log(`   Activa: ${lista.activa}`)
      console.log(`   Margen ganancia: ${lista.margen_ganancia || 'No configurado'}%`)
      console.log(`   Vigencia: ${lista.fecha_vigencia_desde || 'N/A'} - ${lista.fecha_vigencia_hasta || 'N/A'}`)

      // Contar items en esta lista
      const { data: items, error: itemsError } = await supabase
        .from('precios_productos')
        .select('id')
        .eq('lista_precio_id', lista.id)
        .eq('activo', true)

      if (!itemsError) {
        console.log(`   Items activos: ${items?.length || 0}`)
      } else {
        console.log(`   Items: Error al contar`)
      }

      console.log('')
    }

    // Ver cuántos productos tienen precios configurados en alguna lista
    const { count: totalProductos } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)

    const { count: productosConPrecio } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)

    console.log('='.repeat(80))
    console.log('\n📊 RESUMEN:')
    console.log(`   Total productos activos: ${totalProductos || 0}`)
    console.log(`   Total precios configurados: ${productosConPrecio || 0}`)

    if ((productosConPrecio || 0) === 0) {
      console.log('\n⚠️  NO HAY PRECIOS CONFIGURADOS EN NINGUNA LISTA')
      console.log('   Los presupuestos usan los precios que se ingresan manualmente al crearlos.')
      console.log('   Para centralizar los precios, se deben cargar en la tabla precios_productos.')
    }

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

checkAllListas().then(() => {
  console.log('\n=== FIN DEL ANÁLISIS ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
