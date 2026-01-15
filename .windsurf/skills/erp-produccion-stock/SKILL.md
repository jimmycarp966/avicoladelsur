---
name: erp-produccion-stock
description: Control estricto de Stock FIFO, Merma Líquida y Producción. Usar al modificar módulo de Almacén/Producción.
---

# ERP Producción y Stock

Gestiona el ciclo de vida de productos desde entrada hasta venta.

## Stock FIFO (Critical)
- **Obligatorio**: Usar `fn_descontar_stock_fifo` para descuentos
- **Lotes**: Siempre descontar del más antiguo primero

## Producción y Merma
1. **Merma Líquida Proporcional**: En `fn_completar_orden_produccion`
   - Factor = merma_total / peso_productos
   - Distribuir usando `merma_real_kg`
2. **Pesaje Cajones**: Si `venta_mayor_habilitada` = true
   - Peso = cantidad × `kg_por_unidad_mayor` (default 20kg)

## Tablas Clave
- `lotes`: Kernel FIFO con fecha_ingreso
- `movimientos_stock`: Historial de cambios
- `produccion_ordenes`: Órdenes de desposte
- `produccion_config`: Rendimientos teóricos

## Validaciones
- Sectores válidos: Cámara 1 → Producción → Despacho
- Merma sólida vs líquida: Categorías separadas

## Debugging FIFO

### Symptom: Stock no se descuenta correctamente

**Check 1: Lote más antiguo se selecciona**
```sql
-- Verificar que se selecciona el lote más antiguo
SELECT 
  id,
  numero_lote,
  producto_id,
  cantidad_disponible,
  fecha_ingreso,
  fecha_vencimiento
FROM lotes
WHERE producto_id = 'uuid-producto'
  AND cantidad_disponible > 0
  AND fecha_vencimiento > NOW()
ORDER BY fecha_ingreso ASC
LIMIT 1;

-- Debe devolver el lote con fecha_ingreso más antigua
```

**Check 2: RPC fn_descontar_stock_fifo funciona**
```typescript
// src/actions/descontar-stock.ts
export async function descontarStockAction(args: {
  producto_id: string;
  cantidad: number;
}) {
  console.log('[Stock] Descontando stock:', args);

  const { producto_id, cantidad } = args;

  // Verificar stock disponible
  const { data: stock } = await supabase
    .from('productos_con_stock')
    .select('stock_disponible')
    .eq('id', producto_id)
    .single();

  console.log('[Stock] Stock disponible:', stock?.stock_disponible);

  if (stock?.stock_disponible < cantidad) {
    console.error('[Stock] Stock insuficiente');
    throw new Error('Stock insuficiente');
  }

  // Ejecutar RPC
  const { data, error } = await supabase.rpc('fn_descontar_stock_fifo', {
    p_producto_id: producto_id,
    p_cantidad: cantidad
  });

  if (error) {
    console.error('[Stock] Error RPC:', error);
    throw new Error(error.message);
  }

  console.log('[Stock] Descuento exitoso:', data);
  return data;
}
```

**Check 3: Movimiento de stock se registra**
```typescript
// Verificar que se registra el movimiento
const { data: movimiento } = await supabase
  .from('movimientos_stock')
  .select('*')
  .eq('lote_id', data.lote_id)
  .eq('tipo', 'venta')
  .order('created_at', { ascending: false })
  .limit(1);

console.log('[Stock] Movimiento registrado:', movimiento);
```

## Debugging Merma Líquida

### Symptom: Merma líquida no se distribuye correctamente

**Check 1: Factor se calcula correctamente**
```sql
-- Verificar cálculo de merma líquida en fn_completar_orden_produccion
SELECT 
  orden_id,
  peso_productos,
  merma_total,
  merma_total / peso_productos as factor
FROM produccion_ordenes
WHERE id = 'uuid-orden';

-- Factor debe ser entre 0 y 1
```

**Check 2: Merma se distribuye proporcionalmente**
```typescript
// src/actions/completar-orden-produccion.ts
export async function completarOrdenProduccionAction(args: {
  orden_id: string;
  merma_liquida: number;
  merma_solidas: MermaSolida[];
}) {
  console.log('[Produccion] Completando orden:', args);

  const { orden_id, merma_liquida, merma_solidas } = args;

  // Obtener orden
  const { data: orden } = await supabase
    .from('produccion_ordenes')
    .select(`
      *,
      produccion_items (
        producto_id,
        peso_real
      )
    `)
    .eq('id', orden_id)
    .single();

  console.log('[Produccion] Orden:', orden);

  // Calcular factor
  const peso_productos = orden.produccion_items.reduce(
    (sum, item) => sum + item.peso_real,
    0
  );

  const factor = merma_liquida / peso_productos;

  console.log('[Produccion] Peso productos:', peso_productos);
  console.log('[Produccion] Merma total:', merma_liquida);
  console.log('[Produccion] Factor:', factor);

  // Distribuir merma proporcionalmente
  const merma_por_producto = orden.produccion_items.map(item => ({
    producto_id: item.producto_id,
    merma_real_kg: item.peso_real * factor
  }));

  console.log('[Produccion] Merma por producto:', merma_por_producto);

  // Ejecutar RPC
  const { data, error } = await supabase.rpc('fn_completar_orden_produccion', {
    p_orden_id: orden_id,
    p_merma_liquida: merma_liquida,
    p_merma_por_producto: merma_por_producto,
    p_merma_solidas: merma_solidas
  });

  if (error) {
    console.error('[Produccion] Error RPC:', error);
    throw new Error(error.message);
  }

  console.log('[Produccion] Orden completada:', data);
  return data;
}
```

## Debugging Pesaje de Cajones

### Symptom: Peso de cajones no se calcula

**Check 1: venta_mayor_habilitada está activa**
```sql
-- Verificar que el producto tiene venta mayor habilitada
SELECT 
  id,
  codigo,
  nombre,
  venta_mayor_habilitada,
  kg_por_unidad_mayor
FROM productos
WHERE codigo LIKE '%caj%';

-- venta_mayor_habilitada debe ser true
-- kg_por_unidad_mayor debe ser 20 (default)
```

**Check 2: Peso se calcula automáticamente**
```typescript
// src/actions/crear-pedido.ts
export async function crearPedidoAction(args: {
  presupuesto_id: string;
  items: PedidoItem[];
}) {
  console.log('[Pedido] Creando pedido:', args);

  const { presupuesto_id, items } = args;

  // Obtener productos
  const productos_ids = items.map(i => i.producto_id);
  const { data: productos } = await supabase
    .from('productos')
    .select('id, venta_mayor_habilitada, kg_por_unidad_mayor')
    .in('id', productos_ids);

  // Calcular peso para cajones
  const items_con_peso = items.map(item => {
    const producto = productos.find(p => p.id === item.producto_id);

    if (producto?.venta_mayor_habilitada) {
      const peso = item.cantidad * (producto.kg_por_unidad_mayor || 20);
      console.log('[Pedido] Cajón:', item.producto_id, 'Cantidad:', item.cantidad, 'Peso:', peso);
      return { ...item, peso_final: peso };
    }

    return item;
  });

  console.log('[Pedido] Items con peso:', items_con_peso);

  // Crear pedido
  const { data, error } = await supabase.rpc('fn_convertir_presupuesto_a_pedido', {
    p_presupuesto_id: presupuesto_id,
    p_items: items_con_peso
  });

  if (error) {
    console.error('[Pedido] Error RPC:', error);
    throw new Error(error.message);
  }

  console.log('[Pedido] Pedido creado:', data);
  return data;
}
```

## Optimización de Queries

### Index para FIFO
```sql
-- Índice para selección de lote más antiguo
CREATE INDEX idx_lotes_producto_fecha
ON lotes(producto_id, fecha_ingreso ASC)
WHERE cantidad_disponible > 0
  AND fecha_vencimiento > NOW();

-- Índice para movimientos de stock
CREATE INDEX idx_movimientos_stock_lote
ON movimientos_stock(lote_id, created_at DESC);

-- Índice para productos con stock
CREATE INDEX idx_productos_stock
ON productos(id)
WHERE stock_disponible > 0;
```

### Batch operations
```typescript
// En lugar de insertar movimientos uno por uno
for (const movimiento of movimientos) {
  await supabase.from('movimientos_stock').insert(movimiento);
}

// Usar batch insert
await supabase.from('movimientos_stock').insert(movimientos);
```

## Validaciones de Lotes

### Checklist de validación
```typescript
function validarLote(lote: Lote): ValidationResult {
  const errores: string[] = [];

  // Validar fecha de ingresreso
  if (new Date(lote.fecha_ingreso) > new Date()) {
    errores.push('Fecha de ingresreso en el futuro');
  }

  // Validar fecha de vencimiento
  if (new Date(lote.fecha_vencimiento) <= new Date()) {
    errores.push('Fecha de vencimiento vencida');
  }

  // Validar cantidad
  if (lote.cantidad_ingresada <= 0) {
    errores.push('Cantidad ingresada debe ser mayor a 0');
  }

  if (lote.cantidad_disponible > lote.cantidad_ingresada) {
    errores.push('Cantidad disponible mayor a ingresada');
  }

  // Validar sector
  const sectores_validos = ['Cámara 1', 'Cámara 2', 'Producción', 'Despacho'];
  if (!sectores_validos.includes(lote.sector)) {
    errores.push(`Sector inválido: ${lote.sector}`);
  }

  return {
    valido: errores.length === 0,
    errores
  };
}
```

## Related Skills
- **avicola-test-driven-development** - Tests de FIFO
- **avicola-systematic-debugging** - Debugging de stock
- **supabase-rls-audit** - RLS para lotes
