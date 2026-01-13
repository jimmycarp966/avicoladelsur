---
description: Sincroniza cambios del código con documentos maestros
---
# 🔄 Workflow: Actualizar Documentación (/actualizar)

Sincroniza código con documentación maestra siguiendo `.framework/LAWS.md` §6.

## Referencia
Ver plan detallado en: `.windsurf/plans/documentacion-arquitectura-plan.md`

## Pasos

1. **Analizar Cambios Recientes**:
   - Revisar `git diff` o cambios locales en la sesión actual
   - Identificar: ¿Qué se agregó/cambió/eliminó?
   - Clasificar: ¿Afecta arquitectura, dominios, integraciones, o solo implementación?

2. **Actualizar `ARCHITECTURE_SUMMARY.md`**:
   - Sección "Cambios Recientes" (§15): agregar entrada nueva (máximo 5, FIFO)
   - Formato: `YYYY-MM-DD: [Descripción concisa del cambio]`
   - Si hay cambios estructurales: actualizar secciones de módulos (§4-9)

3. **Actualizar `README.md`**:
   - Reflejar nuevas capacidades en "Características" (§4)
   - Actualizar comandos si cambiaron scripts en `package.json`
   - Verificar que la guía de inicio rápido (§2) siga siendo correcta

4. **Actualizar `GEMINI.md`** (si aplica):
   - Agregar lección crítica a tabla "Lecciones Recientes" (máximo 10, FIFO)
   - Actualizar Stack Tecnológico (§2) si cambiaron versiones principales

5. **Verificar Consistencia**:
   - `.framework/LAWS.md`: ¿Siguen siendo válidas las reglas? ¿Hay excepciones nuevas?
   - `.context/MEMORY.md`: ¿Ya está registrado este cambio?

6. **Reportar**:
   - Informar archivos actualizados
   - Listar cambios realizados por sección
   - Sugerir próximos pasos si es necesario

> **Regla FIFO**: En "Cambios Recientes", NO borrar entradas; solo agregar nuevas. Si hay más de 5/10 (según archivo), eliminar las más antiguas.

## Documentos Fuente de Verdad

- **Arquitectura**: `ARCHITECTURE.MD` (deep dive) + `ARCHITECTURE_SUMMARY.md` (resumen)
- **Operación**: `README.md` (guía) + `SUPABASE_SETUP.md` (DB)
- **Contexto**: `GEMINI.md` (esencial) + `.context/MEMORY.md` (histórico)
- **Reglas**: `.framework/LAWS.md` (inamovibles)

// turbo
## Verificación
```powershell
# Ver archivos de documentación principal
Get-ChildItem ARCHITECTURE*.md, README.md, GEMINI.md, .framework/LAWS.md, .context/MEMORY.md

# Ver última modificación
Get-ChildItem ARCHITECTURE_SUMMARY.md, GEMINI.md | Select-Object Name, LastWriteTime
```
