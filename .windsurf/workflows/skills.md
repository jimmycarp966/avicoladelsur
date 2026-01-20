---
description: Consulta skills relevantes antes de trabajar
---
# 🎯 Workflow: Skills (/skills)

## Uso
El usuario dice: `/skills "crear nuevo componente React"`

## Pasos

1. **Identificar Contexto**:
   - Módulo: [Almacén|Ventas|Reparto|Tesorería|RRHH|Sucursales]
   - Tarea: [React|Server Action|RPC|Migration|Debugging]
   - Stack: [React/Next.js|Supabase|Vertex AI|Maps]

2. **Consultar Skills Relevantes**:

   | Contexto | Skills a Consultar |
   |----------|-------------------|
   | React/Next.js | `avicola-react-best-practices` |
   | Testing | `avicola-test-driven-development` |
   | Debugging | `avicola-systematic-debugging` |
   | Arquitectura | `avicola-software-architecture` |
   | Vertex AI/Bot | `avicola-prompt-engineering` |
   | MCP/Integraciones | `avicola-mcp-builder` |
   | Almacén/Producción | `erp-produccion-stock` |
   | Reparto/GPS | `erp-reparto` |
   | Tesorería/Conciliación | `erp-tesoreria` |
   | Ventas/Bot | `erp-ventas-chatbot` |
   | RLS/Seguridad | `supabase-rls-audit` |
   | Sucursales | `erp-sucursales-auditoria` |
   | RRHH | `erp-rrhh-liquidaciones` |

3. **Leer Skills**:
   ```bash
   # Leer skill específica
   cat .windsurf/skills/[nombre-skill]/skill.md
   ```

4. **Aplicar Guías**:
   - Seguir patrones de la skill
   - Usar ejemplos de código
   - Evitar anti-patrones

5. **Validar**:
   - ¿Seguí las mejores prácticas?
   - ¿Evité los anti-patrones?
   - ¿Usé los patrones recomendados?

## Scripts de Ayuda

```powershell
# Buscar skill por contexto
Get-Content .windsurf/skills/SKILLS_CLASIFICACION.md | Select-String "React"

# Listar skills por módulo
Get-ChildItem .windsurf/skills/erp-*/skill.md | Select-Object Name

# Ver índice rápido
Get-Content .windsurf/skills/INDEX.md
```

## Ejemplos de Uso

### Ejemplo 1: Crear componente React
```
Usuario: /skills "crear componente React para tabla de pedidos"

Agente:
1. Contexto: React/Next.js + Ventas
2. Skills: avicola-react-best-practices + erp-ventas-chatbot
3. Lee skills y aplica patrones:
   - Server Component por defecto
   - TanStack Table para listados
   - Suspense para data fetching
   - shadcn/ui components
```

### Ejemplo 2: Debug GPS tracking
```
Usuario: /skills "debug GPS no actualiza"

Agente:
1. Contexto: Debugging + Reparto
2. Skills: avicola-systematic-debugging + erp-reparto
3. Lee skills y sigue workflow:
   - Verificar PWA enviando datos
   - Check API endpoint
   - Check Supabase Realtime
   - Check RLS policies
```

### Ejemplo 3: Crear Server Action
```
Usuario: /skills "crear Server Action para presupuesto"

Agente:
1. Contexto: Server Action + Ventas
2. Skills: avicola-react-best-practices + avicola-software-architecture
3. Lee skills y aplica:
   - 'use server' directive
   - Validación con Zod
   - Error handling con try/catch
   - revalidatePath después de mutación
   - Logging estructurado
```
