---
name: avicola-systematic-debugging
description: Systematic debugging guide for Avícola del Sur ERP. GPS tracking issues, route optimization problems, Vertex AI bot failures, reconciliation errors, Supabase RLS issues, Server Actions debugging. Use when troubleshooting production issues.
---

# Avícola del Sur - Systematic Debugging

Comprehensive debugging guide for troubleshooting issues in the Avícola del Sur ERP system.

## Debugging Workflow

```
1. Identify Symptom → 2. Isolate Component → 3. Reproduce Issue → 4. Add Logging → 5. Analyze Logs → 6. Fix → 7. Verify
```

## Common Issues by Module

### 🚛 GPS Tracking Issues

#### Symptom: Ubicaciones no se actualizan en Monitor

**Step 1: Verify PWA is sending data**
```typescript
// Check browser console in repartidor PWA
console.log('GPS polling active:', navigator.geolocation.watchPosition !== undefined);

// Check network tab for POST /api/reparto/ubicacion
// Should see requests every 5 seconds
```

**Step 2: Check API endpoint**
```typescript
// src/app/api/reparto/ubicacion/route.ts
export async function POST(req: Request) {
  console.log('[GPS] Received location update'); // Add this log
  const body = await req.json();
  console.log('[GPS] Body:', JSON.stringify(body, null, 2)); // Log full body

  const { repartidor_id, latitud, longitud, timestamp } = body;

  if (!repartidor_id || !latitud || !longitud) {
    console.error('[GPS] Missing required fields:', body);
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  // ... rest of logic
}
```

**Step 3: Check Supabase Realtime subscription**
```typescript
// Check if Monitor is subscribed correctly
useEffect(() => {
  const channel = supabase
    .channel('ubicaciones-repartidores')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ubicaciones_repartidores'
    }, (payload) => {
      console.log('[Monitor] Received location update:', payload);
      setUbicaciones(prev => [...prev, payload.new]);
    })
    .subscribe((status) => {
      console.log('[Monitor] Subscription status:', status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

**Step 4: Check RLS policies**
```sql
-- Verify repartidores can INSERT ubicaciones
SELECT * FROM pg_policies 
WHERE tablename = 'ubicaciones_repartidores';

-- Test with repartidor user
SET ROLE repartidor_role;
INSERT INTO ubicaciones_repartidores (repartidor_id, latitud, longitud, timestamp)
VALUES ('test-repartidor', -26.0, -65.0, NOW());
```

#### Symptom: Alertas de desvío no se muestran

**Step 1: Verify alert logic**
```typescript
// Add logging to alert detection
const distancia = calcularDistancia(ubicacionActual, ubicacionEsperada);
console.log('[Alert] Distance:', distancia, 'Threshold:', 200);

if (distancia > 200) {
  console.log('[Alert] Desvío detectado:', distancia);
  setAlertas(prev => [...prev, {
    tipo: 'desvio',
    repartidor_id: ubicacion.repartidor_id,
    distancia,
    timestamp: new Date()
  }]);
}
```

**Step 2: Check Google Maps polyline**
```typescript
// Verify polyline is being rendered
console.log('[Map] Polyline points:', polyline?.length);
console.log('[Map] First point:', polyline?.[0]);
console.log('[Map] Last point:', polyline?.[polyline.length - 1]);

// Check if polyline is valid
if (!polyline || polyline.length === 0) {
  console.error('[Map] Invalid polyline');
}
```

### 🗺️ Route Optimization Issues

#### Symptom: Rutas no se optimizan correctamente

**Step 1: Check OpenRouteService API**
```typescript
// Add logging to ORS call
console.log('[ORS] Request:', {
  coordinates: clientes.map(c => [c.longitud, c.latitud]),
  profile: 'driving-car'
});

const response = await fetch(ORS_API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    coordinates: clientes.map(c => [c.longitud, c.latitud]),
    profile: 'driving-car'
  })
});

const data = await response.json();
console.log('[ORS] Response:', JSON.stringify(data, null, 2));

if (data.error) {
  console.error('[ORS] Error:', data.error);
}
```

**Step 2: Check fallback to local optimizer**
```typescript
// Add logging to fallback logic
if (data.error || !data.routes) {
  console.log('[ORS] Fallback to local optimizer');
  const resultadoLocal = optimizarRutaLocal(clientes, puntoPartida);
  console.log('[Local] Result:', resultadoLocal);
  return resultadoLocal;
}
```

**Step 3: Verify coordinate format**
```typescript
// Check coordinates are in correct format (longitude, latitude)
const coordenadas = clientes.map(c => {
  console.log('[Coords] Cliente:', c.id, 'Lat:', c.latitud, 'Lng:', c.longitud);
  return [c.longitud, c.latitud]; // ORS expects [lng, lat]
});

// Verify coordinates are valid numbers
const invalidCoords = coordenadas.filter(([lng, lat]) =>
  isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90
);

if (invalidCoords.length > 0) {
  console.error('[Coords] Invalid coordinates:', invalidCoords);
}
```

### 🤖 Vertex AI Bot Issues

#### Symptom: Bot no responde o responde incorrectamente

**Step 1: Check Vertex AI configuration**
```typescript
// Add logging to agent initialization
console.log('[Vertex] Initializing agent...');
console.log('[Vertex] Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('[Vertex] Model:', process.env.GEMINI_MODEL_FLASH);

const agent = new VertexAgent({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  model: process.env.GEMINI_MODEL_FLASH!
});

console.log('[Vertex] Agent initialized:', agent);
```

**Step 2: Check tool invocation**
```typescript
// Add logging to tool execution
console.log('[Bot] Tool invoked:', toolName);
console.log('[Bot] Tool args:', JSON.stringify(args, null, 2));

try {
  const result = await executeTool(toolName, args);
  console.log('[Bot] Tool result:', JSON.stringify(result, null, 2));
  return result;
} catch (error) {
  console.error('[Bot] Tool error:', error);
  throw error;
}
```

**Step 3: Check session management**
```typescript
// Add logging to session operations
console.log('[Session] Creating session for phone:', phoneNumber);

const session = await sessionManager.getSession(phoneNumber);
console.log('[Session] Session found:', !!session);
console.log('[Session] Context:', JSON.stringify(session?.context, null, 2));

// Check memory bank
const customerContext = await sessionManager.getCustomerContext(phoneNumber);
console.log('[Memory] Customer context:', JSON.stringify(customerContext, null, 2));
```

**Step 4: Check tool definitions**
```typescript
// Verify tools are registered correctly
console.log('[Bot] Available tools:', Object.keys(tools));

// Test individual tool
try {
  const result = await tools['consultar-stock']({ producto_codigo: 'POLLO001' });
  console.log('[Bot] Tool test result:', result);
} catch (error) {
  console.error('[Bot] Tool test error:', error);
}
```

### 💰 Reconciliation Issues

#### Symptom: Conciliación bancaria no matchea correctamente

**Step 1: Check Gemini 3.0 Pro parsing**
```typescript
// Add logging to Gemini parsing
console.log('[Gemini] Parsing bank statement...');
console.log('[Gemini] Input length:', bankStatementText.length);

const parsed = await gemini.parseBankStatement(bankStatementText);
console.log('[Gemini] Parsed transactions:', parsed.transactions.length);
console.log('[Gemini] Sample transaction:', JSON.stringify(parsed.transactions[0], null, 2));
```

**Step 2: Check matching logic**
```typescript
// Add logging to matching
console.log('[Match] Finding matches for transaction:', transaction);

const matches = await findMatches(transaction, movimientosCaja);
console.log('[Match] Found', matches.length, 'potential matches');

matches.forEach((match, index) => {
  console.log(`[Match] Match ${index + 1}:`, {
    similarity: match.similarity,
    movimiento: match.movimiento
  });
});

// Check if best match is above threshold
if (matches.length > 0 && matches[0].similarity > 0.8) {
  console.log('[Match] Best match accepted:', matches[0]);
} else {
  console.log('[Match] No acceptable match found');
}
```

**Step 3: Check RPC execution**
```typescript
// Add logging to RPC call
console.log('[RPC] Executing fn_acreditar_saldo_cliente_v2');
console.log('[RPC] Params:', {
  cliente_id: match.cliente_id,
  monto: transaction.monto,
  caja_id: cajaId,
  usuario_id: usuarioId
});

const { data, error } = await supabase.rpc('fn_acreditar_saldo_cliente_v2', {
  p_cliente_id: match.cliente_id,
  p_monto: transaction.monto,
  p_caja_id: cajaId,
  p_usuario_id: usuarioId
});

console.log('[RPC] Result:', { data, error });

if (error) {
  console.error('[RPC] Error:', error);
  throw error;
}
```

### 🔒 Supabase RLS Issues

#### Symptom: "Permission denied" errors

**Step 1: Check current user role**
```typescript
// Add logging to auth checks
const { data: { user } } = await supabase.auth.getUser();
console.log('[Auth] User:', user?.id);
console.log('[Auth] Email:', user?.email);

// Check user role
const { data: role } = await supabase
  .from('usuarios')
  .select('rol')
  .eq('id', user?.id)
  .single();

console.log('[Auth] Role:', role?.rol);
```

**Step 2: Check RLS policies**
```sql
-- List all policies for a table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'pedidos';

-- Test policy with specific user
SET ROLE admin_role;
SELECT * FROM pedidos LIMIT 1;

SET ROLE vendedor_role;
SELECT * FROM pedidos LIMIT 1;
```

**Step 3: Check row-level security is enabled**
```sql
-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('pedidos', 'lotes', 'movimientos_stock');
```

### ⚡ Server Actions Issues

#### Symptom: Server Action fails silently

**Step 1: Add error logging**
```typescript
'use server';

export async function crearPresupuestoAction(formData: FormData) {
  try {
    console.log('[Action] Creating presupuesto...');
    const validated = crearPresupuestoSchema.parse(formData);
    console.log('[Action] Validated data:', JSON.stringify(validated, null, 2));

    const result = await supabase.rpc('fn_crear_presupuesto', validated);
    console.log('[Action] RPC result:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('[Action] RPC error:', result.error);
      throw new Error(result.error.message);
    }

    revalidatePath('/almacen/presupuestos');
    console.log('[Action] Success');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[Action] Error:', error);
    if (error instanceof z.ZodError) {
      console.error('[Action] Validation errors:', error.errors);
      return { success: false, error: 'Validación fallida', details: error.errors };
    }
    return { success: false, error: 'Error interno del servidor' };
  }
}
```

**Step 2: Check revalidation**
```typescript
// Add logging to revalidation
console.log('[Action] Revalidating path: /almacen/presupuestos');
revalidatePath('/almacen/presupuestos');
console.log('[Action] Revalidation complete');
```

**Step 3: Test with curl**
```bash
# Test Server Action directly
curl -X POST http://localhost:3000/api/crear-presupuesto \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": "uuid-cliente",
    "items": [{"producto_id": "uuid-pollo", "cantidad": 5}]
  }'
```

## Debugging Checklist

### GPS Tracking
- [ ] PWA sending location updates every 5s
- [ ] API endpoint receiving requests
- [ ] Supabase storing locations
- [ ] Realtime subscription working
- [ ] Monitor displaying markers
- [ ] Alerts triggering correctly
- [ ] RLS policies allow INSERT/SELECT

### Route Optimization
- [ ] ORS API key valid
- [ ] Coordinates in correct format [lng, lat]
- [ ] ORS response contains routes
- [ ] Fallback to local optimizer working
- [ ] Polyline rendering correctly
- [ ] Order of visit updating

### Vertex AI Bot
- [ ] Project ID configured
- [ ] Model name correct
- [ ] Tools registered
- [ ] Session management working
- [ ] Memory bank persisting
- [ ] Tool invocations successful
- [ ] Responses in Spanish

### Reconciliation
- [ ] Gemini 3.0 Pro parsing correctly
- [ ] Transactions extracted
- [ ] Matching logic working
- [ ] Similarity scores above threshold
- [ ] RPC executing successfully
- [ ] Transactions atomic

### Server Actions
- [ ] Input validation working
- [ ] RPC calls successful
- [ ] Error handling in place
- [ ] Revalidation working
- [ ] Response format correct

## Common Error Messages

### "Permission denied"
- Check RLS policies
- Verify user role
- Check row-level security is enabled

### "Stock insuficiente"
- Check lotes disponibles
- Verify FIFO ordering
- Check fecha_vencimiento

### "No acceptable match found"
- Check transaction format
- Verify similarity threshold
- Check Gemini parsing

### "RPC error"
- Check RPC exists
- Verify parameters
- Check RLS policies

## Debugging Tools

### Browser DevTools
```javascript
// Console
console.log('[Debug]', variable);

// Network tab - check API requests
// Application tab - check localStorage, cookies

// Performance tab - check render times
```

### Supabase Logs
```sql
-- Query logs
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%fn_descontar_stock_fifo%'
ORDER BY total_time DESC
LIMIT 10;
```

### Vercel Logs
```bash
# View logs
vercel logs

# Filter by function
vercel logs --filter "api/bot"
```

## Quick Reference

| Issue | First Check |
|-------|-------------|
| GPS not updating | Check PWA console for errors |
| Routes not optimizing | Check ORS API key and coordinates |
| Bot not responding | Check Vertex AI config and tools |
| Reconciliation failing | Check Gemini parsing and matching |
| Permission denied | Check RLS policies and user role |
| Server Action failing | Add try/catch with logging |

## Related Skills

- **erp-produccion-stock** - FIFO debugging
- **erp-reparto** - GPS and route debugging
- **erp-tesoreria** - Reconciliation debugging
- **erp-ventas-chatbot** - Vertex AI debugging
