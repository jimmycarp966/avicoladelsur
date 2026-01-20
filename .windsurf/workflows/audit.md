---
description: Auditoría de código antes de commits
---
# 🔬 Workflow: Auditoría (/audit)

## Uso
El usuario dice: `/audit "src/actions/ventas.actions.ts"`

## Pasos

1. **Identificar Módulo**:
   - ¿Qué módulo afecta este cambio?
   - ¿Qué skills son relevantes?

2. **Consultar Skills**:
   - Ejecutar `/skills [módulo]`
   - Leer skills relevantes

3. **Verificar Checklist**:

   ### React/Next.js
   - [ ] Server Components por defecto
   - [ ] Client Components solo cuando necesario
   - [ ] Server Actions para mutaciones
   - [ ] Suspense para data fetching
   - [ ] Lazy load de componentes pesados

   ### Server Actions
   - [ ] Validación de entrada (Zod)
   - [ ] Error handling con try/catch
   - [ ] Revalidation de paths
   - [ ] Logging estructurado
   - [ ] No hay código cliente en server

   ### Supabase/RLS
   - [ ] Políticas RLS correctas
   - [ ] Uso de client correcto (server/admin)
   - [ ] Queries optimizadas
   - [ ] No hay SQL injection

   ### Testing
   - [ ] Tests escritos para lógica crítica
   - [ ] Tests de integración con Supabase
   - [ ] Tests de edge cases

4. **Buscar Documentación** (si es necesario):
   - Ejecutar `/docs [librería]`
   - Verificar mejores prácticas actuales

5. **Reportar Hallazgos**:
   - ✅ Cumple con skills
   - ⚠️ Mejoras sugeridas
   - ❌ Violaciones encontradas

## Scripts de Ayuda

```powershell
# Ver Server Actions por módulo
Get-ChildItem src/actions/*.ts | Select-String "export.*Action"

# Ver componentes React
Get-ChildItem src/components -Recurse -Filter "*.tsx" | Select-String "use client"

# Ver migraciones recientes
Get-ChildItem supabase/migrations/*.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 5

# Ver RLS policies
Get-ChildItem supabase/migrations/*.sql | Select-String "CREATE POLICY"
```

## Checklist por Módulo

### Almacén/Producción
- [ ] FIFO respetado
- [ ] Merma líquida calculada correctamente
- [ ] Pesaje de cajones autocalculado
- [ ] Validación de lotes
- [ ] Stock no negativo

### Ventas/Bot
- [ ] Presupuestos → Pedidos conversión atómica
- [ ] Vertex AI tools registradas
- [ ] Memory Bank persistente
- [ ] Bot responde en español argentino
- [ ] Saldo y límite de crédito verificados

### Reparto/GPS
- [ ] GPS tracking cada 5s
- [ ] Rutas optimizadas con ORS
- [ ] Alertas de desvío funcionan
- [ ] Coordenadas en formato correcto
- [ ] Polyline rendering OK

### Tesorería
- [ ] Conciliación bancaria con Gemini
- [ ] Matching de transacciones
- [ ] Acreditación atómica
- [ ] Arqueo de billetes
- [ ] Retiros automáticos > 50k ARS

### Sucursales
- [ ] Conteos físicos registrados
- [ ] Anomalías detectadas
- [ ] Costos promedio ponderados
- [ ] Transferencias entre sucursales
- [ ] POS funcional

### RRHH
- [ ] Liquidaciones calculadas
- [ ] Asistencia registrada
- [ ] Penalizaciones aplicadas
- [ ] Adelantos ≤ 30%
- [ ] Aprobación de adelantos

## Reporte de Auditoría

### Formato
```
## Auditoría: [Archivo]

### Contexto
- **Módulo**: [Almacén|Ventas|Reparto|Tesorería|RRHH|Sucursales]
- **Skills consultadas**: [lista de skills]
- **Documentación consultada**: [si aplica]

### ✅ Cumple
- [Lista de puntos que cumplen]

### ⚠️ Mejoras Sugeridas
- [Lista de mejoras sugeridas]

### ❌ Violaciones Encontradas
- [Lista de violaciones críticas]

### Recomendación
- [APROBAR|REVISAR|RECHAZAR]
```

### Ejemplo
```
## Auditoría: src/actions/ventas.actions.ts

### Contexto
- **Módulo**: Ventas
- **Skills consultadas**: avicola-react-best-practices, erp-ventas-chatbot
- **Documentación consultada**: /docs "Supabase RLS policies"

### ✅ Cumple
- Server Action con 'use server'
- Validación con Zod
- Error handling con try/catch
- Revalidation de paths
- Logging estructurado

### ⚠️ Mejoras Sugeridas
- Agregar tests para fn_crear_presupuesto
- Optimizar query de productos con índice

### ❌ Violaciones Encontradas
- Ninguna

### Recomendación
- APROBAR
```

## Ejemplos de Uso

### Ejemplo 1: Auditoría de Server Action
```
Usuario: /audit "src/actions/crearPresupuestoAction.ts"

Agente:
1. Identifica módulo: Ventas
2. Consulta skills: avicola-react-best-practices, erp-ventas-chatbot
3. Verifica checklist:
   - ✅ 'use server'
   - ✅ Validación Zod
   - ✅ Error handling
   - ✅ Revalidation
   - ⚠️ Sin tests
4. Reporta hallazgos
5. Recomienda agregar tests
```

### Ejemplo 2: Auditoría de Componente React
```
Usuario: /audit "src/components/ventas/PedidosTable.tsx"

Agente:
1. Identifica módulo: Ventas
2. Consulta skills: avicola-react-best-practices
3. Verifica checklist:
   - ✅ Server Component
   - ✅ TanStack Table
   - ✅ Suspense
   - ❌ No lazy loaded
4. Reporta hallazgos
5. Recomienda lazy load si es pesado
```

### Ejemplo 3: Auditoría de Migración SQL
```
Usuario: /audit "supabase/migrations/20260113_nueva_tabla.sql"

Agente:
1. Identifica módulo: [según tabla]
2. Consulta skills: supabase-rls-audit
3. Verifica checklist:
   - ✅ CREATE TABLE con constraints
   - ✅ RLS enabled
   - ✅ Policies por rol
   - ❌ Sin índices
4. Reporta hallazgos
5. Recomienda agregar índices
```
