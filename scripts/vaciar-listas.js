// Script para vaciar todas las listas de precios
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function vaciarListas() {
  console.log('=== VACIANDO TODAS LAS LISTAS DE PRECIOS ===\n')

  try {
    // IDs de las listas
    const listas = [
      { id: 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351', nombre: 'Lista Mayorista' },
      { id: 'f1c62e66-7b4c-4c82-b1a5-a7d125e05acd', nombre: 'Lista Minorista' },
      { id: 'ad5e23b6-d4f1-4f49-b127-e6529ccc0b3a', nombre: 'Lista Distribuidor' }
    ]

    for (const lista of listas) {
      console.log(`🗑️  Vaciando ${lista.nombre}...`)

      const { error } = await supabase
        .from('precios_productos')
        .delete()
        .eq('lista_precio_id', lista.id)

      if (error) {
        console.error(`   ❌ Error: ${error.message}`)
      } else {
        console.log(`   ✅ Vaciada`)
      }
    }

    console.log('\n' + '='.repeat(80))

    // Verificar resultado
    const { count: countMayorista } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351')

    const { count: countMinorista } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', 'f1c62e66-7b4c-4c82-b1a5-a7d125e05acd')

    const { count: countDistribuidor } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', 'ad5e23b6-d4f1-4f49-b127-e6529ccc0b3a')

    console.log('\n📊 RESULTADO FINAL:')
    console.log(`   Lista Mayorista:   ${countMayorista || 0} items`)
    console.log(`   Lista Minorista:   ${countMinorista || 0} items`)
    console.log(`   Lista Distribuidor: ${countDistribuidor || 0} items`)

    console.log('\n✅ Todas las listas están vacías')
    console.log('   Los productos usarán su precio_venta como fallback')

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

vaciarListas().then(() => {
  console.log('\n=== FIN DEL PROCESO ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
