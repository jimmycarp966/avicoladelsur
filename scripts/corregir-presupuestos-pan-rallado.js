// Script para corregir presupuestos agregando items faltantes
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// El producto correcto para PAN RALLADO X10 KG
const PAN_RALLADO_ID = 'f74718e1-6b9c-467d-9483-151d477df4dc' // PAN RALLADO X10 KG RALLADITO LISO

// Items faltantes por presupuesto
const itemsFaltantes = [
  { presupuesto: 'PR-000000028', cantidad: 6, precio: 10500 }, // GABINA
  { presupuesto: 'PR-000000029', cantidad: 6, precio: 10500 }, // MARIA LAURA
  { presupuesto: 'PR-000000030', cantidad: 6, precio: 10500 }, // SANDRA
  { presupuesto: 'PR-000000031', cantidad: 3, precio: 10500 }, // MIRTA
  { presupuesto: 'PR-000000032', cantidad: 3, precio: 10500 }, // MONICA
  { presupuesto: 'PR-000000033', cantidad: 3, precio: 10500 }, // CLAUDIA
  { presupuesto: 'PR-000000034', cantidad: 3, precio: 10500 }, // ALEJANDRA
  { presupuesto: 'PR-000000035', cantidad: 3, precio: 10500 }, // LORENA
  { presupuesto: 'PR-000000036', cantidad: 3, precio: 10500 }, // GRACIELA
  { presupuesto: 'PR-000000037', cantidad: 3, precio: 10500 }, // PATRICIA
  { presupuesto: 'PR-000000038', cantidad: 3, precio: 10500 }, // SUSANA
  { presupuesto: 'PR-000000039', cantidad: 3, precio: 10500 }, // GABINA (segundo)
]

async function corregirPresupuestos() {
  console.log('=== CORRIGIENDO PRESUPUESTOS - AGREGANDO PAN RALLADO ===\n')

  for (const item of itemsFaltantes) {
    // Buscar presupuesto
    const { data: presupuesto } = await supabase
      .from('presupuestos')
      .select('id, total_estimado')
      .eq('numero_presupuesto', item.presupuesto)
      .single()

    if (!presupuesto) {
      console.log(`⚠️  Presupuesto ${item.presupuesto} no encontrado`)
      continue
    }

    // Verificar si ya existe el item PAN RALLADO
    const { data: existe } = await supabase
      .from('presupuesto_items')
      .select('id')
      .eq('presupuesto_id', presupuesto.id)
      .eq('producto_id', PAN_RALLADO_ID)
      .single()

    if (existe) {
      console.log(`⏭️  ${item.presupuesto} ya tiene PAN RALLADO, actualizando...`)

      // Actualizar
      const subtotal = item.cantidad * item.precio
      await supabase
        .from('presupuesto_items')
        .update({
          cantidad_solicitada: item.cantidad,
          precio_unit_est: item.precio,
          subtotal_est: subtotal
        })
        .eq('id', existe.id)
    } else {
      console.log(`➕ Agregando PAN RALLADO a ${item.presupuesto}...`)

      // Insertar item faltante
      const subtotal = item.cantidad * item.precio
      const { error: insertError } = await supabase
        .from('presupuesto_items')
        .insert({
          presupuesto_id: presupuesto.id,
          producto_id: PAN_RALLADO_ID,
          cantidad_solicitada: item.cantidad,
          cantidad_reservada: 0,
          precio_unit_est: item.precio,
          subtotal_est: subtotal
        })

      if (insertError) {
        console.error(`   ❌ Error: ${insertError.message}`)
        continue
      }
    }

    // Actualizar total del presupuesto
    const { data: items } = await supabase
      .from('presupuesto_items')
      .select('subtotal_est')
      .eq('presupuesto_id', presupuesto.id)

    const nuevoTotal = items.reduce((sum, i) => sum + (i.subtotal_est || 0), 0)

    await supabase
      .from('presupuestos')
      .update({ total_estimado: nuevoTotal })
      .eq('id', presupuesto.id)

    console.log(`   ✅ Total actualizado: $${nuevoTotal.toLocaleString('es-AR')}`)
  }

  console.log('\n=== VERIFICACIÓN FINAL ===\n')

  // Verificar presupuestos corregidos
  const { data: presupuestos } = await supabase
    .from('presupuestos')
    .select('numero_presupuesto, total_estimado')
    .in('numero_presupuesto', itemsFaltantes.map(i => i.presupuesto))
    .order('numero_presupuesto')

  for (const p of presupuestos || []) {
    console.log(`${p.numero_presupuesto}: $${p.total_estimado?.toLocaleString('es-AR')}`)
  }
}

corregirPresupuestos().then(() => process.exit(0))
