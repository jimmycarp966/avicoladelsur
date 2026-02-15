// Script para verificar todos los presupuestos creados vs PDFs
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Totales esperados según PDFs
const totalesEsperados = {
  'PR-000000028': 1029500, // GABINA
  'PR-000000029': 729300,  // MARIA LAURA (sin FILET MERLUZA)
  'PR-000000030': 661300,  // SANDRA (sin FILET MERLUZA)
  'PR-000000031': 344100,  // MIRTA
  'PR-000000032': 344100,  // MONICA
  'PR-000000033': 344100,  // CLAUDIA
  'PR-000000034': 344100,  // ALEJANDRA
  'PR-000000035': 344100,  // LORENA
  'PR-000000036': 344100,  // GRACIELA
  'PR-000000037': 344100,  // PATRICIA
  'PR-000000038': 344100,  // SUSANA
  'PR-000000039': 344100,  // GABINA (segundo)
}

async function verificarTodos() {
  console.log('=== VERIFICANDO TODOS LOS PRESUPUESTOS VS PDFs ===\n')

  const presupuestos = Object.keys(totalesEsperados)

  for (const num of presupuestos) {
    const { data: presupuesto } = await supabase
      .from('presupuestos')
      .select('id, total_estimado, cliente_id')
      .eq('numero_presupuesto', num)
      .single()

    const { data: cliente } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', presupuesto.cliente_id)
      .single()

    const esperado = totalesEsperados[num]
    const actual = presupuesto.total_estimado
    const diff = esperado - actual

    const estado = Math.abs(diff) < 100 ? '✅' : '❌'

    console.log(`${estado} ${num} - ${cliente?.nombre}`)
    console.log(`   Esperado: $${esperado.toLocaleString('es-AR')}`)
    console.log(`   Actual:   $${actual.toLocaleString('es-AR')}`)
    console.log(`   Diferencia: $${diff.toLocaleString('es-AR')}\n`)
  }
}

verificarTodos().then(() => process.exit(0))
