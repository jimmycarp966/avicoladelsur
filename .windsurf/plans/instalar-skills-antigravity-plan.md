# Plan: Instalación y Personalización de Skills Antigravity para Avícola del Sur

Instalar las 62+ skills del repositorio antigravity-awesome-skills y personalizar las relevantes para el ERP Avícola del Sur con todos sus módulos (Almacén, Ventas, Reparto, Tesorería, Sucursales, RRHH, Chatbot).

## Contexto del Proyecto

**Avícola del Sur ERP** - Sistema integral de gestión con:
- **Stack**: Next.js 16, React 19, TypeScript, Supabase (PostgreSQL), Tailwind CSS, shadcn/ui
- **Integraciones**: Google Gemini AI, Google Maps, OpenRouteService, WhatsApp (Twilio/Meta)
- **Módulos**: Almacén (WMS/FIFO), Ventas (CRM), Reparto (TMS/GPS), Tesorería, Sucursales, RRHH, Chatbot
- **Skills actuales**: 5 skills personalizadas en `.agent/skills/` (erp-produccion-stock, erp-reparto, erp-tesoreria, erp-ventas-chatbot, supabase-rls-audit)

## Pasos de Implementación

### 1. Clonar Repositorio Antigravity
- Clonar `https://github.com/sickn33/antigravity-awesome-skills.git` en `.agent/skills/`
- Verificar estructura de 62+ skills
- Ejecutar script de validación `validate_skills.py`

### 2. Clasificar Skills por Relevancia
Analizar las 62+ skills y categorizarlas:

**Alta Prioridad (Directamente aplicables):**
- `backend-dev-guidelines` - Para consistencia en Server Actions
- `frontend-dev-guidelines` - Para componentes React/Next.js
- `react-best-practices` - Para componentes UI
- `test-driven-development` - Para testing de módulos críticos
- `systematic-debugging` - Para troubleshooting de producción
- `software-architecture` - Para arquitectura escalable

**Media Prioridad (Adaptables):**
- `senior-architect` - Para decisiones de diseño
- `prompt-engineering` - Para mejorar prompts de Gemini
- `mcp-builder` - Para integraciones externas
- `doc-coauthoring` - Para documentación técnica
- `git-pushing` - Para workflow de desarrollo

**Baja Prioridad (Contextuales):**
- `ethical-hacking-methodology` - Para seguridad de datos
- `pentest-checklist` - Para auditoría de seguridad
- `app-store-optimization` - No aplicable (ERP B2B)
- `brand-guidelines-*` - Ya definidos en el proyecto

### 3. Personalizar Skills Relevantes

**3.1. Backend Dev Guidelines**
- Adaptar a Supabase RPCs y Server Actions
- Incluir patrones FIFO y validaciones de stock
- Agregar ejemplos de conciliación bancaria con Gemini
- Referenciar funciones críticas: `fn_descontar_stock_fifo`, `fn_acreditar_saldo_cliente_v2`

**3.2. Frontend Dev Guidelines**
- Adaptar a Next.js 16 App Router
- Incluir patrones de shadcn/ui y Tailwind
- Agregar ejemplos de componentes de Reparto (MonitorMap, NavigationView)
- Referenciar Zustand para estado global

**3.3. React Best Practices**
- Adaptar a React 19 y Server Components
- Incluir patrones de formularios con React Hook Form + Zod
- Agregar ejemplos de TanStack Table para listados
- Referenciar componentes reutilizables del ERP

**3.4. Test Driven Development**
- Crear tests para módulos críticos:
  - FIFO descuento de stock
  - Conversión presupuestos → pedidos
  - Asignación de rutas
  - Conciliación bancaria
- Incluir ejemplos de tests de integración con Supabase
- Referenciar scripts de testing existentes

**3.5. Systematic Debugging**
- Incluir checklist para debugging de:
  - GPS tracking y alertas
  - Optimización de rutas (ORS/Google)
  - Bot WhatsApp y Vertex AI
  - Conciliación bancaria con Gemini
- Agregar comandos útiles de diagnóstico

**3.6. Software Architecture**
- Documentar arquitectura server-authoritative
- Incluir patrones de RLS en Supabase
- Agregar diagramas de flujos (Presupuesto → Pedido → Reparto → Tesorería)
- Referenciar ARCHITECTURE.MD y ARCHITECTURE_SUMMARY.md

### 4. Crear Skills Personalizadas para Módulos Específicos

**4.1. Skill: erp-fifo-stock (Mejorar existente)**
- Expandir con ejemplos de debugging
- Agregar patrones de optimización de queries
- Incluir checklist de validación de lotes

**4.2. Skill: erp-reparto-tms (Mejorar existente)**
- Expandir con patrones de GPS tracking
- Agregar ejemplos de optimización ORS/Google
- Incluir troubleshooting de navegación interactiva

**4.3. Skill: erp-tesoreria-conciliacion (Mejorar existente)**
- Expandir con patrones de Gemini 3.0 Pro
- Agregar ejemplos de matching inteligente
- Incluir debugging de extractos bancarios

**4.4. Skill: erp-ventas-chatbot (Mejorar existente)**
- Expandir con Vertex AI tools
- Agregar ejemplos de Memory Bank
- Incluir troubleshooting de comandos

**4.5. Skill: erp-sucursales-auditoria (Nueva)**
- Patrones de conteos físicos
- Detección de comportamiento sospechoso
- Cálculo de costos promedio ponderados

**4.6. Skill: erp-rrhh-liquidaciones (Nueva)**
- Patrones de cálculo de sueldos
- Control de asistencia y penalizaciones
- Gestión de adelantos (límite 30%)

### 5. Validar Skills Actualizadas
- Ejecutar `validate_skills.py` en todas skills
- Verificar formato YAML frontmatter correcto
- Probar invocación automática de skills en contextos relevantes
- Documentar skills que se activan por trigger

### 6. Documentación
- Crear `SKILLS_INSTALADAS.md` con lista de skills y uso
- Actualizar `ARCHITECTURE.MD` con sección de Skills
- Crear guía rápida de uso de skills por módulo
- Documentar patrones de invocación automática

## Estructura Final de Skills

```
.agent/skills/
├── antigravity-awesome-skills/ (62+ skills originales)
│   ├── backend-dev-guidelines/
│   ├── frontend-dev-guidelines/
│   ├── react-best-practices/
│   ├── test-driven-development/
│   ├── systematic-debugging/
│   ├── software-architecture/
│   └── [56 más]
├── erp-produccion-stock/ (actualizada)
├── erp-reparto/ (actualizada)
├── erp-tesoreria/ (actualizada)
├── erp-ventas-chatbot/ (actualizada)
├── supabase-rls-audit/ (actualizada)
├── erp-sucursales-auditoria/ (nueva)
└── erp-rrhh-liquidaciones/ (nueva)
```

## Criterios de Éxito

- ✅ 62+ skills de antigravity instaladas y validadas
- ✅ 6 skills de alta prioridad personalizadas para Avícola del Sur
- ✅ 5 skills existentes mejoradas con patrones específicos
- ✅ 2 skills nuevas creadas para módulos específicos
- ✅ Todas las skills pasan validación `validate_skills.py`
- ✅ Documentación completa de uso por módulo
- ✅ Cascade invoca skills automáticamente en contextos relevantes

## Riesgos y Mitigaciones

**Riesgo**: Skills de antigravity pueden tener conflictos con patrones existentes
- **Mitigación**: Revisar cada skill antes de personalizar, mantener compatibilidad

**Riesgo**: Demasiadas skills pueden causar ruido en invocación automática
- **Mitigación**: Configurar triggers específicos, usar descripciones claras en YAML

**Riesgo**: Skills personalizadas pueden desactualizarse
- **Mitigación**: Documentar patrones específicos en ARCHITECTURE.MD, mantener sincronización

## Tiempo Estimado

- Clonación y revisión: 15 minutos
- Clasificación de skills: 30 minutos
- Personalización de 6 skills alta prioridad: 2 horas
- Mejora de 5 skills existentes: 1.5 horas
- Creación de 2 skills nuevas: 1 hora
- Validación y testing: 30 minutos
- Documentación: 45 minutos

**Total**: ~6 horas
