# Última Actualización - 2026-01-14

## Fecha y Hora
2026-01-14 15:32:00 -03:00

## Archivos Modificados
- `src/lib/rutas/ors-directions.ts` - Funciones `optimizeRouteORS()` y `getOptimizedRoute()`
- `src/components/reparto/MonitorMap.tsx` - Sincronización de orden optimizado con marcadores

## Archivos Nuevos (no trackeados)
- `.agent/skills/` - Skills de desarrollo

## Resumen Técnico
Se integró OpenRouteService (ORS) Optimization API para calcular el orden óptimo de visitas en las rutas de reparto. El sistema ahora usa el algoritmo VROOM (TSP solver) que considera calles reales de OpenStreetMap, incluyendo sentidos de calle editados por el usuario. Los marcadores del mapa ahora reflejan el orden de visita optimizado.

Impacto: Mejora en eficiencia de rutas (menos distancia, menos tiempo). Sin cambios en DB schema.

## Diagrama
N/A (sin cambios arquitecturales mayores)

## Checklist
- [x] `ARCHITECTURE_SUMMARY.md` actualizado (sección Cambio reciente + Features 2.0)
- [x] `docs/CHANGELOG.md` con nueva línea
- [x] `docs/last_update.md` con evidencia
- [ ] Commit y push pendientes
