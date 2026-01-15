---
name: supabase-rls-audit
description: Audita migraciones SQL y tablas para asegurar RLS correcto. Usar al crear/modificar tablas o políticas de seguridad.
---

# Supabase RLS Audit

Asegura que "RLS siempre activo" se respete en todo momento.

## Checklist por Migración
Para cada `CREATE TABLE`:
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] Política SELECT (usuarios ven solo lo suyo)
- [ ] Política INSERT (con `auth.uid()` o role check)
- [ ] Política UPDATE (owner o admin)
- [ ] Política DELETE (restringido)

## Patrones de Políticas
```sql
-- Solo owner
CREATE POLICY "Users see own data" ON tabla
FOR SELECT USING (auth.uid() = user_id);

-- Admin bypass
CREATE POLICY "Admin full access" ON tabla
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

## Reglas Absolutas
- **Nunca** usar `DISABLE ROW LEVEL SECURITY`
- **Admin Client**: Solo para tareas internas (Bot, Cron)
- **Audit**: Revisar 150+ migraciones existentes como referencia

## Tablas Críticas
- `clientes`, `pedidos`, `cuentas_corrientes`: Sensibles
- `rutas_reparto`, `detalles_ruta`: Necesitan políticas INSERT

## Debugging RLS

### Symptom: "Permission denied" al consultar datos

**Check 1: RLS está habilitado**
```sql
-- Verificar si RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('clientes', 'pedidos', 'lotes');

-- Resultado esperado: rowsecurity = true
```

**Check 2: Políticas existen**
```sql
-- Listar políticas de una tabla
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
WHERE tablename = 'clientes';

-- Verificar que hay políticas para SELECT, INSERT, UPDATE
```

**Check 3: Usuario autenticado**
```typescript
// Verificar usuario autenticado
const { data: { user } } = await supabase.auth.getUser();

console.log('[Auth] User:', user?.id);
console.log('[Auth] Email:', user?.email);

if (!user) {
  console.error('[Auth] No autenticado');
  throw new Error('No autenticado');
}

// Verificar rol del usuario
const { data: usuario } = await supabase
  .from('usuarios')
  .select('rol')
  .eq('id', user.id)
  .single();

console.log('[Auth] Rol:', usuario?.rol);
```

**Check 4: Probar política con usuario específico**
```sql
-- Cambiar al rol del usuario
SET ROLE vendedor_role;

-- Probar consulta
SELECT * FROM clientes LIMIT 1;

-- Si falla, la política no permite el acceso
```

### Symptom: "Permission denied" al insertar datos

**Check 1: Política INSERT tiene `auth.uid()`**
```sql
-- Verificar política INSERT
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'pedidos'
  AND cmd = 'INSERT';

-- Debe incluir auth.uid() en with_check o qual
```

**Check 2: Usuario tiene permiso de escritura**
```sql
-- Verificar rol del usuario
SELECT id, rol FROM usuarios WHERE id = auth.uid();

-- Verificar si el rol tiene permisos
SELECT * FROM pg_roles WHERE rolname = 'vendedor_role';
```

**Check 3: Datos cumplen con la política**
```typescript
// Ejemplo: Insertar pedido
const { data, error } = await supabase.from('pedidos').insert({
  cliente_id: 'uuid-cliente',
  vendedor_id: user.id, // IMPORTANTE: Debe ser auth.uid()
  estado: 'pendiente',
  total: 5000
});

// Si la política requiere vendedor_id = auth.uid(),
// esto va a fallar si vendedor_id != user.id
```

## Patrones de Políticas por Rol

### Admin (Acceso total)
```sql
-- Política para admin
CREATE POLICY "Admin full access" ON tabla
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = auth.uid() AND rol = 'admin'
  )
);
```

### Vendedor (Zona específica)
```sql
-- Vendedor ve solo clientes de su zona
CREATE POLICY "Vendedor see own zone" ON clientes
FOR SELECT
USING (
  zona_entrega IN (
    SELECT zona_id FROM vendedor_zonas
    WHERE vendedor_id = auth.uid()
  )
);

-- Vendedor crea presupuestos
CREATE POLICY "Vendedor create presupuesto" ON presupuestos
FOR INSERT
WITH CHECK (
  vendedor_id = auth.uid()
);
```

### Repartidor (Sus propias rutas)
```sql
-- Repartidor ve sus rutas
CREATE POLICY "Repartidor see own routes" ON rutas_reparto
FOR SELECT
USING (
  repartidor_id = auth.uid()
);

-- Repartidor actualiza ubicaciones
CREATE POLICY "Repartidor update location" ON ubicaciones_repartidores
FOR INSERT
WITH CHECK (
  repartidor_id = auth.uid()
);
```

### Cliente (Sus propios datos)
```sql
-- Cliente ve sus pedidos
CREATE POLICY "Cliente see own orders" ON pedidos
FOR SELECT
USING (
  cliente_id IN (
    SELECT id FROM clientes
    WHERE usuario_id = auth.uid()
  )
);

-- Cliente ve su saldo
CREATE POLICY "Cliente see own balance" ON cuentas_corrientes
FOR SELECT
USING (
  cliente_id IN (
    SELECT id FROM clientes
    WHERE usuario_id = auth.uid()
  )
);
```

## Bypass RLS para Bot y Cron

### Admin Client
```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Uso
const supabaseAdmin = createAdminClient();

// Este cliente bypass RLS
const { data } = await supabaseAdmin
  .from('clientes')
  .select('*');
```

### Service Role Key
```typescript
// El service role key tiene permisos de admin
// Úsalo SOLO para:
// - Bot WhatsApp (crear presupuestos)
// - Cron jobs (conciliación bancaria)
// - Tareas internas (migraciones, scripts)

// NUNCA exponer en el frontend
// NUNCA usar para operaciones de usuario normal
```

## Auditoría de Políticas

### Script para auditar todas las tablas
```sql
-- Tablas sin RLS habilitado
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Tablas sin políticas
SELECT 
  schemaname,
  tablename
FROM pg_tables t
WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t.tablename
  );

-- Tablas sin política SELECT
SELECT 
  schemaname,
  tablename
FROM pg_tables t
WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t.tablename AND p.cmd = 'SELECT'
  );
```

### Script para auditar políticas específicas
```sql
-- Políticas sin auth.uid()
SELECT 
  policyname,
  tablename,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('clientes', 'pedidos', 'cuentas_corrientes')
  AND (qual NOT LIKE '%auth.uid%' OR with_check NOT LIKE '%auth.uid%');
```

## Testing RLS

### Test con diferentes roles
```typescript
// src/__tests__/integration/rls.test.ts
describe('RLS Policies', () => {
  it('vendedor should only see clients in their zone', async () => {
    // Autenticar como vendedor
    const supabaseVendedor = await signInAsVendedor();

    // Consultar clientes
    const { data, error } = await supabaseVendedor
      .from('clientes')
      .select('*');

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);

    // Verificar que todos los clientes son de la zona del vendedor
    const zonas = data.map(c => c.zona_entrega);
    expect(zonas.every(z => z === 'Zona Norte')).toBe(true);
  });

  it('cliente should only see their own orders', async () => {
    // Autenticar como cliente
    const supabaseCliente = await signInAsCliente();

    // Consultar pedidos
    const { data, error } = await supabaseCliente
      .from('pedidos')
      .select('*');

    expect(error).toBeNull();

    // Verificar que todos los pedidos son del cliente
    expect(data.every(p => p.cliente_id === supabaseCliente.clienteId)).toBe(true);
  });
});
```

## Common RLS Mistakes

### ❌ Missing RLS enable
```sql
-- INCORRECTO
CREATE TABLE clientes (
  id UUID PRIMARY KEY,
  nombre TEXT
);

-- OLVIDAR: ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
```

### ✅ Correct RLS enable
```sql
-- CORRECTO
CREATE TABLE clientes (
  id UUID PRIMARY KEY,
  nombre TEXT
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
```

### ❌ Policy without auth.uid()
```sql
-- INCORRECTO
CREATE POLICY "Users see all data" ON clientes
FOR SELECT USING (true); -- ¡PERMISO A TODOS!
```

### ✅ Policy with auth.uid()
```sql
-- CORRECTO
CREATE POLICY "Users see own data" ON clientes
FOR SELECT USING (auth.uid() = usuario_id);
```

### ❌ Missing INSERT policy
```sql
-- INCORRECTO
CREATE POLICY "Users see own data" ON clientes
FOR SELECT USING (auth.uid() = usuario_id);

-- OLVIDAR: Política INSERT
```

### ✅ Complete policies
```sql
-- CORRECTO
CREATE POLICY "Users see own data" ON clientes
FOR SELECT USING (auth.uid() = usuario_id);

CREATE POLICY "Users insert own data" ON clientes
FOR INSERT WITH CHECK (auth.uid() = usuario_id);
```

## Related Skills
- **avicola-software-architecture** - Arquitectura RLS
- **erp-ventas-chatbot** - Bypass RLS para bot
- **supabase-rls-audit** - Auditoría de RLS
