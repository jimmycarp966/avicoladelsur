---
description: Buscar documentación externa con Context7
---
# 📚 Workflow: Documentación Externa (/docs)

## Uso
El usuario dice: `/docs "cómo usar React Hook Form con Zod"`

## Pasos

1. **Identificar Librería**:
   - Nombre: [react-hook-form, zod, nextjs, supabase, etc.]
   - Versión: [si es relevante]

2. **Resolver Library ID**:
   ```typescript
   // Usar MCP Context7
   mcp0_resolve-library-id({
     libraryName: "react-hook-form",
     query: "cómo usar React Hook Form con Zod"
   })
   ```

3. **Consultar Documentación**:
   ```typescript
   // Usar MCP Context7
   mcp0_query-docs({
     libraryId: "/react-hook-form/react-hook-form",
     query: "cómo usar React Hook Form con Zod"
   })
   ```

4. **Aplicar al Proyecto**:
   - Adaptar ejemplos al stack del ERP
   - Considerar Server Components vs Client Components
   - Verificar compatibilidad con Next.js 16

5. **Documentar Cambios**:
   - Agregar a MEMORY.md si es aprendizaje nuevo
   - Actualizar skills si es patrón recurrente

## Cuándo Usar Context7

- ✅ Dudas sobre API de librerías externas
- ✅ Cambios recientes en librerías (versiones nuevas)
- ✅ Mejores prácticas actualizadas
- ✅ Ejemplos de código para patrones específicos
- ❌ NO usar para lógica de negocio del ERP
- ❌ NO usar para arquitectura del proyecto (usar skills)

## Librerías Comunes del ERP

| Librería | Context7 ID | Uso en ERP |
|----------|-------------|------------|
| Next.js | `/vercel/next.js` | Framework principal |
| React Hook Form | `/react-hook-form/react-hook-form` | Formularios |
| Zod | `/zod/zod` | Validación |
| Supabase | `/supabase/supabase` | Backend |
| TanStack Table | `/tanstack/table` | Tablas |
| Zustand | `/pmndrs/zustand` | Estado global |
| Tailwind CSS | `/tailwindlabs/tailwindcss` | Estilos |
| shadcn/ui | `/shadcn-ui/ui` | Componentes UI |

## Ejemplos de Uso

### Ejemplo 1: React Hook Form + Zod
```
Usuario: /docs "React Hook Form con Zod en Server Components"

Agente:
1. Identifica librería: react-hook-form
2. Resuelve ID: /react-hook-form/react-hook-form
3. Consulta: "React Hook Form con Zod en Server Components"
4. Aplica al ERP:
   - Usa useForm con zodResolver
   - Considera Server Components vs Client Components
   - Integra con Server Actions
```

### Ejemplo 2: Next.js 16 Server Actions
```
Usuario: /docs "Next.js 16 Server Actions best practices"

Agente:
1. Identifica librería: nextjs
2. Resuelve ID: /vercel/next.js
3. Consulta: "Server Actions best practices"
4. Aplica al ERP:
   - 'use server' directive
   - Validación de entrada
   - Error handling
   - Revalidation
```

### Ejemplo 3: Supabase RLS
```
Usuario: /docs "Supabase RLS policies para multi-tenant"

Agente:
1. Identifica librería: supabase
2. Resuelve ID: /supabase/supabase
3. Consulta: "RLS policies para multi-tenant"
4. Aplica al ERP:
   - Políticas por rol (admin, vendedor, repartidor)
   - Políticas por sucursal
   - Bypass para bot y cron jobs
```

## Scripts de Ayuda

```powershell
# Ver MCP servers disponibles
# (disponible en sistema)

# Buscar documentación en el proyecto
Get-ChildItem docs -Recurse -Filter "*.md" | Select-String "React Hook Form"

# Ver versiones de librerías
Get-Content package.json | Select-String "react-hook-form"
```

## Notas Importantes

1. **Priorizar Skills sobre Docs**: Primero consultar skills del proyecto, luego buscar docs externas
2. **Adaptar al Stack**: Los ejemplos de docs pueden no considerar Next.js 16 + Server Actions
3. **Verificar Compatibilidad**: Asegurar que la solución sea compatible con el stack actual
4. **Documentar Aprendizajes**: Si encuentras un patrón útil, agregarlo a MEMORY.md o actualizar skills
