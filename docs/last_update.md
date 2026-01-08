# Última Actualización

**Fecha:** 2026-01-08 17:05
**Autor:** Antigravity

**Resumen:**
Se implementó soporte integral para Alias Bancarios en Clientes, permitiendo asociar múltiples DNIs para conciliación inteligente. También se habilitó Hard Delete para limpieza de clientes y se mejoró la UX de Conciliación mostrando el detalle de las reglas de matching (etiquetas) en la tabla de revisión.

**Archivos Detectados:**
- src/actions/conciliacion.actions.ts
- src/actions/ventas.actions.ts
- src/app/(admin)/(dominios)/ventas/clientes/[id]/editar/page.tsx
- src/components/forms/ClienteForm.tsx
- src/lib/conciliacion/cliente-lookup.ts
- src/lib/conciliacion/motor-conciliacion.ts
- src/lib/schemas/clientes.schema.ts
- docs/diagrams/architecture.mmd
- docs/CHANGELOG.md
- ARCHITECTURE_SUMMARY.md

**Diagrama actualizado:** docs/diagrams/architecture.mmd
