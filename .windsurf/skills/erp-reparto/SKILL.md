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

## Debugging GPS Tracking

### Symptom: Ubicaciones no se actualizan

**Check 1: PWA está enviando datos**
```typescript
// En la PWA del repartidor
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const ubicacion = {
      repartidor_id: repartidorId,
      latitud: position.coords.latitude,
      longitud: position.coords.longitude,
      timestamp: new Date().toISOString()
    };

    fetch('/api/reparto/ubicacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ubicacion)
    });
  },
  (error) => console.error('GPS error:', error),
  { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
);
```

**Check 2: API endpoint recibe datos**
```typescript
// src/app/api/reparto/ubicacion/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  console.log('[GPS] Ubicación recibida:', body);

  const { repartidor_id, latitud, longitud, timestamp } = body;

  if (!repartidor_id || !latitud || !longitud) {
    return Response.json({ error: 'Campos faltantes' }, { status: 400 });
  }

  const { error } = await supabase.from('ubicaciones_repartidores').insert({
    repartidor_id,
    latitud,
    longitud,
    timestamp
  });

  if (error) {
    console.error('[GPS] Error insertando:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

**Check 3: Realtime subscription funciona**
```typescript
// En MonitorMap.tsx
useEffect(() => {
  const channel = supabase
    .channel('ubicaciones-repartidores')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'ubicaciones_repartidores'
    }, (payload) => {
      console.log('[Monitor] Ubicación recibida:', payload.new);
      setUbicaciones(prev => {
        const existing = prev.findIndex(u => u.repartidor_id === payload.new.repartidor_id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = payload.new;
          return updated;
        }
        return [...prev, payload.new];
      });
    })
    .subscribe((status) => {
      console.log('[Monitor] Subscription status:', status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## Debugging Route Optimization

### Symptom: Rutas no se optimizan correctamente

**Check 1: OpenRouteService API key válida**
```typescript
// src/lib/rutas/ors-directions.ts
const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY;
console.log('[ORS] API Key:', ORS_API_KEY ? 'Configurada' : 'NO CONFIGURADA');

if (!ORS_API_KEY) {
  console.error('[ORS] API key no configurada');
  throw new Error('OpenRouteService API key no configurada');
}
```

**Check 2: Coordenadas en formato correcto**
```typescript
// ORS espera [longitud, latitud]
const coordenadas = clientes.map(c => {
  console.log('[ORS] Cliente:', c.id, 'Lat:', c.latitud, 'Lng:', c.longitud);
  return [c.longitud, c.latitud]; // IMPORTANTE: lng primero
});

// Verificar coordenadas válidas
const invalidCoords = coordenadas.filter(([lng, lat]) =>
  isNaN(lng) || isNaN(lat) ||
  lng < -180 || lng > 180 ||
  lat < -90 || lat > 90
);

if (invalidCoords.length > 0) {
  console.error('[ORS] Coordenadas inválidas:', invalidCoords);
}
```

**Check 3: Fallback a optimización local**
```typescript
const response = await fetch(ORS_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': ORS_API_KEY
  },
  body: JSON.stringify({
    coordinates: coordenadas,
    profile: 'driving-car'
  })
});

const data = await response.json();

if (data.error || !data.routes) {
  console.log('[ORS] Error, usando fallback local');
  return optimizarRutaLocal(clientes, puntoPartida);
}
```

## Debugging Navegación Interactiva

### Symptom: Instrucciones no se muestran

**Check 1: Polyline es válida**
```typescript
console.log('[Nav] Polyline:', polyline);
console.log('[Nav] Longitud:', polyline?.length);

if (!polyline || polyline.length === 0) {
  console.error('[Nav] Polyline inválida');
  return;
}
```

**Check 2: Google Maps está cargado**
```typescript
// En NavigationView.tsx
useEffect(() => {
  const checkMaps = setInterval(() => {
    if (window.google && window.google.maps) {
      console.log('[Nav] Google Maps cargado');
      clearInterval(checkMaps);
      inicializarMapa();
    }
  }, 100);

  return () => clearInterval(checkMaps);
}, []);
```

## Optimización de Queries

### Index para GPS tracking
```sql
-- Índice para consultas de ubicaciones recientes
CREATE INDEX idx_ubicaciones_repartidor_timestamp
ON ubicaciones_repartidores(repartidor_id, created_at DESC);

-- Índice para consultas por zona
CREATE INDEX idx_rutas_zona_fecha
ON rutas_reparto(zona_entrega, fecha_ruta DESC);
```

### Batch insert para ubicaciones
```typescript
// En lugar de insertar una por una
for (const ubicacion of ubicaciones) {
  await supabase.from('ubicaciones_repartidores').insert(ubicacion);
}

// Usar batch insert
await supabase.from('ubicaciones_repartidores').insert(ubicaciones);
```

## Alertas de Desvío

### Lógica de detección
```typescript
const calcularDistancia = (p1: [number, number], p2: [number, number]): number => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (p2[0] - p1[0]) * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Metros
};

const detectarDesvio = (ubicacionActual: Ubicacion, ubicacionEsperada: Ubicacion): boolean => {
  const distancia = calcularDistancia(
    [ubicacionActual.latitud, ubicacionActual.longitud],
    [ubicacionEsperada.latitud, ubicacionEsperada.longitud]
  );

  console.log('[Alert] Distancia:', distancia, 'metros');
  return distancia > 200; // 200 metros de tolerancia
};
```

## Related Skills
- **avicola-systematic-debugging** - Debugging GPS y rutas
- **avicola-mcp-builder** - MCP para Google Maps y ORS
