# Plan de Actualización Documentación Técnica
Este plan resume cómo sincronizaremos README.md, ARCHITECTURE.MD y ARCHITECTURE_SUMMARY.md con el estado real del ERP (enero 2026) manteniendo consistencia narrativa y técnica.

## Objetivos Clave
- Consolidar mensajes: mismo estado operativo, alcance funcional y diferenciadores de IA en los tres documentos.
- Clarificar onboarding técnico: prerequisitos, configuración de entorno/Supabase y pautas de despliegue.
- Documentar arquitectura actual: módulos, flujos críticos, patrones y dependencias externas con trazabilidad a código.

## Alcance por Documento
### README.md
1. Actualizar encabezado (versión, estado, resumen ejecutivo) alineado con funcionalidades recientes.
2. Ampliar "Inicio Rápido": prerequisitos detallados, setup de Supabase, variables de entorno críticas y comandos de calidad (lint/test/build).
3. Añadir secciones compactas de "Arquitectura" y "Módulos" que enlacen a documentos profundos, más tabla de scripts útiles.
4. Incorporar guía de troubleshooting breve (puertos, claves Google, webhooks WhatsApp) para reducir soporte repetido.

### ARCHITECTURE.MD
1. Reestructurar índice para cubrir: stack, módulos, flujos, patrones transversales (RLS, Server Actions, IA, Realtime) y anexos.
2. Actualizar descripciones de IA (Gemini 2.5/3.0, Maps, Predictions) y explicar fallback locales (2-opt, heurísticas) con referencias a archivos clave.
3. Expandir flujos críticos (Planificación semanal, Conversión presupuesto→pedido, GPS, Conciliación, POS, Conteos) asegurando inputs/outputs, tablas y server actions involucradas.
4. Añadir sección de "Gobernanza y Seguridad" (RLS, RBAC, auditorías) y "Observabilidad" (logs, monitoreo) si aplica.

### ARCHITECTURE_SUMMARY.md
1. Mantener formato estilo executive briefing pero refrescar cifras, features 2.0 y tablas de servicios/IA.
2. Verificar que cada módulo referencie acciones, modelos y componentes reales (nombres actualizados en src/).
3. Incluir changelog compacto (últimos 5 hitos) alineado con roadmap enero 2026.
4. Agregar enlaces cruzados hacia secciones relevantes de ARCHITECTURE.MD y README.md para navegación rápida.

## Fuentes de Verificación
- Código fuente (`src/actions`, `src/lib`, `src/app`), archivos Supabase (migraciones/RPC), `SUPABASE_SETUP.md`.
- Historias recientes (commits/documentos internos) para confirmar features desplegadas (ej. Planificación semanal, Conciliación IA, POS sucursal).

## Riesgos y Consideraciones
- Inconsistencias en nombres de acciones/tablas podrían generar documentación desactualizada; validar contra exports actuales.
- Información sensible (claves, endpoints internos) no debe exponerse; usar placeholders donde sea necesario.
- Asegurar coherencia terminológica (ej. "Gemini 2.5 Flash" vs "Gemini Flash 2.5").

## Próximos Pasos
1. Leer versiones vigentes de los tres documentos y anotar divergencias vs estado real (checklist compartida).
2. Redactar borradores actualizados (README → SUMMARY → ARCHITECTURE) validando cross-links y tablas.
3. Revisar consistencia global (términos, emojis, tono), pasar corrector y preparar PR/changelog correspondiente.
