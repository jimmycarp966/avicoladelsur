---
name: erp-sucursales-auditoria
description: Auditoría de sucursales, conteos físicos, detección de comportamiento sospechoso y cálculo de costos promedio ponderados. Usar al modificar módulo de Sucursales.
---

# ERP Sucursales - Auditoría

Gestiona auditorías de stock, conteos físicos y detección de anomalías en sucursales.

## Conteos Físicos

### Proceso de Conteo
1. **Preparación**: Generar hoja de conteo con productos de la sucursal
2. **Ejecución**: Registrar cantidades físicas por producto
3. **Validación**: Comparar con stock teórico del sistema
4. **Ajuste**: Generar ajustes de stock si hay diferencias

### Server Action: Registrar Conteo
```typescript
'use server';

export async function registrarConteoFisicoAction(args: {
  sucursal_id: string;
  conteo_id: string;
  items: ConteoItem[];
  usuario_id: string;
}) {
  console.log('[Conteo] Registrando conteo físico:', args);

  const { sucursal_id, conteo_id, items, usuario_id } = args;

  // Obtener stock teórico
  const productos_ids = items.map(i => i.producto_id);
  const { data: stockTeorico } = await supabase
    .from('stock_sucursales')
    .select('producto_id, cantidad')
    .eq('sucursal_id', sucursal_id)
    .in('producto_id', productos_ids);

  // Calcular diferencias
  const diferencias = items.map(item => {
    const teorico = stockTeorico?.find(s => s.producto_id === item.producto_id)?.cantidad || 0;
    const diferencia = item.cantidad_fisica - teorico;

    return {
      ...item,
      cantidad_teorica: teorico,
      diferencia,
      porcentaje_diferencia: teorico > 0 ? (diferencia / teorico) * 100 : 0
    };
  });

  console.log('[Conteo] Diferencias calculadas:', diferencias);

  // Registrar conteo
  const { data, error } = await supabase.rpc('fn_registrar_conteo_fisico', {
    p_sucursal_id: sucursal_id,
    p_conteo_id: conteo_id,
    p_items: diferencias,
    p_usuario_id: usuario_id
  });

  if (error) {
    console.error('[Conteo] Error RPC:', error);
    throw new Error(error.message);
  }

  console.log('[Conteo] Conteo registrado:', data);
  return data;
}
```

## Detección de Comportamiento Sospechoso

### Patrones de Anomalía

**1. Faltantes Recurrentes**
- Mismo producto con faltantes en conteos consecutivos
- Diferencia > 10% del stock teórico

**2. Excedentes Inexplicables**
- Productos con sobrantes sin justificación
- Diferencia > 5% del stock teórico

**3. Rotación Anormal**
- Productos con rotación muy alta o muy baja
- Desvío > 2 desviaciones estándar del promedio

**4. Precios Anómalos**
- Productos con precios fuera de rango
- Desvío > 20% del precio promedio

### Server Action: Detectar Anomalías
```typescript
'use server';

export async function detectarComportamientoSospechosoAction(args: {
  sucursal_id: string;
  periodo_inicio: string;
  periodo_fin: string;
}) {
  console.log('[Auditoria] Detectando comportamiento sospechoso:', args);

  const { sucursal_id, periodo_inicio, periodo_fin } = args;

  // Obtener conteos del periodo
  const { data: conteos } = await supabase
    .from('conteos_fisicos')
    .select(`
      *,
      conteo_items (
        producto_id,
        cantidad_teorica,
        cantidad_fisica,
        diferencia,
        porcentaje_diferencia
      )
    `)
    .eq('sucursal_id', sucursal_id)
    .gte('fecha_conteo', periodo_inicio)
    .lte('fecha_conteo', periodo_fin);

  // Detectar faltantes recurrentes
  const faltantesRecurrentes = detectarFaltantesRecurrentes(conteos);

  // Detectar excedentes inexplicables
  const excedentesInexplicables = detectarExcedentesInexplicables(conteos);

  // Detectar rotación anormal
  const rotacionAnormal = await detectarRotacionAnormal(sucursal_id);

  // Detectar precios anómalos
  const preciosAnomalos = await detectarPreciosAnomalos(sucursal_id);

  const anomalias = {
    faltantes_recurrentes: faltantesRecurrentes,
    excedentes_inexplicables: excedentesInexplicables,
    rotacion_anormal: rotacionAnormal,
    precios_anomalos: preciosAnomalos
  };

  console.log('[Auditoria] Anomalías detectadas:', anomalias);

  // Guardar anomalías
  const { error } = await supabase.from('auditoria_anomalias').insert({
    sucursal_id,
    periodo_inicio,
    periodo_fin,
    anomalias,
    fecha_deteccion: new Date().toISOString()
  });

  if (error) {
    console.error('[Auditoria] Error guardando anomalías:', error);
  }

  return anomalias;
}

function detectarFaltantesRecurrentes(conteos: any[]): ProductoAnomalia[] {
  const faltantesPorProducto = new Map<string, number>();

  conteos.forEach(conteo => {
    conteo.conteo_items.forEach((item: any) => {
      if (item.diferencia < 0 && Math.abs(item.porcentaje_diferencia) > 10) {
        const count = faltantesPorProducto.get(item.producto_id) || 0;
        faltantesPorProducto.set(item.producto_id, count + 1);
      }
    });
  });

  return Array.from(faltantesPorProducto.entries())
    .filter(([_, count]) => count >= 2)
    .map(([producto_id, count]) => ({
      producto_id,
      tipo: 'faltante_recurrente',
      severidad: count >= 3 ? 'alta' : 'media',
      conteo: count
    }));
}

function detectarExcedentesInexplicables(conteos: any[]): ProductoAnomalia[] {
  const excedentes = [];

  conteos.forEach(conteo => {
    conteo.conteo_items.forEach((item: any) => {
      if (item.diferencia > 0 && item.porcentaje_diferencia > 5) {
        excedentes.push({
          producto_id: item.producto_id,
          tipo: 'excedente_inexplicable',
          severidad: item.porcentaje_diferencia > 10 ? 'alta' : 'media',
          diferencia: item.diferencia,
          porcentaje: item.porcentaje_diferencia
        });
      }
    });
  });

  return excedentes;
}

async function detectarRotacionAnormal(sucursal_id: string): ProductoAnomalia[] {
  // Calcular rotación promedio por producto
  const { data: ventas } = await supabase
    .from('ventas_sucursales')
    .select('producto_id, cantidad, fecha')
    .eq('sucursal_id', sucursal_id)
    .gte('fecha', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const rotacionPorProducto = new Map<string, number[]>();

  ventas.forEach(venta => {
    const rotaciones = rotacionPorProducto.get(venta.producto_id) || [];
    rotaciones.push(venta.cantidad);
    rotacionPorProducto.set(venta.producto_id, rotaciones);
  });

  const anomalias: ProductoAnomalia[] = [];

  rotacionPorProducto.forEach((rotaciones, producto_id) => {
    const promedio = rotaciones.reduce((a, b) => a + b, 0) / rotaciones.length;
    const desviacion = Math.sqrt(
      rotaciones.reduce((sum, r) => sum + Math.pow(r - promedio, 2), 0) / rotaciones.length
    );

    rotaciones.forEach(rotacion => {
      const desviacionesEstandar = Math.abs((rotacion - promedio) / desviacion);

      if (desviacionesEstandar > 2) {
        anomalias.push({
          producto_id,
          tipo: 'rotacion_anormal',
          severidad: desviacionesEstandar > 3 ? 'alta' : 'media',
          rotacion,
          promedio,
          desviaciones_estandar: desviacionesEstandar
        });
      }
    });
  });

  return anomalias;
}

async function detectarPreciosAnomalos(sucursal_id: string): ProductoAnomalia[] {
  // Obtener precios de ventas recientes
  const { data: ventas } = await supabase
    .from('ventas_sucursales')
    .select('producto_id, precio_unitario')
    .eq('sucursal_id', sucursal_id)
    .gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const preciosPorProducto = new Map<string, number[]>();

  ventas.forEach(venta => {
    const precios = preciosPorProducto.get(venta.producto_id) || [];
    precios.push(venta.precio_unitario);
    preciosPorProducto.set(venta.producto_id, precios);
  });

  const anomalias: ProductoAnomalia[] = [];

  preciosPorProducto.forEach((precios, producto_id) => {
    const promedio = precios.reduce((a, b) => a + b, 0) / precios.length;

    precios.forEach(precio => {
      const desviacionPorcentual = Math.abs((precio - promedio) / promedio) * 100;

      if (desviacionPorcentual > 20) {
        anomalias.push({
          producto_id,
          tipo: 'precio_anomalo',
          severidad: desviacionPorcentual > 30 ? 'alta' : 'media',
          precio,
          promedio,
          desviacion_porcentual: desviacionPorcentual
        });
      }
    });
  });

  return anomalias;
}
```

## Cálculo de Costos Promedio Ponderados

### Fórmula
```
Costo Promedio Ponderado = (Σ (Cantidad × Costo Unitario)) / Σ Cantidad
```

### Server Action: Calcular Costo Promedio
```typescript
'use server';

export async function calcularCostoPromedioPonderadoAction(args: {
  sucursal_id: string;
  producto_id: string;
  periodo_inicio: string;
  periodo_fin: string;
}) {
  console.log('[Costos] Calculando costo promedio ponderado:', args);

  const { sucursal_id, producto_id, periodo_inicio, periodo_fin } = args;

  // Obtener compras del periodo
  const { data: compras } = await supabase
    .from('compras_sucursales')
    .select('cantidad, costo_unitario')
    .eq('sucursal_id', sucursal_id)
    .eq('producto_id', producto_id)
    .gte('fecha', periodo_inicio)
    .lte('fecha', periodo_fin);

  if (!compras || compras.length === 0) {
    throw new Error('No hay compras en el periodo');
  }

  // Calcular costo promedio ponderado
  const totalCantidad = compras.reduce((sum, c) => sum + c.cantidad, 0);
  const totalCosto = compras.reduce((sum, c) => sum + (c.cantidad * c.costo_unitario), 0);
  const costoPromedio = totalCosto / totalCantidad;

  console.log('[Costos] Total cantidad:', totalCantidad);
  console.log('[Costos] Total costo:', totalCosto);
  console.log('[Costos] Costo promedio:', costoPromedio);

  // Guardar costo promedio
  const { error } = await supabase.from('costos_promedios').upsert({
    sucursal_id,
    producto_id,
    periodo_inicio,
    periodo_fin,
    costo_promedio: costoPromedio,
    total_cantidad: totalCantidad,
    total_costo: totalCosto,
    fecha_calculo: new Date().toISOString()
  });

  if (error) {
    console.error('[Costos] Error guardando costo promedio:', error);
  }

  return {
    costo_promedio: costoPromedio,
    total_cantidad: totalCantidad,
    total_costo: totalCosto,
    cantidad_compras: compras.length
  };
}
```

## Debugging Auditoría

### Symptom: Conteo no se registra

**Check 1: Items tienen formato correcto**
```typescript
// Verificar formato de items
console.log('[Conteo] Items:', items);

items.forEach(item => {
  if (!item.producto_id || typeof item.producto_id !== 'string') {
    console.error('[Conteo] producto_id inválido:', item);
  }
  if (typeof item.cantidad_fisica !== 'number' || item.cantidad_fisica < 0) {
    console.error('[Conteo] cantidad_fisica inválida:', item);
  }
});
```

**Check 2: RPC fn_registrar_conteo_fisico existe**
```sql
-- Verificar que la RPC existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'fn_registrar_conteo_fisico';
```

## Optimización de Queries

### Index para auditoría
```sql
-- Índice para conteos por sucursal y fecha
CREATE INDEX idx_conteos_sucursal_fecha
ON conteos_fisicos(sucursal_id, fecha_conteo DESC);

-- Índice para items de conteo
CREATE INDEX idx_conteo_items_conteo
ON conteo_items(conteo_id);

-- Índice para anomalías
CREATE INDEX idx_anomalias_sucursal
ON auditoria_anomalias(sucursal_id, fecha_deteccion DESC);

-- Índice para costos promedios
CREATE INDEX idx_costos_promedios_producto
ON costos_promedios(producto_id, periodo_inicio DESC);
```

## Related Skills
- **avicola-systematic-debugging** - Debugging auditoría
- **supabase-rls-audit** - RLS para auditoría
- **erp-produccion-stock** - Stock FIFO
