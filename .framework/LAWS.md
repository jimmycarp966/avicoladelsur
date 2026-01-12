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
- **Mapas**: Google Maps Oficial es el ÚNICO proveedor de mapas permitido. No usar Leaflet ni otras librerías.

## 3. Manejo de Datos
- **Seguridad (RLS)**: Nunca deshabilitar RLS. Siempre verificar que las políticas cubran los nuevos casos de uso.
- **FIFO Obligatorio**: El descuento de stock siempre debe seguir la lógica First-In, First-Out (FIFO) basada en lotes.
- **Validación Estricta**: Usar Zod para validaciones tanto en cliente como en servidor.

## 4. IA y Automatización
- **Modelos Estandarizados**: 
    - `gemini-2.5-flash` para tareas rápidas y clasificaciones.
    - `gemini-3-pro` para análisis complejos y reportes.
- **Transparencia**: El usuario siempre debe saber cuándo una acción fue sugerida o realizada por IA (badge "🤖 Google AI").

## 5. Excepciones y Deuda Técnica (Known Issues)
- **TypeScript Build**: Se permite `ignoreBuildErrors: true` en `next.config.ts` debido a incompatibilidad temporal entre Zod v4 y librerías de formularios. NO intentar "arreglar" esto sin autorización explícita.
- **Versiones Core**: 
    - Next.js 16+ (Canary/Beta)
    - Tailwind CSS v4.0 (PostCSS)
    - React 19 (RC)

## 6. Documentación
- **Actualización Continua**: Al finalizar cualquier cambio significativo, se DEBE actualizar `ARCHITECTURE_SUMMARY.md` y `README.md`.
- **Registro de Decisiones**: Las decisiones críticas de diseño deben registrarse en `.context/MEMORY.md`.

## 7. Metodología de Debugging (Obligatoria)
Cuando se encuentre un problema, **NO hacer cambios drásticos sin diagnóstico previo**:
1. **Leer código relevante** y entender cómo funciona.
2. **Formular 5-7 hipótesis** sobre la causa raíz.
3. **Seleccionar las 2 más probables** y consultar al usuario.
4. **Agregar logs mínimos** para confirmar la hipótesis (no saturar con logs).
5. **Solo aplicar fix** cuando la causa raíz esté demostrada por logs.
6. **Probar con logs activos**, si funciona → limpiar logs → declarar resuelto.

## 8. Plan de Respuesta (Antes de Codear)
Antes de escribir código, proporcionar este plan en lenguaje sencillo:
1. **¿Qué vamos a hacer?** - Una frase clara sobre la tarea.
2. **¿Cómo funcionará?** - Resumen paso a paso.
3. **¿Qué podría salir mal?** - 1-2 riesgos y cómo evitarlos.
4. **¿Cómo lo probamos?** - 3 pasos simples de verificación.

> **Excepción**: Tareas triviales (renombrar, mover código) no requieren plan completo.
