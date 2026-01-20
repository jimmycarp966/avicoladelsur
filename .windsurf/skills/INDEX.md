# 📋 Índice de Skills por Contexto

## Mapeo Rápido

### Por Módulo del ERP

| Módulo | Skills |
|--------|--------|
| **Almacén/Producción** | `erp-produccion-stock`, `avicola-test-driven-development`, `avicola-systematic-debugging` |
| **Ventas/Bot** | `erp-ventas-chatbot`, `avicola-prompt-engineering`, `avicola-react-best-practices` |
| **Reparto/GPS** | `erp-reparto`, `avicola-mcp-builder`, `avicola-systematic-debugging` |
| **Tesorería** | `erp-tesoreria`, `avicola-prompt-engineering`, `avicola-systematic-debugging` |
| **Sucursales** | `erp-sucursales-auditoria`, `supabase-rls-audit`, `avicola-test-driven-development` |
| **RRHH** | `erp-rrhh-liquidaciones`, `supabase-rls-audit`, `avicola-test-driven-development` |

### Por Tipo de Tarea

| Tarea | Skills |
|-------|--------|
| **React/Next.js** | `avicola-react-best-practices` |
| **Testing** | `avicola-test-driven-development` |
| **Debugging** | `avicola-systematic-debugging` |
| **Arquitectura** | `avicola-software-architecture` |
| **Vertex AI/Bot** | `avicola-prompt-engineering` |
| **MCP/Integraciones** | `avicola-mcp-builder` |
| **RLS/Seguridad** | `supabase-rls-audit` |

### Por Stack Tecnológico

| Stack | Skills |
|-------|--------|
| **React 19** | `avicola-react-best-practices` |
| **Next.js 16** | `avicola-react-best-practices` |
| **Supabase** | `avicola-software-architecture`, `supabase-rls-audit` |
| **Vertex AI** | `avicola-prompt-engineering` |
| **Google Maps** | `erp-reparto`, `avicola-mcp-builder` |
| **OpenRouteService** | `erp-reparto`, `avicola-mcp-builder` |

## Comandos Rápidos

```bash
# Ver skill específica
cat .windsurf/skills/[nombre-skill]/skill.md

# Buscar por módulo
grep -r "Almacén" .windsurf/skills/*/skill.md

# Ver todas las skills personalizadas
ls .windsurf/skills/avicola-*/skill.md

# Ver skills del ERP
ls .windsurf/skills/erp-*/skill.md
```

## Descripción de Skills

### Skills Personalizadas (Alta Prioridad)

#### avicola-react-best-practices
- **Descripción**: React y Next.js 16 performance optimization
- **Cuándo usar**: Al escribir, revisar o refactorizar código React/Next.js
- **Archivos**: Componentes React, Server Actions, Páginas Next.js

#### avicola-test-driven-development
- **Descripción**: Test-driven development para el ERP
- **Cuándo usar**: Al escribir tests para módulos críticos
- **Archivos**: Tests en `src/__tests__/`, Scripts de testing

#### avicola-systematic-debugging
- **Descripción**: Systematic debugging guide
- **Cuándo usar**: Al troubleshooting de producción
- **Archivos**: Logs Vercel, Logs Supabase, Console navegador

#### avicola-software-architecture
- **Descripción**: Software architecture guide
- **Cuándo usar**: Al tomar decisiones arquitectónicas o diseñar nuevas features
- **Archivos**: `ARCHITECTURE.MD`, `ARCHITECTURE_SUMMARY.md`, Migraciones

#### avicola-prompt-engineering
- **Descripción**: Prompt engineering guide para Vertex AI (Gemini)
- **Cuándo usar**: Al mejorar prompts de Gemini para bot y conciliación
- **Archivos**: `src/lib/vertex/prompts/system-prompt.ts`, `src/lib/vertex/tools/`

#### avicola-mcp-builder
- **Descripción**: MCP (Model Context Protocol) builder guide
- **Cuándo usar**: Al crear nuevas integraciones o servidores MCP
- **Archivos**: `mcp-servers/`, `.windsurf/mcp-config.json`

### Skills Específicas del ERP

#### erp-produccion-stock
- **Descripción**: Control estricto de Stock FIFO, Merma Líquida y Producción
- **Cuándo usar**: Al modificar módulo de Almacén/Producción
- **Archivos**: `src/actions/almacen.actions.ts`, RPCs de stock

#### erp-reparto
- **Descripción**: Optimiza logística last-mile, rutas GPS y gestión de repartidores
- **Cuándo usar**: Al modificar módulo de Reparto/TMS
- **Archivos**: `src/actions/reparto.actions.ts`, `src/components/reparto/`

#### erp-tesoreria
- **Descripción**: Gestión de cajas, conciliación bancaria y precisión financiera
- **Cuándo usar**: Al modificar módulo de Tesorería/Finanzas
- **Archivos**: `src/actions/tesoreria.actions.ts`, RPCs de conciliación

#### erp-ventas-chatbot
- **Descripción**: Gestión de preventa, presupuestos y Bot WhatsApp con Vertex AI
- **Cuándo usar**: Al modificar módulo de Ventas/CRM/Bot
- **Archivos**: `src/app/api/bot/route.ts`, `src/lib/vertex/`

#### supabase-rls-audit
- **Descripción**: Audita migraciones SQL y tablas para asegurar RLS correcto
- **Cuándo usar**: Al crear/modificar tablas o políticas de seguridad
- **Archivos**: `supabase/migrations/`, SQL Editor

#### erp-sucursales-auditoria
- **Descripción**: Auditoría de sucursales, conteos físicos, detección de comportamiento sospechoso
- **Cuándo usar**: Al modificar módulo de Sucursales
- **Archivos**: `src/actions/registrar-conteo.ts`, `src/actions/detectar-anomalias.ts`

#### erp-rrhh-liquidaciones
- **Descripción**: Liquidaciones de sueldos, control de asistencia, penalizaciones y adelantos
- **Cuándo usar**: Al modificar módulo de RRHH
- **Archivos**: `src/actions/calcular-liquidacion.ts`, `src/actions/registrar-asistencia.ts`

## Workflows Relacionados

- `/skills` - Consulta skills relevantes antes de trabajar
- `/docs` - Busca documentación externa con Context7
- `/audit` - Auditoría de código antes de commits
- `/architecture` - Lee toda la arquitectura del sistema
- `/debug` - Diagnóstico rápido de errores

## Notas

1. **Priorizar Skills Personalizadas**: Las skills `avicola-*` están adaptadas específicamente al stack del ERP
2. **Consultar Skills del ERP**: Para módulos específicos, siempre consultar las skills `erp-*`
3. **Usar Workflows**: Los workflows `/skills`, `/docs`, `/audit` automatizan la consulta de skills
4. **Actualizar Skills**: Si encuentras un patrón nuevo, considera actualizar la skill correspondiente
