---
name: erp-reparto
description: Optimiza logística last-mile, rutas GPS y gestión de repartidores. Usar al modificar módulo de Reparto/TMS.
---

# ERP Reparto (TMS)

Gestiona la complejidad de la logística de última milla.

## Reglas de Oro
1. **Routing Engine**: Usar `ors-directions.ts` con fallback ORS → Google → Local
2. **Vehicle Type**: Siempre `'driving-car'` (no `'car'`)
3. **Zonas**: Usar nombres unificados (ej. "Tafi del valle", no "Valles")
4. **RLS**: Verificar políticas INSERT en `rutas_reparto` y `detalles_ruta`

## Tablas Clave
- `rutas_reparto`: Cabecera de ruta
- `detalles_ruta`: Entregas individuales
- `ubicaciones_repartidores`: GPS tracking
- `preferencias_rutas_repartidor`: Zonas favoritas

## Componentes UI
- `NavigationInteractivo.tsx`: App conductor
- `MonitorMap.tsx`: Dashboard admin
- `RutaAlternativasSelector.tsx`: Selección de caminos

## Validaciones
- Cierre de hoja: Todos los pedidos con estado final
- GPS updates: Eficientes para no saturar Realtime
