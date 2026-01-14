# Plan de Migración a GraphHopper para Routing

Este plan implementa GraphHopper como alternativa a Google Maps Directions API para resolver el problema de rutas incorrectas por sentidos únicos en el sistema de reparto de Avícola del Sur.

## Objetivo

Reemplazar Google Maps Directions API con GraphHopper en todos los componentes de routing (Monitor GPS, NavigationView, NavigationInteractivo) para garantizar que las rutas respeten correctamente las restricciones de sentido único.

## Fase 1: Configuración e Infraestructura

### 1.1 Crear cuenta en GraphHopper
- Registrarse en https://graphhopper.com/
- Obtener API Key gratuita (1 vehículo para pruebas limitadas)
- Para producción con múltiples vehículos: Plan pago desde €60/mes (2 vehículos, escalable)
- Documentar API Key en `.env.local`

### 1.2 Configurar variables de entorno
```bash
# .env.local
GRAPHHOPPER_API_KEY=tu_api_key_aqui
GRAPHHOPPER_ENABLED=true
GRAPHHOPPER_FALLBACK_TO_GOOGLE=true  # Usar Google como fallback inicialmente
```

### 1.3 Crear wrapper de GraphHopper
- Crear `src/lib/rutas/graphhopper-directions.ts`
- Implementar interfaz compatible con `GoogleDirectionsResponse`
- Implementar conversión de respuesta GraphHopper → formato Google
- Soportar rutas alternativas, waypoints, optimización

## Fase 2: Implementación en Componentes

### 2.1 Modificar MonitorMap.tsx
- **Archivo**: `src/components/reparto/MonitorMap.tsx`
- **Cambios**:
  - Línea 754-813: Reemplazar `window.google.maps.DirectionsService` con GraphHopper
  - Agregar import de `getGraphHopperDirections`
  - Mantener fallback a Google si GraphHopper falla
  - Actualizar logs para identificar cuál servicio se está usando

### 2.2 Modificar NavigationView.tsx
- **Archivo**: `src/components/reparto/NavigationView.tsx`
- **Cambios**:
  - Línea 345-359: Reemplazar `directionsService.route()` con GraphHopper
  - Actualizar función `calculateRoute` para usar GraphHopper
  - Mantener fallback a Google si GraphHopper falla
  - Verificar que polyline se decodifique correctamente

### 2.3 Modificar NavigationInteractivo.tsx
- **Archivo**: `src/components/reparto/NavigationInteractivo.tsx`
- **Cambios**:
  - Línea 158-164: Actualizar `/api/rutas/alternativas` para usar GraphHopper
  - Verificar que rutas alternativas funcionen correctamente
  - Mantener lógica de preferencias del repartidor

### 2.4 Actualizar API endpoint `/api/rutas/alternativas`
- Crear o modificar `src/app/api/rutas/alternativas/route.ts`
- Implementar lógica de fallback: GraphHopper → Google → local-optimizer
- Agregar logs para debugging

## Fase 3: Pruebas y Validación

### 3.1 Pruebas unitarias
- Verificar que `graphhopper-directions.ts` devuelve formato correcto
- Probar conversión de polylines
- Validar manejo de errores

### 3.2 Pruebas de integración
- Probar Monitor GPS con rutas existentes
- Probar NavigationView con navegación en tiempo real
- Probar NavigationInteractivo con rutas alternativas

### 3.3 Comparación de rutas
- Ejecutar 10-20 rutas reales con GraphHopper
- Comparar con rutas actuales de Google Maps
- Verificar que GraphHopper respeta sentidos únicos donde Google falla
- Documentar diferencias

## Fase 4: Decisión y Rollout

### 4.1 Evaluación (1-2 semanas)
- Monitorear calidad de rutas en producción
- Recopilar feedback de repartidores
- Comparar métricas: tiempo de viaje, distancia, quejas

### 4.2 Opciones de rollout
**Opción A**: Migración completa (si GraphHopper funciona mejor)
- Desactivar fallback a Google
- Eliminar código de Google Directions

**Opción B**: Self-hosting GraphHopper (si necesitas más control)
- Instalar GraphHopper en servidor propio
- Importar datos de OpenStreetMap de Argentina
- Configurar custom profiles para camiones

**Opción C**: Mantener híbrido (si ambos tienen fortalezas)
- Usar GraphHopper para rutas con problemas conocidos
- Usar Google para rutas donde funciona bien

## Archivos a Modificar

| Archivo | Tipo de cambio | Prioridad |
|---------|---------------|-----------|
| `src/lib/rutas/graphhopper-directions.ts` | Nuevo archivo | Alta |
| `.env.local` | Agregar variables | Alta |
| `src/components/reparto/MonitorMap.tsx` | Modificar | Alta |
| `src/components/reparto/NavigationView.tsx` | Modificar | Alta |
| `src/components/reparto/NavigationInteractivo.tsx` | Modificar | Alta |
| `src/app/api/rutas/alternativas/route.ts` | Crear/Modificar | Alta |
| `src/lib/rutas/google-directions.ts` | Actualizar (fallback) | Media |

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| GraphHopper no cubre bien zonas rurales | Alto | Mantener fallback a Google |
| API Key gratuita se agota | Medio | Implementar rate limiting, considerar plan pago |
| Cambios en formato de respuesta | Medio | Tests unitarios robustos |
| Repartidores no se adaptan a nuevas rutas | Bajo | Comunicación previa, periodo de adaptación |

## Cronograma Estimado

- **Fase 1**: 1 día
- **Fase 2**: 2-3 días
- **Fase 3**: 3-5 días
- **Fase 4**: 1-2 semanas (evaluación)

**Total**: 2-3 semanas hasta decisión final

## Métricas de Éxito

1. **Reducción de quejas** por rutas incorrectas (sentido contrario)
2. **Mejora en tiempos de entrega** (rutas más eficientes)
3. **Tiempo de corrección** de errores en rutas (de meses a días/semanas)
4. **Satisfacción del repartidor** con navegación
