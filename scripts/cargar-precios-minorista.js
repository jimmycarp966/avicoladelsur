// Script para cargar precios minoristas desde el presupuesto de hoy
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function cargarPreciosMinorista() {
  console.log('=== CARGANDO PRECIOS EN LISTA MINORISTA ===\n')

  try {
    const hoy = new Date().toISOString().split('T')[0]

    // Obtener el presupuesto de hoy
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('*')
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)
      .order('created_at', { ascending: false })

    if (!presupuestos || presupuestos.length === 0) {
      console.log('⚠️  No se encontraron presupuestos de hoy')
      return
    }

    const presupuesto = presupuestos[0]
    console.log(`✅ Presupuesto: #${presupuesto.numero_presupuesto}\n`)

    // Obtener los items del presupuesto
    const { data: items } = await supabase
      .from('presupuesto_items')
      .select(`
        producto_id,
        precio_unit_est,
        producto:productos(nombre, codigo)
      `)
      .eq('presupuesto_id', presupuesto.id)

    if (!items || items.length === 0) {
      console.log('⚠️  El presupuesto no tiene items')
      return
    }

    // Agrupar precios por producto (para detectar los dos precios)
    const preciosPorProducto = {}
    for (const item of items) {
      if (!preciosPorProducto[item.producto_id]) {
        preciosPorProducto[item.producto_id] = {
          nombre: item.producto?.nombre || item.producto_id,
          precios: []
        }
      }
      preciosPorProducto[item.producto_id].precios.push(item.precio_unit_est)
    }

    // Identificar productos con dos precios
    const productosConDosPrecios = []
    const productosConUnPrecio = []

    for (const prodId in preciosPorProducto) {
      const preciosUnicos = [...new Set(preciosPorProducto[prodId].precios)]
      const info = preciosPorProducto[prodId]

      if (preciosUnicos.length === 2) {
        productosConDosPrecios.push({
          producto_id: prodId,
          nombre: info.nombre,
          precio_menor: Math.min(...preciosUnicos),
          precio_mayor: Math.max(...preciosUnicos)
        })
      } else if (preciosUnicos.length === 1) {
        productosConUnPrecio.push({
          producto_id: prodId,
          nombre: info.nombre,
          precio: preciosUnicos[0]
        })
      }
    }

    console.log('='.repeat(100))
    console.log('PRODUCTOS CON DOS PRECIOS (Mayorista → Mayor, Minorista → Menor):')
    console.log('='.repeat(100))
    for (const p of productosConDosPrecios) {
      console.log(`📦 ${p.nombre}`)
      console.log(`   Mayorista (barato): $${p.precio_menor}`)
      console.log(`   Minorista (caro):  $${p.precio_mayor}`)
    }

    if (productosConUnPrecio.length > 0) {
      console.log('\n' + '='.repeat(100))
      console.log(`PRODUCTOS CON UN SOLO PRECIO (${productosConUnPrecio.length}):`)
      console.log('='.repeat(100))
      for (const p of productosConUnPrecio.slice(0, 10)) {
        console.log(`📦 ${p.nombre} - $${p.precio}`)
      }
      if (productosConUnPrecio.length > 10) {
        console.log(`... y ${productosConUnPrecio.length - 10} más`)
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('⏳  Cargando precios en LISTA MINORISTA...')
    console.log('='.repeat(100))

    const listaMinoristaId = 'f1c62e66-7b4c-4c82-b1a5-a7d125e05acd'

    let insertados = 0
    let actualizados = 0
    let errores = 0

    // Cargar precios minoristas (el precio MAYOR para productos con dos precios)
    for (const item of items) {
      const prodId = item.producto_id
      const info = preciosPorProducto[prodId]
      const preciosUnicos = [...new Set(info.precios)]

      // Si tiene dos precios, usar el MAYOR para minorista
      // Si tiene uno solo, usar ese
      let precioMinorista
      if (preciosUnicos.length === 2) {
        precioMinorista = Math.max(...preciosUnicos)
      } else {
        precioMinorista = preciosUnicos[0]
      }

      // Verificar si ya existe
      const { data: existente } = await supabase
        .from('precios_productos')
        .select('id')
        .eq('lista_precio_id', listaMinoristaId)
        .eq('producto_id', prodId)
        .single()

      if (existente) {
        const { error: updateError } = await supabase
          .from('precios_productos')
          .update({
            precio: precioMinorista,
            updated_at: new Date().toISOString()
          })
          .eq('id', existente.id)

        if (updateError) {
          errores++
        } else {
          actualizados++
        }
      } else {
        const { error: insertError } = await supabase
          .from('precios_productos')
          .insert({
            lista_precio_id: listaMinoristaId,
            producto_id: prodId,
            precio: precioMinorista,
            activo: true
          })

        if (insertError) {
          console.error(`❌ Error insertando ${info.nombre}:`, insertError.message)
          errores++
        } else {
          insertados++
        }
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('✅ PROCESO FINALIZADO - LISTA MINORISTA')
    console.log(`   Precios insertados: ${insertados}`)
    console.log(`   Precios actualizados: ${actualizados}`)
    console.log(`   Errores: ${errores}`)
    console.log('='.repeat(100))

    // Verificar cuántos precios quedaron en cada lista
    const { count: countMayorista } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351')
      .eq('activo', true)

    const { count: countMinorista } = await supabase
      .from('precios_productos')
      .select('*', { count: 'exact', head: true })
      .eq('lista_precio_id', listaMinoristaId)
      .eq('activo', true)

    console.log('\n📊 RESUMEN FINAL:')
    console.log(`   Lista Mayorista: ${countMayorista || 0} precios activos`)
    console.log(`   Lista Minorista: ${countMinorista || 0} precios activos`)

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

cargarPreciosMinorista().then(() => {
  console.log('\n=== FIN DEL PROCESO ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
