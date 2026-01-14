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
