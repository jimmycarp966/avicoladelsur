# Skills Instaladas - Avícola del Sur ERP

Documentación de las skills instaladas en el proyecto Avícola del Sur ERP.

## Resumen

- **Total skills instaladas**: 69
  - 62 skills de Antigravity Awesome Skills
  - 6 skills personalizadas de alta prioridad
  - 5 skills existentes mejoradas
  - 2 skills nuevas creadas

## Estructura de Skills

```
.agent/skills/
├── antigravity-awesome-skills/ (62 skills originales)
│   ├── algorithmic-art/
│   ├── app-store-optimization/
│   ├── aws-penetration-testing/
│   ├── backend-dev-guidelines/
│   ├── brainstorming/
│   ├── brand-guidelines-anthropic/
│   ├── brand-guidelines-community/
│   ├── canvas-design/
│   ├── claude-d3js-skill/
│   ├── content-creator/
│   ├── core-components/
│   ├── dispatching-parallel-agents/
│   ├── doc-coauthoring/
│   ├── docx-official/
│   ├── ethical-hacking-methodology/
│   ├── executing-plans/
│   ├── file-organizer/
│   ├── finishing-a-development-branch/
│   ├── frontend-design/
│   ├── frontend-dev-guidelines/
│   ├── git-pushing/
│   ├── internal-comms-anthropic/
│   ├── internal-comms-community/
│   ├── kaizen/
│   ├── linux-shell-scripting/
│   ├── loki-mode/
│   ├── mcp-builder/
│   ├── notebooklm/
│   ├── pentest-checklist/
│   ├── pdf-official/
│   ├── planning-with-files/
│   ├── playwright-skill/
│   ├── pptx-official/
│   ├── product-manager-toolkit/
│   ├── prompt-engineering/
│   ├── react-best-practices/
│   ├── react-ui-patterns/
│   ├── receiving-code-review/
│   ├── requesting-code-review/
│   ├── senior-architect/
│   ├── senior-fullstack/
│   ├── skill-creator/
│   ├── skill-developer/
│   ├── slack-gif-creator/
│   ├── software-architecture/
│   ├── subagent-driven-development/
│   ├── systematic-debugging/
│   ├── test-driven-development/
│   ├── test-fixing/
│   ├── testing-patterns/
│   ├── theme-factory/
│   ├── top-web-vulnerabilities/
│   ├── ui-ux-pro-max/
│   ├── using-git-worktrees/
│   ├── using-superpowers/
│   ├── verification-before-completion/
│   ├── web-artifacts-builder/
│   ├── web-design-guidelines/
│   ├── webapp-testing/
│   ├── writing-plans/
│   ├── writing-skills/
│   └── xlsx-official/
├── avicola-react-best-practices/ (personalizada)
├── avicola-test-driven-development/ (personalizada)
├── avicola-systematic-debugging/ (personalizada)
├── avicola-software-architecture/ (personalizada)
├── avicola-prompt-engineering/ (personalizada)
├── avicola-mcp-builder/ (personalizada)
├── erp-produccion-stock/ (mejorada)
├── erp-reparto/ (mejorada)
├── erp-tesoreria/ (mejorada)
├── erp-ventas-chatbot/ (mejorada)
├── supabase-rls-audit/ (mejorada)
├── erp-sucursales-auditoria/ (nueva)
└── erp-rrhh-liquidaciones/ (nueva)
```

## Skills Personalizadas de Alta Prioridad

### 1. avicola-react-best-practices
**Descripción**: React y Next.js 16 performance optimization para Avícola del Sur ERP.

**Características**:
- Server Components vs Client Components
- Server Actions en lugar de API routes
- Suspense para data fetching
- Zustand para estado global (mínimo)
- React Hook Form + Zod para formularios
- TanStack Table para listados
- shadcn/ui + Tailwind CSS

**Cuándo usar**: Al escribir, revisar o refactorizar código React/Next.js.

**Archivos relacionados**:
- Componentes React en `src/components/`
- Server Actions en `src/actions/`
- Páginas en `src/app/`

### 2. avicola-test-driven-development
**Descripción**: Test-driven development para Avícola del Sur ERP.

**Características**:
- Tests de Server Actions
- Tests de integración con Supabase
- Tests de FIFO stock descuento
- Tests de conversión presupuestos → pedidos
- Tests de asignación de rutas
- Tests de conciliación bancaria

**Cuándo usar**: Al escribir tests para módulos críticos.

**Archivos relacionados**:
- Tests en `src/__tests__/`
- Scripts de testing en `scripts/`

### 3. avicola-systematic-debugging
**Descripción**: Systematic debugging guide para Avícola del Sur ERP.

**Características**:
- Debugging de GPS tracking
- Debugging de rutas (ORS/Google)
- Debugging de bot WhatsApp
- Debugging de conciliación bancaria
- Debugging de Server Actions
- Debugging de Supabase RLS

**Cuándo usar**: Al troubleshooting de producción.

**Archivos relacionados**:
- Logs de Vercel
- Logs de Supabase
- Console del navegador

### 4. avicola-software-architecture
**Descripción**: Software architecture guide para Avícola del Sur ERP.

**Características**:
- Server-authoritative architecture
- Supabase RLS patterns
- Next.js 16 Server Actions
- PostgreSQL RPCs
- Flujos de negocio (Presupuesto → Pedido → Reparto → Tesorería)

**Cuándo usar**: Al tomar decisiones arquitectónicas o diseñar nuevas features.

**Archivos relacionados**:
- `ARCHITECTURE.MD`
- `ARCHITECTURE_SUMMARY.md`
- Migraciones en `supabase/migrations/`

### 5. avicola-prompt-engineering
**Descripción**: Prompt engineering guide para Vertex AI (Gemini).

**Características**:
- Spanish Argentine persona
- Tool definitions claras
- Memory Bank integration
- Few-shot learning
- Chain of thought
- Self-correction

**Cuándo usar**: Al mejorar prompts de Gemini para bot y conciliación.

**Archivos relacionados**:
- `src/lib/vertex/prompts/system-prompt.ts`
- `src/lib/vertex/tools/`
- `src/lib/vertex/session-manager.ts`

### 6. avicola-mcp-builder
**Descripción**: MCP (Model Context Protocol) builder guide.

**Características**:
- Google Maps MCP server
- OpenRouteService MCP server
- Vertex AI MCP server
- Supabase MCP server
- Tool definitions
- Error handling

**Cuándo usar**: Al crear nuevas integraciones o servidores MCP.

**Archivos relacionados**:
- `mcp-servers/`
- `.windsurf/mcp-config.json`

## Skills Existentes Mejoradas

### 1. erp-produccion-stock
**Descripción**: Control estricto de Stock FIFO, Merma Líquida y Producción.

**Mejoras**:
- Debugging de FIFO
- Debugging de merma líquida
- Debugging de pesaje de cajones
- Optimización de queries
- Validaciones de lotes

**Cuándo usar**: Al modificar módulo de Almacén/Producción.

### 2. erp-reparto
**Descripción**: Optimiza logística last-mile, rutas GPS y gestión de repartidores.

**Mejoras**:
- Debugging GPS tracking
- Debugging route optimization
- Debugging navegación interactiva
- Optimización de queries
- Alertas de desvío

**Cuándo usar**: Al modificar módulo de Reparto/TMS.

### 3. erp-tesoreria
**Descripción**: Gestión de cajas, conciliación bancaria y precisión financiera.

**Mejoras**:
- Debugging conciliación bancaria
- Debugging matching de transacciones
- Debugging acreditación de saldos
- Optimización de queries
- Validaciones de arqueo

**Cuándo usar**: Al modificar módulo de Tesorería/Finanzas.

### 4. erp-ventas-chatbot
**Descripción**: Gestión de preventa, presupuestos y Bot WhatsApp con Vertex AI.

**Mejoras**:
- Debugging bot WhatsApp
- Debugging presupuestos
- Debugging conversión presupuesto → pedido
- Optimización de queries
- Memory Bank patterns

**Cuándo usar**: Al modificar módulo de Ventas/CRM/Bot.

### 5. supabase-rls-audit
**Descripción**: Audita migraciones SQL y tablas para asegurar RLS correcto.

**Mejoras**:
- Debugging RLS
- Patrones de políticas por rol
- Bypass RLS para bot y cron
- Auditoría de políticas
- Testing RLS

**Cuándo usar**: Al crear/modificar tablas o políticas de seguridad.

## Skills Nuevas Creadas

### 1. erp-sucursales-auditoria
**Descripción**: Auditoría de sucursales, conteos físicos, detección de comportamiento sospechoso.

**Características**:
- Conteos físicos de stock
- Detección de faltantes recurrentes
- Detección de excedentes inexplicables
- Detección de rotación anormal
- Detección de precios anómalos
- Cálculo de costos promedio ponderados

**Cuándo usar**: Al modificar módulo de Sucursales.

**Archivos relacionados**:
- `src/actions/registrar-conteo.ts`
- `src/actions/detectar-anomalias.ts`
- `src/actions/calcular-costo-promedio.ts`

### 2. erp-rrhh-liquidaciones
**Descripción**: Liquidaciones de sueldos, control de asistencia, penalizaciones y adelantos.

**Características**:
- Cálculo de sueldos (base, horas extra, bonificaciones, descuentos)
- Control de asistencia
- Penalizaciones por ausentismo y retrasos
- Gestión de adelantos (límite 30%)
- Aprobación de adelantos

**Cuándo usar**: Al modificar módulo de RRHH.

**Archivos relacionados**:
- `src/actions/calcular-liquidacion.ts`
- `src/actions/registrar-asistencia.ts`
- `src/actions/solicitar-adelanto.ts`
- `src/actions/aprobar-adelanto.ts`

## Skills de Antigravity (Clasificación)

### Alta Prioridad (6 skills)
- `react-best-practices` - React/Next.js performance
- `test-driven-development` - Testing patterns
- `systematic-debugging` - Debugging techniques
- `software-architecture` - Architecture patterns
- `prompt-engineering` - AI prompt engineering
- `mcp-builder` - MCP server building

### Media Prioridad (5 skills)
- `backend-dev-guidelines` - Backend patterns (Express → Server Actions)
- `frontend-dev-guidelines` - Frontend patterns (MUI → shadcn/ui)
- `senior-architect` - Architectural decisions
- `doc-coauthoring` - Technical documentation
- `verification-before-completion` - Validation checklists

### Baja Prioridad (51 skills)
- Skills de seguridad (ethical-hacking, pentest)
- Skills de diseño (canvas-design, ui-ux-pro-max)
- Skills de productividad (file-organizer, kaizen)
- Skills de desarrollo (git-pushing, planning-with-files)
- Skills específicas de otras tecnologías

## Uso de Skills por Módulo

### Almacén (WMS)
- `erp-produccion-stock` - FIFO, merma líquida
- `avicola-test-driven-development` - Tests de stock
- `avicola-systematic-debugging` - Debugging de stock

### Ventas (CRM)
- `erp-ventas-chatbot` - Bot WhatsApp, presupuestos
- `avicola-prompt-engineering` - Prompts para bot
- `avicola-react-best-practices` - Componentes de ventas

### Reparto (TMS)
- `erp-reparto` - GPS tracking, rutas
- `avicola-mcp-builder` - MCP para Google Maps y ORS
- `avicola-systematic-debugging` - Debugging GPS

### Tesorería
- `erp-tesoreria` - Conciliación bancaria
- `avicola-prompt-engineering` - Prompts para Gemini
- `avicola-systematic-debugging` - Debugging conciliación

### Sucursales
- `erp-sucursales-auditoria` - Auditoría, conteos físicos
- `avicola-test-driven-development` - Tests de auditoría
- `supabase-rls-audit` - RLS para sucursales

### RRHH
- `erp-rrhh-liquidaciones` - Liquidaciones, asistencia
- `avicola-test-driven-development` - Tests de liquidaciones
- `supabase-rls-audit` - RLS para RRHH

## Validación

Todas las skills pasaron la validación con `validate_skills.py`:
- ✅ 62 skills de Antigravity validadas
- ✅ 6 skills personalizadas validadas
- ✅ 5 skills mejoradas validadas
- ✅ 2 skills nuevas validadas

## Invocación Automática

Las skills se invocan automáticamente cuando Cascade detecta contextos relevantes:

- **avicola-react-best-practices**: Al trabajar con componentes React/Next.js
- **avicola-test-driven-development**: Al escribir tests
- **avicola-systematic-debugging**: Al troubleshooting
- **avicola-software-architecture**: Al diseñar arquitectura
- **avicola-prompt-engineering**: Al trabajar con Vertex AI
- **avicola-mcp-builder**: Al crear servidores MCP
- **erp-produccion-stock**: Al modificar Almacén/Producción
- **erp-reparto**: Al modificar Reparto/TMS
- **erp-tesoreria**: Al modificar Tesorería
- **erp-ventas-chatbot**: Al modificar Ventas/Bot
- **supabase-rls-audit**: Al crear/modificar tablas
- **erp-sucursales-auditoria**: Al modificar Sucursales
- **erp-rrhh-liquidaciones**: Al modificar RRHH

## Referencias

- **Plan de instalación**: `.windsurf/plans/instalar-skills-antigravity-plan.md`
- **Clasificación de skills**: `.agent/skills/SKILLS_CLASIFICACION.md`
- **Arquitectura del sistema**: `ARCHITECTURE.MD`
- **README del proyecto**: `README.md`

## Actualización

Última actualización: 15 de enero de 2026

**Versiones**:
- Antigravity Awesome Skills: v1.0.0
- Skills personalizadas: v1.0.0
- Skills mejoradas: v2.0.0
- Skills nuevas: v1.0.0
