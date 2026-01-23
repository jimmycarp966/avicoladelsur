# Skills Instaladas - Avícola del Sur ERP

Documentación de las skills instaladas en el proyecto Avícola del Sur ERP.

## Resumen

- **Total skills instaladas**: 36
  - 23 skills curadas del Top 50 Trending (skills.sh)
  - 13 skills de negocio personalizadas
- **Directorio**: `.agent/skills/` (Antigravity lee de aquí)

---

## Skills Curadas del Trending (23 skills)

Instaladas desde los repositorios oficiales de GitHub.

### Desarrollo React/Next.js
| Skill | Repo | Descripción |
|-------|------|-------------|
| `vercel-react-best-practices` | vercel-labs | Performance optimization para React 19 y Next.js 16 |
| `frontend-design` | anthropics | Diseño de interfaces premium y distintivas |
| `web-design-guidelines` | vercel-labs | Guías de diseño web moderno |
| `ui-ux-pro-max` | nextlevelbuilder | UI/UX profesional con 100 reglas de razonamiento |

### Supabase/PostgreSQL
| Skill | Repo | Descripción |
|-------|------|-------------|
| `supabase-postgres-best-practices` | supabase | Optimización de queries, índices y RLS |

### Generación de Documentos
| Skill | Repo | Descripción |
|-------|------|-------------|
| `pdf` | anthropics | Creación y manipulación de PDFs |
| `xlsx` | anthropics | Creación y edición de Excel con fórmulas |
| `docx` | anthropics | Generación de documentos Word |

### IA y Modelos
| Skill | Repo | Descripción |
|-------|------|-------------|
| `gemini` | softaworks | Optimización para Gemini 2.5 Flash / 3.0 Pro |

### Testing y Debugging
| Skill | Repo | Descripción |
|-------|------|-------------|
| `webapp-testing` | anthropics | Testing de aplicaciones web |
| `systematic-debugging` | obra | Debugging sistemático con hipótesis |
| `test-driven-development` | obra | TDD para código robusto |

### Arquitectura y Documentación
| Skill | Repo | Descripción |
|-------|------|-------------|
| `mcp-builder` | anthropics | Construcción de servidores MCP |
| `c4-architecture` | softaworks | Diagramas de arquitectura C4 |
| `mermaid-diagrams` | softaworks | Generación de diagramas Mermaid |
| `doc-coauthoring` | anthropics | Colaboración en documentación |
| `writing-clearly-and-concisely` | softaworks | Escritura clara y concisa |

### Productividad y Calidad
| Skill | Repo | Descripción |
|-------|------|-------------|
| `reducing-entropy` | softaworks | Mantener código limpio y ordenado |
| `humanizer` | softaworks | Comunicación más humana |
| `executing-plans` | obra | Ejecución efectiva de planes |
| `writing-plans` | obra | Planificación detallada |
| `subagent-driven-development` | obra | Delegación de subtareas |
| `verification-before-completion` | obra | Validación antes de entregar |

---

## Skills de Negocio Personalizadas (13 skills)

### Skills Core del ERP (6)
| Skill | Descripción |
|-------|-------------|
| `avicola-react-best-practices` | React/Next.js adaptado al stack del ERP |
| `avicola-test-driven-development` | TDD específico para módulos críticos (FIFO, saldos) |
| `avicola-systematic-debugging` | Debugging de GPS, rutas ORS, bot WhatsApp |
| `avicola-software-architecture` | Arquitectura del ERP con Server Actions y RLS |
| `avicola-prompt-engineering` | Prompts para Vertex AI (Gemini) |
| `avicola-mcp-builder` | Servidores MCP para Google Maps, ORS |

### Skills por Módulo (7)
| Skill | Módulo | Descripción |
|-------|--------|-------------|
| `erp-produccion-stock` | Almacén/WMS | FIFO, merma líquida, pesaje cajones |
| `erp-reparto` | Reparto/TMS | GPS tracking, rutas, navegación |
| `erp-tesoreria` | Tesorería | Conciliación bancaria, arqueos |
| `erp-ventas-chatbot` | Ventas/CRM | Bot WhatsApp, presupuestos |
| `erp-sucursales-auditoria` | Sucursales | Auditoría, conteos físicos |
| `erp-rrhh-liquidaciones` | RRHH | Liquidaciones, asistencias |
| `supabase-rls-audit` | Seguridad | Auditoría de políticas RLS |

---

## Cómo Funciona Antigravity con Skills

### Directorio de Skills
Antigravity lee skills desde: **`.agent/skills/`**

Cada skill es un directorio con un archivo `SKILL.md` que contiene:
- Frontmatter YAML (name, description)
- Instrucciones en Markdown
- Ejemplos de código
- Reglas y patrones

### Invocación Automática
Las skills se activan automáticamente según el contexto:

| Contexto | Skills Activadas |
|----------|------------------|
| Componentes React/Next.js | `vercel-react-best-practices`, `frontend-design` |
| Diseño UI | `ui-ux-pro-max`, `web-design-guidelines` |
| Supabase/SQL | `supabase-postgres-best-practices`, `supabase-rls-audit` |
| Generación documentos | `pdf`, `xlsx`, `docx` |
| Bot/Gemini | `gemini`, `avicola-prompt-engineering` |
| Testing | `test-driven-development`, `webapp-testing` |
| Debugging | `systematic-debugging`, `avicola-systematic-debugging` |
| Módulo Almacén | `erp-produccion-stock` |
| Módulo Reparto | `erp-reparto` |
| Módulo Tesorería | `erp-tesoreria` |
| Módulo Ventas | `erp-ventas-chatbot` |
| Módulo RRHH | `erp-rrhh-liquidaciones` |
| Arquitectura | `c4-architecture`, `mermaid-diagrams` |

---

## Actualización

**Última actualización**: 23 de enero de 2026

**Cambios realizados**:
- ✅ Eliminadas 62 skills genéricas de `antigravity-awesome-skills/`
- ✅ Instaladas 23 skills curadas del Top 50 Trending
- ✅ Mantenidas 13 skills de negocio personalizadas
- ✅ Limpiados symlinks y directorios duplicados
- ✅ Todas las skills ahora en `.agent/skills/`

**Reducción**: 48% menos skills (69 → 36), 100% relevantes

---

## Repositorios Fuente

| Repo | Skills |
|------|--------|
| [anthropics/skills](https://github.com/anthropics/skills) | pdf, xlsx, docx, frontend-design, mcp-builder, webapp-testing, doc-coauthoring |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | vercel-react-best-practices, web-design-guidelines |
| [supabase/agent-skills](https://github.com/supabase/agent-skills) | supabase-postgres-best-practices |
| [softaworks/agent-toolkit](https://github.com/softaworks/agent-toolkit) | gemini, mermaid-diagrams, c4-architecture, humanizer, reducing-entropy, writing-clearly-and-concisely |
| [obra/superpowers](https://github.com/obra/superpowers) | systematic-debugging, test-driven-development, executing-plans, writing-plans, subagent-driven-development, verification-before-completion |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | ui-ux-pro-max |
