// Script para probar precios de productos en listas
const { createClient } = require('@supabase/supabase-js')

// Configura tus credenciales de Supabase aquí
const supabaseUrl = 'TU_SUPABASE_URL'
const supabaseKey = 'TU_SUPABASE_ANON_KEY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPrecios() {
  try {
    console.log('=== PRUEBA DE PRECIOS MAYORISTAS ===\n')

    // 1. Obtener listas mayoristas
    const { data: listas, error: errorListas } = await supabase
      .from('listas_precios')
      .select('id, nombre, tipo, margen_ganancia')
      .eq('tipo', 'mayorista')
      .eq('activa', true)

    if (errorListas) {
      console.error('Error obteniendo listas:', errorListas)
      return
    }

    console.log('Listas MAYORISTAS encontradas:')
    listas.forEach(lista => {
      console.log(`- ${lista.nombre}: margen ${lista.margen_ganancia}%`)
    })

    if (listas.length === 0) {
      console.log('❌ No hay listas mayoristas activas')
      return
    }

    // 2. Buscar producto "alas"
    const { data: productos, error: errorProductos } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, precio_costo')
      .ilike('nombre', '%alas%')
      .eq('activo', true)

    if (errorProductos) {
      console.error('Error obteniendo productos:', errorProductos)
      return
    }

    console.log('\nProducto "alas" encontrado:')
    productos.forEach(producto => {
      console.log(`- ${producto.nombre}: costo $${producto.precio_costo}, venta $${producto.precio_venta}`)
    })

    if (productos.length === 0) {
      console.log('❌ No se encontró producto "alas"')
      return
    }

    // 3. Probar función RPC para cada lista mayorista
    for (const lista of listas) {
      for (const producto of productos) {
        console.log(`\n=== PRUEBA: ${producto.nombre} en lista ${lista.nombre} ===`)

        const { data: precio, error: errorPrecio } = await supabase.rpc('fn_obtener_precio_producto', {
          p_lista_precio_id: lista.id,
          p_producto_id: producto.id
        })

        if (errorPrecio) {
          console.error('❌ Error en RPC:', errorPrecio)
        } else {
          console.log(`✅ Precio obtenido: $${precio}`)

          // Calcular precio esperado con margen
          if (lista.margen_ganancia && producto.precio_costo) {
            const precioEsperado = producto.precio_costo * (1 + lista.margen_ganancia / 100)
            console.log(`📊 Precio esperado: $${producto.precio_costo} × (1 + ${lista.margen_ganancia}%) = $${precioEsperado.toFixed(2)}`)

            if (Math.abs(precio - precioEsperado) < 0.01) {
              console.log('✅ El precio coincide con el cálculo esperado')
            } else {
              console.log('❌ El precio NO coincide con el cálculo esperado')
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('Error general:', error)
  }
}

testPrecios()







