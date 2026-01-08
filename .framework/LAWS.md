# 📜 Leyes del Framework - Avícola del Sur

Este documento define las reglas inamovibles de arquitectura, diseño y comportamiento para cualquier IA que trabaje en este proyecto.

## 1. Arquitectura Base
- **Single Source of Truth**: Supabase es la única fuente de verdad. No se permite almacenamiento local persistente fuera de la DB central.
- **Server-Side First**: Toda lógica crítica de negocio DEBE residir en Server Actions o funciones RPC de Postgres.
- **Atomicidad**: Las operaciones que afecten múltiples tablas (ej: pedidos + stock + caja) DEBEN realizarse mediante funciones RPC para garantizar integridad.

## 2. Desarrollo de UI/UX
- **Estética Premium**: Seguir los principios de diseño moderno (glassmorphism, gradientes sutiles, micro-animaciones). No crear MVPs simples.
- **Componentización**: Usar shadcn/ui y componentes atómicos. Evitar duplicar lógica de UI.
- **Responsividad**: Todo el sistema debe ser Mobile-First, especialmente el módulo de Reparto.

## 3. Manejo de Datos
- **Seguridad (RLS)**: Nunca deshabilitar RLS. Siempre verificar que las políticas cubran los nuevos casos de uso.
- **FIFO Obligatorio**: El descuento de stock siempre debe seguir la lógica First-In, First-Out (FIFO) basada en lotes.
- **Validación Estricta**: Usar Zod para validaciones tanto en cliente como en servidor.

## 4. IA y Automatización
- **Modelos Estandarizados**: 
    - `gemini-2.5-flash` para tareas rápidas y clasificaciones.
    - `gemini-3-pro` para análisis complejos y reportes.
- **Transparencia**: El usuario siempre debe saber cuándo una acción fue sugerida o realizada por IA (badge "🤖 Google AI").

## 5. Documentación
- **Actualización Continua**: Al finalizar cualquier cambio significativo, se DEBE actualizar `ARCHITECTURE_SUMMARY.md` y `README.md`.
- **Registro de Decisiones**: Las decisiones críticas de diseño deben registrarse en `.context/MEMORY.md`.
