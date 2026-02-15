// Script para verificar la lista de precios y comparar con productos
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkListaPrecios() {
  console.log('=== VERIFICANDO LISTA DE PRECIOS ===\n')

  try {
    // Obtener la lista de precios que se está usando
    const listaId = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

    const { data: lista, error: listaError } = await supabase
      .from('listas_precios')
      .select('*')
      .eq('id', listaId)
      .single()

    if (listaError) {
      console.error('❌ Error obteniendo lista de precios:', listaError)
      return
    }

    console.log(`📋 Lista de precios: ${lista.nombre}`)
    console.log(`   ID: ${lista.id}`)
    console.log(`   Tipo: ${lista.tipo}`)
    console.log(`   Activa: ${lista.activa}`)
    console.log(`   Descripción: ${lista.descripcion || 'Sin descripción'}\n`)

    // Obtener items de la lista de precios
    const { data: itemsLista, error: itemsError } = await supabase
      .from('precios_productos')
      .select(`
        *,
        producto:productos(nombre, codigo, precio_venta)
      `)
      .eq('lista_precio_id', listaId)
      .eq('activo', true)

    if (itemsError) {
      console.error('❌ Error obteniendo items de la lista:', itemsError)
      return
    }

    console.log(`📦 Items en la lista: ${itemsLista?.length || 0}\n`)

    if (itemsLista && itemsLista.length > 0) {
      console.log('='.repeat(120))
      console.log('Producto'.padEnd(50) + ' | ' + 'Precio Lista'.padEnd(15) + ' | ' + 'Precio Producto'.padEnd(15) + ' | ' + 'Diferencia')
      console.log('='.repeat(120))

      let diferencias = 0

      for (const item of itemsLista) {
        const precioProducto = item.producto?.precio_venta
        const precioLista = item.precio
        const diff = precioProducto ? precioLista - precioProducto : null
        const diffStr = diff !== null ? `$${diff.toFixed(2)}` : 'N/A'

        console.log(
          (item.producto?.nombre || item.producto_id).substring(0, 50).padEnd(50) + ' | ' +
          `$${precioLista.toFixed(2)}`.padEnd(15) + ' | ' +
          (precioProducto ? `$${precioProducto.toFixed(2)}`.padEnd(15) : 'N/A             '.padEnd(15)) + ' | ' +
          diffStr
        )

        if (diff !== null && Math.abs(diff) > 0.01) {
          diferencias++
        }
      }

      console.log('='.repeat(120))
      console.log(`\n⚠️  Items con precio diferente al producto base: ${diferencias} de ${itemsLista.length}`)
    }

    // Verificar si hay productos sin precio en esta lista
    console.log('\n\n=== VERIFICANDO PRODUCTOS SIN PRECIO EN ESTA LISTA ===\n')

    const { data: todosLosProductos } = await supabase
      .from('productos')
      .select('id, nombre, codigo, precio_venta')
      .eq('activo', true)
      .order('nombre')

    if (todosLosProductos) {
      const productosEnLista = itemsLista?.map(i => i.producto_id) || []
      const productosSinPrecio = todosLosProductos.filter(p => !productosEnLista.includes(p.id))

      console.log(`📦 Total productos activos: ${todosLosProductos.length}`)
      console.log(`📦 Productos con precio en esta lista: ${productosEnLista.length}`)
      console.log(`📦 Productos SIN precio en esta lista: ${productosSinPrecio.length}`)

      if (productosSinPrecio.length > 0) {
        console.log('\n⚠️  Productos sin precio en esta lista (usarán precio del producto):')
        productosSinPrecio.slice(0, 20).forEach(p => {
          console.log(`   - ${p.nombre} ($${p.precio_venta?.toFixed(2) || 'N/A'})`)
        })
        if (productosSinPrecio.length > 20) {
          console.log(`   ... y ${productosSinPrecio.length - 20} más`)
        }
      }
    }

  } catch (err) {
    console.error('❌ Error ejecutando el script:', err)
  }
}

checkListaPrecios().then(() => {
  console.log('\n=== FIN DEL ANÁLISIS ===')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
