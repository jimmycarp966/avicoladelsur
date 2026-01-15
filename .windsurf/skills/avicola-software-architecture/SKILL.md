---
name: avicola-software-architecture
description: Software architecture guide for Avícola del Sur ERP. Server-authoritative architecture, Supabase RLS patterns, Next.js 16 Server Actions, PostgreSQL RPCs, business flows (Presupuesto→Pedido→Reparto→Tesorería). Use when making architectural decisions or designing new features.
---

# Avícola del Sur - Software Architecture

Comprehensive architecture guide for the Avícola del Sur ERP system.

## Core Architectural Principles

### 1. Server-Authoritative Architecture

**Principle**: All business logic and data validation happens on the server. Client components are thin and stateless.

```
Client (React 19) → Server Actions → Supabase (PostgreSQL)
                      ↓
                   Business Logic
                      ↓
                   RLS Policies
```

**Why**: 
- Security: Clients can't bypass validation
- Consistency: Single source of truth
- Performance: Server-side data fetching
- Maintainability: Logic centralized

**Implementation**:
```typescript
// ✅ Server Component (default)
export default async function PedidosPage() {
  const pedidos = await getPedidos(); // Server-side
  return <PedidosTable pedidos={pedidos} />;
}

// ❌ Client Component with business logic (avoid)
'use client';
export default function PedidosPage() {
  const [pedidos, setPedidos] = useState([]);
  // Business logic should be in Server Actions
}
```

### 2. Row-Level Security (RLS)

**Principle**: Database enforces access control at the row level. Users can only access data they're authorized to see.

```sql
-- Example: Vendedor can only see pedidos from their zona
CREATE POLICY pedidos_select_zona ON pedidos
FOR SELECT
USING (
  zona_entrega IN (
    SELECT zona_id FROM vendedor_zonas
    WHERE vendedor_id = auth.uid()
  )
);

-- Example: Repartidor can only update ubicaciones they own
CREATE POLICY ubicaciones_update_own ON ubicaciones_repartidores
FOR UPDATE
USING (repartidor_id = auth.uid());
```

**RLS Categories**:
- **Admin**: Full access to all data
- **Vendedor**: Read pedidos in their zone, create presupuestos
- **Repartidor**: Update ubicaciones, update pedido estado
- **Cliente**: Read own pedidos, saldo
- **Sucursal**: Read stock in their sucursal

### 3. PostgreSQL RPCs for Business Logic

**Principle**: Complex business logic lives in PostgreSQL functions for atomicity and performance.

```sql
-- Example: Atomic stock discount with FIFO
CREATE OR REPLACE FUNCTION fn_descontar_stock_fifo(
  p_producto_id UUID,
  p_cantidad NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_lote_id UUID;
  v_cantidad_disponible NUMERIC;
  v_cantidad_usar NUMERIC;
BEGIN
  -- Find oldest lot with available stock
  SELECT id, cantidad_disponible
  INTO v_lote_id, v_cantidad_disponible
  FROM lotes
  WHERE producto_id = p_producto_id
    AND cantidad_disponible > 0
    AND fecha_vencimiento > NOW()
  ORDER BY fecha_ingreso ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente para producto %', p_producto_id;
  END IF;

  -- Use available stock
  v_cantidad_usar := LEAST(p_cantidad, v_cantidad_disponible);

  -- Update lot
  UPDATE lotes
  SET cantidad_disponible = cantidad_disponible - v_cantidad_usar
  WHERE id = v_lote_id;

  -- Log movement
  INSERT INTO movimientos_stock (
    lote_id, tipo, cantidad, usuario_id
  ) VALUES (
    v_lote_id, 'venta', v_cantidad_usar, auth.uid()
  );

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'cantidad_usada', v_cantidad_usar
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Benefits**:
- **Atomic**: All-or-nothing execution
- **Fast**: Runs in database, no network roundtrip
- **Secure**: RLS applies automatically
- **Testable**: Can test in isolation

## Business Flows

### Flow 1: Presupuesto → Pedido → Reparto → Tesorería

```
┌─────────────┐
│  Vendedor   │
└──────┬──────┘
       │
       │ 1. Crear Presupuesto
       ↓
┌──────────────────────────────┐
│ Server Action: crearPresupuesto │
│ - Validar stock FIFO          │
│ - Verificar límite crédito    │
│ - Call: fn_crear_presupuesto  │
└──────┬───────────────────────┘
       │
       │ 2. Presupuesto creado
       ↓
┌──────────────────────────────┐
│  Cliente (WhatsApp Bot)       │
│ - Vertex AI interpreta       │
│ - Tool: crear-pedido         │
└──────┬───────────────────────┘
       │
       │ 3. Confirmar Pedido
       ↓
┌──────────────────────────────┐
│ Server Action: convertirPresupuestoAPedido │
│ - Call: fn_convertir_presupuesto_pedido    │
│ - Descontar stock FIFO                     │
│ - Generar número pedido                    │
└──────┬─────────────────────────────────────┘
       │
       │ 4. Pedido creado
       ↓
┌──────────────────────────────┐
│  Planificador                │
│ - Asignar a ruta             │
│ - Optimizar ruta (ORS/Google)│
└──────┬───────────────────────┘
       │
       │ 5. Asignar Ruta
       ↓
┌──────────────────────────────┐
│ Server Action: asignarPedidoARuta │
│ - Call: fn_asignar_pedido_ruta     │
│ - Generar hoja de ruta             │
└──────┬─────────────────────────────┘
       │
       │ 6. Ruta asignada
       ↓
┌──────────────────────────────┐
│  Repartidor (PWA)            │
│ - GPS tracking               │
│ - Navegación interactiva     │
│ - Confirmar entregas         │
└──────┬───────────────────────┘
       │
       │ 7. Entregas confirmadas
       ↓
┌──────────────────────────────┐
│ Server Action: registrarEntregas │
│ - Call: fn_registrar_entregas     │
│ - Actualizar stock en sucursales  │
└──────┬────────────────────────────┘
       │
       │ 8. Cobros registrados
       ↓
┌──────────────────────────────┐
│  Tesorero                    │
│ - Conciliación bancaria      │
│ - Vertex AI matching         │
└──────┬───────────────────────┘
       │
       │ 9. Conciliación completada
       ↓
┌──────────────────────────────┐
│ Server Action: conciliarMovimiento │
│ - Call: fn_acreditar_saldo_cliente │
│ - Actualizar cuenta corriente     │
└───────────────────────────────────┘
```

### Flow 2: Producción → Stock FIFO

```
┌─────────────┐
│  Operario   │
└──────┬──────┘
       │
       │ 1. Crear Orden Producción
       ↓
┌──────────────────────────────┐
│ Server Action: crearOrdenProducción │
│ - Call: fn_crear_orden_produccion   │
└──────┬─────────────────────────────┘
       │
       │ 2. Orden creada
       ↓
┌──────────────────────────────┐
│  Operario                    │
│ - Registrar merma líquida    │
│ - Registrar merma sólida     │
└──────┬───────────────────────┘
       │
       │ 3. Completar Orden
       ↓
┌──────────────────────────────┐
│ Server Action: completarOrdenProducción │
│ - Call: fn_completar_orden_produccion  │
│ - Distribuir merma líquida proporcional│
│ - Crear lotes de productos terminados  │
└──────┬─────────────────────────────────┘
       │
       │ 4. Lotes creados
       ↓
┌──────────────────────────────┐
│  Sistema                     │
│ - Lotes ordenados por fecha  │
│ - FIFO para descuentos       │
└──────────────────────────────┘
```

### Flow 3: Conciliación Bancaria

```
┌─────────────┐
│  Tesorero   │
└──────┬──────┘
       │
       │ 1. Subir extracto bancario
       ↓
┌──────────────────────────────┐
│ Vertex AI (Gemini 3.0 Pro)   │
│ - Parsear PDF/CSV            │
│ - Extraer transacciones      │
└──────┬───────────────────────┘
       │
       │ 2. Transacciones extraídas
       ↓
┌──────────────────────────────┐
│ Server Action: conciliarBanco │
│ - Match con movimientos caja │
│ - Calcular similitud         │
│ - Sugerir matches            │
└──────┬───────────────────────┘
       │
       │ 3. Matches sugeridos
       ↓
┌─────────────┐
│  Tesorero   │
│ - Aprobar   │
│ - Rechazar  │
└──────┬──────┘
       │
       │ 4. Conciliación aprobada
       ↓
┌──────────────────────────────┐
│ Server Action: aplicarConciliación │
│ - Call: fn_acreditar_saldo_cliente │
│ - Actualizar cuenta corriente     │
└───────────────────────────────────┘
```

## Module Architecture

### Almacén (WMS)

**Components**:
- Server Components: ProductosPage, LotesPage, MovimientosPage
- Server Actions: crearLote, descontarStock, registrarMovimiento
- RPCs: `fn_descontar_stock_fifo`, `fn_completar_orden_produccion`
- RLS: Admin full access, Sucursal read own stock

**Data Flow**:
```
Producción → Lotes → FIFO → Ventas → Descuento
```

### Ventas (CRM)

**Components**:
- Server Components: PresupuestosPage, PedidosPage, ClientesPage
- Server Actions: crearPresupuesto, convertirPresupuestoAPedido
- RPCs: `fn_crear_presupuesto`, `fn_convertir_presupuesto_pedido`
- RLS: Vendedor read/write own zone, Cliente read own data

**Data Flow**:
```
Presupuesto → Pedido → Ruta → Entrega
```

### Reparto (TMS)

**Components**:
- Server Components: MonitorPage, RutasPage, HojaRutaPage
- Server Actions: asignarPedidoARuta, registrarUbicacion, registrarEntrega
- RPCs: `fn_asignar_pedido_ruta`, `fn_registrar_entrega`
- External APIs: OpenRouteService, Google Maps
- Realtime: Supabase Realtime for GPS updates

**Data Flow**:
```
Ruta → GPS Tracking → Navegación → Entrega
```

### Tesorería

**Components**:
- Server Components: ConciliacionPage, CuentasCorrientesPage, CajasPage
- Server Actions: conciliarBanco, aplicarConciliacion
- RPCs: `fn_acreditar_saldo_cliente_v2`
- External APIs: Vertex AI (Gemini 3.0 Pro)

**Data Flow**:
```
Extracto → Gemini → Matching → Acreditación
```

### Sucursales

**Components**:
- Server Components: StockSucursalPage, ConteosPage, AuditoriaPage
- Server Actions: registrarConteo, detectarComportamientoSospechoso
- RPCs: `fn_registrar_conteo`, `fn_detectar_comportamiento_sospechoso`

**Data Flow**:
```
Conteo → Detección → Alerta → Auditoría
```

### RRHH

**Components**:
- Server Components: LiquidacionesPage, AsistenciaPage, AdelantosPage
- Server Actions: calcularLiquidacion, registrarAsistencia, solicitarAdelanto
- RPCs: `fn_calcular_liquidacion`, `fn_calcular_adelanto`

**Data Flow**:
```
Asistencia → Cálculo → Liquidación → Pago
```

## Database Schema Patterns

### FIFO Pattern

```sql
-- Lotes ordered by fecha_ingreso
CREATE INDEX idx_lotes_fecha_ingreso ON lotes(producto_id, fecha_ingreso ASC);

-- Always select oldest lot first
SELECT * FROM lotes
WHERE producto_id = $1
  AND cantidad_disponible > 0
  AND fecha_vencimiento > NOW()
ORDER BY fecha_ingreso ASC
LIMIT 1;
```

### Audit Trail Pattern

```sql
-- Every table has audit columns
CREATE TABLE movimientos_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'ingreso', 'venta', 'merma'
  cantidad NUMERIC NOT NULL,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- RLS: Users can see all movements (read-only)
CREATE POLICY movimientos_select_all ON movimientos_stock
FOR SELECT USING (true);
```

### Soft Delete Pattern

```sql
-- Use deleted_at instead of DELETE
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  deleted_at TIMESTAMPTZ
);

-- Filter out deleted in queries
SELECT * FROM clientes WHERE deleted_at IS NULL;
```

## Security Patterns

### Authentication

```typescript
// Supabase Auth
const { data: { user } } = await supabase.auth.getUser();

// Get user role
const { data: usuario } = await supabase
  .from('usuarios')
  .select('rol')
  .eq('id', user.id)
  .single();
```

### Authorization

```sql
-- RLS policies enforce authorization
CREATE POLICY pedidos_select_own ON pedidos
FOR SELECT
USING (cliente_id IN (
  SELECT id FROM clientes WHERE vendedor_id = auth.uid()
));
```

### Input Validation

```typescript
// Server Actions validate with Zod
const schema = z.object({
  cliente_id: z.string().uuid(),
  items: z.array(z.object({
    producto_id: z.string().uuid(),
    cantidad: z.number().min(0.1)
  }))
});

const validated = schema.parse(formData);
```

## Performance Patterns

### Database Indexing

```sql
-- Index foreign keys
CREATE INDEX idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_ruta ON pedidos(ruta_id);

-- Index for queries
CREATE INDEX idx_lotes_producto_fecha ON lotes(producto_id, fecha_ingreso);
CREATE INDEX idx_ubicaciones_repartidor ON ubicaciones_repartidores(repartidor_id, created_at DESC);
```

### Caching Strategy

```typescript
// Server Components cache automatically
export const revalidate = 60; // Revalidate every 60s

// Manual revalidation
revalidatePath('/almacen/presupuestos');
revalidateTag('pedidos');
```

### Query Optimization

```sql
-- Use materialized views for complex queries
CREATE MATERIALIZED VIEW productos_con_stock AS
SELECT 
  p.id,
  p.nombre,
  SUM(l.cantidad_disponible) as stock_total
FROM productos p
LEFT JOIN lotes l ON l.producto_id = p.id
GROUP BY p.id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW productos_con_stock;
```

## Quick Reference

| Need | Pattern |
|------|---------|
| Business logic | PostgreSQL RPC |
| Data access | Server Components |
| Mutations | Server Actions |
| Authorization | RLS policies |
| Validation | Zod schemas |
| Real-time | Supabase Realtime |
| External APIs | Server Actions |

## Related Skills

- **erp-produccion-stock** - FIFO implementation
- **erp-reparto** - GPS and route architecture
- **erp-tesoreria** - Reconciliation architecture
- **supabase-rls-audit** - RLS patterns
