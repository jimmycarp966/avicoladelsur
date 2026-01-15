# Clasificación de Skills Antigravity para Avícola del Sur

## Contexto del Proyecto

**Stack Tecnológico Avícola del Sur:**
- Framework: Next.js 16 (App Router, Server Actions)
- Frontend: React 19, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Server Actions + Supabase (PostgreSQL)
- Estado: Zustand (mínimo)
- Formularios: React Hook Form + Zod
- Tablas: TanStack Table
- Mapas: Google Maps + OpenRouteService
- Bot: WhatsApp (Twilio/Meta) + Vertex AI (Gemini)
- Reportes: pdfkit, CSV/Excel

## Clasificación de Skills

### 🔴 ALTA PRIORIDAD (Directamente Aplicables)

#### 1. `react-best-practices`
**Relevancia:** 9/10
**Por qué:** Optimización de React/Next.js de Vercel, aplicable a Next.js 16
**Adaptaciones necesarias:**
- Server Components vs Client Components
- Server Actions en lugar de API routes
- Suspense para data fetching

#### 2. `test-driven-development`
**Relevancia:** 9/10
**Por qué:** Testing crítico para módulos FIFO, conciliación, rutas
**Adaptaciones necesarias:**
- Tests de Server Actions
- Tests de integración con Supabase
- Tests de RPCs de PostgreSQL

#### 3. `systematic-debugging`
**Relevancia:** 9/10
**Por qué:** Troubleshooting de GPS, rutas, bot, conciliación
**Adaptaciones necesarias:**
- Debugging de Server Actions
- Debugging de Supabase RLS
- Debugging de Vertex AI

#### 4. `software-architecture`
**Relevancia:** 8/10
**Por qué:** Arquitectura server-authoritative, RLS
**Adaptaciones necesarias:**
- Patrón Server Actions
- Arquitectura de RLS en Supabase
- Flujos Presupuesto→Pedido→Reparto→Tesorería

#### 5. `prompt-engineering`
**Relevancia:** 8/10
**Por qué:** Mejorar prompts de Gemini para conciliación y bot
**Adaptaciones necesarias:**
- Prompts específicos para Vertex AI
- System prompts en español argentino
- Tools de Vertex AI

#### 6. `mcp-builder`
**Relevancia:** 7/10
**Por qué:** Integraciones externas (Google, OpenRouteService)
**Adaptaciones necesarias:**
- MCP para Google Maps
- MCP para OpenRouteService
- MCP para Vertex AI

### 🟡 MEDIA PRIORIDAD (Adaptables)

#### 7. `backend-dev-guidelines`
**Relevancia:** 6/10
**Por qué:** Patrones de backend, pero usa Express (no Next.js)
**Adaptaciones necesarias:**
- Convertir Express routes a Server Actions
- Convertir Prisma a Supabase client
- Adaptar BaseController a Server Actions

#### 8. `frontend-dev-guidelines`
**Relevancia:** 6/10
**Por qué:** Patrones de frontend, pero usa MUI v7 (no shadcn/ui)
**Adaptaciones necesarias:**
- Convertir MUI a shadcn/ui
- Convertir TanStack Router a Next.js App Router
- Adaptar estilos a Tailwind CSS

#### 9. `senior-architect`
**Relevancia:** 7/10
**Por qué:** Decisiones de diseño arquitectónico
**Adaptaciones necesarias:**
- Server-authoritative architecture
- RLS policies en Supabase
- Optimización de queries PostgreSQL

#### 10. `doc-coauthoring`
**Relevancia:** 6/10
**Por qué:** Documentación técnica (ARCHITECTURE.MD, README)
**Adaptaciones necesarias:**
- Documentación de Server Actions
- Documentación de RPCs de PostgreSQL
- Documentación de flujos de negocio

#### 11. `git-pushing`
**Relevancia:** 5/10
**Por qué:** Workflow de desarrollo
**Adaptaciones necesarias:**
- Branching strategy para ERP
- Code review de Server Actions
- Migraciones de Supabase

#### 12. `verification-before-completion`
**Relevancia:** 7/10
**Por qué:** Validación antes de completar tareas
**Adaptaciones necesarias:**
- Checklists para módulos críticos
- Validación de stock FIFO
- Validación de conciliación bancaria

### 🟢 BAJA PRIORIDAD (Contextuales)

#### Seguridad
- `ethical-hacking-methodology` - Seguridad de datos
- `pentest-checklist` - Auditoría de seguridad
- `top-web-vulnerabilities` - OWASP Top 10

#### No Aplicables (ERP B2B)
- `app-store-optimization` - No aplicable
- `brand-guidelines-*` - Ya definidos
- `content-creator` - No aplicable
- `slack-gif-creator` - No aplicable

#### Otras
- `algorithmic-art` - No aplicable
- `aws-penetration-testing` - No usa AWS
- `brainstorming` - Contextual
- `canvas-design` - No usa Canvas
- `claude-d3js-skill` - No usa D3.js
- `core-components` - Ya tiene componentes
- `dispatching-parallel-agents` - No usa
- `executing-plans` - Contextual
- `file-organizer` - Contextual
- `finishing-a-development-branch` - Contextual
- `frontend-design` - Ya tiene diseño
- `internal-comms-*` - No usa
- `kaizen` - Contextual
- `linux-shell-scripting` - Windows
- `loki-mode` - No usa
- `notebooklm` - No usa
- `planning-with-files` - Contextual
- `playwright-skill` - Testing E2E
- `product-manager-toolkit` - Contextual
- `react-ui-patterns` - Ya tiene patrones
- `receiving-code-review` - Contextual
- `requesting-code-review` - Contextual
- `senior-fullstack` - Contextual
- `skill-creator` - Contextual
- `skill-developer` - Contextual
- `subagent-driven-development` - No usa
- `test-fixing` - Contextual
- `testing-patterns` - Ya tiene testing
- `theme-factory` - No usa
- `ui-ux-pro-max` - Ya tiene UX
- `using-git-worktrees` - Contextual
- `using-superpowers` - No usa
- `web-artifacts-builder` - Contextual
- `web-design-guidelines` - Ya tiene diseño
- `webapp-testing` - Ya tiene testing
- `writing-plans` - Contextual
- `writing-skills` - Contextual

## Skills a Personalizar

### Fase 1: Alta Prioridad (6 skills)
1. ✅ `react-best-practices` - Adaptar a Next.js 16 + Server Actions
2. ✅ `test-driven-development` - Tests de Server Actions + Supabase
3. ✅ `systematic-debugging` - Debugging de GPS, rutas, bot, conciliación
4. ✅ `software-architecture` - Server-authoritative + RLS
5. ✅ `prompt-engineering` - Vertex AI + español argentino
6. ✅ `mcp-builder` - MCP para Google, ORS, Vertex AI

### Fase 2: Media Prioridad (5 skills)
7. `backend-dev-guidelines` - Server Actions en lugar de Express
8. `frontend-dev-guidelines` - shadcn/ui en lugar de MUI
9. `senior-architect` - Arquitectura server-authoritative
10. `doc-coauthoring` - Documentación técnica
11. `verification-before-completion` - Checklists de validación

### Fase 3: Skills Existentes del ERP (5 skills)
- `erp-produccion-stock` - Mejorar con debugging
- `erp-reparto` - Mejorar con GPS tracking
- `erp-tesoreria` - Mejorar con conciliación
- `erp-ventas-chatbot` - Mejorar con Vertex AI
- `supabase-rls-audit` - Mejorar con auditoría

### Fase 4: Skills Nuevas (2 skills)
- `erp-sucursales-auditoria` - Auditoría de precios, conteos físicos
- `erp-rrhh-liquidaciones` - Liquidaciones, asistencia, adelantos

## Resumen

- **Total skills clonadas:** 62
- **Alta prioridad:** 6 skills
- **Media prioridad:** 5 skills
- **Baja prioridad:** 51 skills
- **A personalizar:** 13 skills (6 alta + 5 media + 2 nuevas)
- **A mejorar:** 5 skills existentes
- **Total trabajo:** 18 skills

## Próximos Pasos

1. ✅ Clonar repositorio
2. ✅ Validar skills
3. ✅ Clasificar skills
4. 🔲 Personalizar 6 skills de alta prioridad
5. 🔲 Mejorar 5 skills existentes
6. 🔲 Crear 2 skills nuevas
7. 🔲 Validar todo
8. 🔲 Documentar
