import { createClient } from './src/lib/supabase/server.js';

async function checkProducts() {
  try {
    const supabase = await createClient();

    const productCodes = ['55', '148', '149', '150', '151', '152', '153', '204', '205', '227', '471'];

    console.log('🔍 Buscando productos con códigos:', productCodes.join(', '));
    console.log('---');

    const { data: products, error } = await supabase
      .from('productos')
      .select('id, codigo, nombre, categoria, precio_venta, activo')
      .in('codigo', productCodes)
      .order('codigo');

    if (error) {
      console.error('❌ Error al consultar productos:', error);
      return;
    }

    if (!products || products.length === 0) {
      console.log('❌ No se encontraron productos con esos códigos.');
      console.log('---');
      console.log('📋 Productos encontrados en la base de datos (primeros 20):');

      const { data: allProducts, error: allError } = await supabase
        .from('productos')
        .select('codigo, nombre')
        .limit(20);

      if (allError) {
        console.error('❌ Error al obtener todos los productos:', allError);
      } else if (allProducts && allProducts.length > 0) {
        allProducts.forEach(p => console.log(`  ${p.codigo} - ${p.nombre}`));
        console.log(`\n📊 Total de productos en BD: ${allProducts.length} (mostrando primeros 20)`);
      } else {
        console.log('❌ No hay productos en la base de datos.');
      }
      return;
    }

    console.log('✅ Productos encontrados:');
    products.forEach(product => {
      console.log(`  ${product.codigo} - ${product.nombre} (Categoría: ${product.categoria || 'N/A'}, Precio: $${product.precio_venta}, Activo: ${product.activo ? 'Sí' : 'No'})`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkProducts();
