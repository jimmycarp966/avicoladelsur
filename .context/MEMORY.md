# 🧠 Memoria de Sesiones - Avícola del Sur

Este documento registra la evolución del sistema, decisiones críticas y lecciones aprendidas.

## 📅 Enero 2026

### Sesión: Fix Conversión Mayorista Pesable (Hotfix)
- **Fecha**: 2026-01-12
- **Problema**: Items pesables para clientes mayoristas aplicaban incorrectamente conversión por bulto (1 caja = 10kg) ignorando el peso real de balanza.
- **Solución**: Se ajustó `fn_convertir_presupuesto_a_pedido` para priorizar siempre `peso_final` si el item es pesable, independientemente de la lista de precios.
- **Aprendizaje**: La lógica de "Venta Mayorista" no debe anular la propiedad física de "Pesable". El peso real tiene prelación sobre la conversión teórica.


### Sesión: Implementación Athena Framework
- **Fecha**: 2026-01-08
- **Decisión**: Se adoptó la estructura de Athena (`.framework`, `.context`, `.agent`) para mejorar la persistencia del contexto del agente.
- **Resultado**: Estructura base creada. Flujos `/start` y `/end` definidos.
- **Aprendizaje**: La integración de un framework de conocimiento mejora la coherencia en proyectos grandes como este ERP.

### Sesión: Alias Bancarios y Conciliación
- **Fecha**: 2026-01-08
- **Log**: Se implementó la lógica para asociar múltiples documentos (DNI/Alias) a un solo cliente para facilitar la conciliación bancaria.
- **Estado**: Funcional.

### Sesión: Sistema de Contexto Automático (Antigravity)
- **Fecha**: 2026-01-10
- **Decisión**: Se implementó `GEMINI.md` como fuente automática de contexto, siguiendo mejores prácticas de Vibecoding.
- **Cambio**: Se crearon workflows `/remember` y `/end` mejorados. Se configuró `start.md` con frontmatter.
- **Impacto**: El agente ahora carga el contexto del proyecto automáticamente al iniciar, reduciendo alucinaciones y pérdida de contexto.

### Sesión: Auditoría de Reglas y Limpieza
- **Fecha**: 2026-01-10
- **Auditoría**: Se detectó discrepancia entre `LAWS.md` y código real (Next.js 16 vs 15, Tailwind v4).
- **Acción**: Se actualizó `LAWS.md` reflejando el stack real y la excepción de `ignoreBuildErrors`.
- **Limpieza**: Se eliminaron dependencias prohibidas (`leaflet`, `react-leaflet`) para forzar el uso de Google Maps según reglas.

### Sesión: Fusión de Metodologías de Trabajo
- **Fecha**: 2026-01-10
- **Decisión**: Se integraron nuevas reglas al framework basadas en mejores prácticas de desarrollo.
- **Nuevas reglas**:
  - §7: Metodología de Debugging con hipótesis (5-7 hipótesis → logs → fix → limpieza)
  - §8: Plan de Respuesta obligatorio antes de codear (qué, cómo, riesgos, pruebas)
- **Impacto**: Mayor rigor en resolución de problemas y comunicación clara antes de implementar.

---
*Para ver la arquitectura técnica completa, consultar `ARCHITECTURE_SUMMARY.md`.*

### Sesión: Remediación de Montos en Conciliación
- **Fecha**: 2026-01-11
- **Problema**: Montos aparecían como 0 en el historial y los metadatos de Gemini (errores/notas) se desincronizaban al procesar lotes.
- **Cambios realizados**:
  - `src/lib/conciliacion/parsers.ts`: Implementada función `limpiarMonto()` con lógica robusta para manejar puntos y comas regionales ($ 14.000,00).
  - `src/actions/conciliacion.actions.ts`: Eliminación de dependencia de índices de array; ahora se usa `archivo_origen` para vincular datos.
  - `src/lib/conciliacion/acreditacion.ts`: Migración de acreditación a función RPC SQL atómica (`fn_acreditar_saldo_cliente_v2`) que gestiona CC y Caja en una sola transacción.
- **Aprendizaje**: Normalizar tipos de datos monetarios en el servidor y delegar la atomicidad financiera a la base de datos (RPC) para evitar race conditions.

### Sesión: Auditoría Completa del Sistema
- **Fecha**: 2026-01-10
- **Análisis**: Revisión de 32 Server Actions, 7 módulos, 102+ migraciones.
- **Hallazgos**: 15 Server Actions no documentados, módulo Sucursales sin sección propia.
- **Cambios realizados**:
  - `ARCHITECTURE_SUMMARY.md`: Nueva sección §6 Sucursales & POS, Tesorería expandida con Proveedores/Gastos.
  - Sección "Cambios Recientes" convertida a lista acumulativa (máximo 5, FIFO).
  - Workflow `/actualizar` mejorado con reglas de acumulación.
- **Impacto**: Documentación ahora refleja mejor el estado real del código.
