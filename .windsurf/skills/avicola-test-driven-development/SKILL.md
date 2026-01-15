---
name: avicola-test-driven-development
description: Test-driven development for Avícola del Sur ERP. Server Actions testing, Supabase integration tests, RPC testing, FIFO stock validation, route optimization testing, reconciliation testing. Use when writing tests for critical modules.
---

# Avícola del Sur - Test Driven Development

Comprehensive testing guide for the Avícola del Sur ERP system with Server Actions, Supabase, and critical business logic.

## Stack de Testing

- **Framework**: Next.js 16 (App Router, Server Actions)
- **Testing**: Jest, React Testing Library
- **Database**: Supabase (PostgreSQL)
- **Backend**: Server Actions + RPCs
- **Critical Modules**: FIFO stock, route optimization, reconciliation

## When to Apply Tests

Always write tests for:
- **Critical business logic**: FIFO stock descuento, conciliación bancaria
- **Server Actions**: Crear presupuesto, asignar ruta, registrar cobro
- **RPCs PostgreSQL**: `fn_descontar_stock_fifo`, `fn_acreditar_saldo_cliente_v2`
- **Complex algorithms**: Optimización de rutas, matching de conciliación
- **GPS tracking**: Alertas de desvío, detección de cliente saltado
- **Vertex AI**: Tools del bot, parsing de extractos bancarios

## Test Structure

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── server-actions/
│   │   │   ├── crear-presupuesto.test.ts
│   │   │   ├── asignar-ruta.test.ts
│   │   │   └── registrar-cobro.test.ts
│   │   ├── utils/
│   │   │   ├── fifo.test.ts
│   │   │   ├── rutas.test.ts
│   │   │   └── conciliacion.test.ts
│   │   └── vertex/
│   │       ├── bot-tools.test.ts
│   │       └── gemini-matching.test.ts
│   ├── integration/
│   │   ├── supabase/
│   │   │   ├── rpcs.test.ts
│   │   │   └── rls.test.ts
│   │   └── flows/
│   │       ├── presupuesto-a-pedido.test.ts
│   │       └── conciliacion-completa.test.ts
│   └── e2e/
│       ├── reparto/
│       │   ├── gps-tracking.test.ts
│       │   └── navegacion.test.ts
│       └── bot/
│           └── whatsapp-commands.test.ts
└── test-utils/
    ├── supabase-mock.ts
    └── test-helpers.ts
```

## Unit Tests - Server Actions

### Test Structure

```typescript
// src/__tests__/unit/server-actions/crear-presupuesto.test.ts
import { crearPresupuestoAction } from '@/actions/crear-presupuesto';
import { mockSupabaseClient } from '@/test-utils/supabase-mock';

describe('crearPresupuestoAction', () => {
  beforeEach(() => {
    mockSupabaseClient.clear();
  });

  it('debería crear presupuesto con stock disponible', async () => {
    // Arrange
    const formData = new FormData();
    formData.append('cliente_id', 'uuid-cliente');
    formData.append('items', JSON.stringify([
      { producto_id: 'uuid-pollo', cantidad: 5 }
    ]));

    mockSupabaseClient.rpc.mockResolvedValue({
      data: { id: 'uuid-presupuesto', numero: 'PRES-20250115-0001' },
      error: null
    });

    // Act
    const result = await crearPresupuestoAction(formData);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.numero).toBe('PRES-20250115-0001');
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'fn_crear_presupuesto',
      expect.objectContaining({
        cliente_id: 'uuid-cliente',
        items: expect.arrayContaining([
          expect.objectContaining({ producto_id: 'uuid-pollo', cantidad: 5 })
        ])
      })
    );
  });

  it('debería fallar con stock insuficiente', async () => {
    // Arrange
    const formData = new FormData();
    formData.append('cliente_id', 'uuid-cliente');
    formData.append('items', JSON.stringify([
      { producto_id: 'uuid-pollo', cantidad: 100 } // Stock no disponible
    ]));

    mockSupabaseClient.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Stock insuficiente para producto POLLO001' }
    });

    // Act
    const result = await crearPresupuestoAction(formData);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('Stock insuficiente');
  });

  it('debería validar datos de entrada', async () => {
    // Arrange
    const formData = new FormData();
    formData.append('cliente_id', 'invalid-uuid'); // UUID inválido
    formData.append('items', JSON.stringify([])); // Items vacíos

    // Act & Assert
    await expect(crearPresupuestoAction(formData)).rejects.toThrow();
  });
});
```

## Unit Tests - FIFO Logic

```typescript
// src/__tests__/unit/utils/fifo.test.ts
import { descontarStockFIFO } from '@/lib/stock/fifo';

describe('descontarStockFIFO', () => {
  it('debería descontar del lote más antiguo primero', () => {
    // Arrange
    const lotes = [
      { id: 'lote-1', cantidad: 80, fecha_ingreso: '2025-01-10' },
      { id: 'lote-2', cantidad: 120, fecha_ingreso: '2025-01-15' }
    ];
    const cantidadADescontar = 50;

    // Act
    const resultado = descontarStockFIFO(lotes, cantidadADescontar);

    // Assert
    expect(resultado.lotesActualizados).toEqual([
      { id: 'lote-1', cantidad: 30, fecha_ingreso: '2025-01-10' }, // 80 - 50 = 30
      { id: 'lote-2', cantidad: 120, fecha_ingreso: '2025-01-15' }
    ]);
    expect(resultado.loteUsado).toBe('lote-1');
  });

  it('debería usar múltiples lotes si uno no alcanza', () => {
    // Arrange
    const lotes = [
      { id: 'lote-1', cantidad: 30, fecha_ingreso: '2025-01-10' },
      { id: 'lote-2', cantidad: 120, fecha_ingreso: '2025-01-15' }
    ];
    const cantidadADescontar = 50;

    // Act
    const resultado = descontarStockFIFO(lotes, cantidadADescontar);

    // Assert
    expect(resultado.lotesActualizados).toEqual([
      { id: 'lote-1', cantidad: 0, fecha_ingreso: '2025-01-10' }, // 30 - 30 = 0
      { id: 'lote-2', cantidad: 100, fecha_ingreso: '2025-01-15' } // 120 - 20 = 100
    ]);
    expect(resultado.lotesUsados).toEqual(['lote-1', 'lote-2']);
  });

  it('debería fallar si no hay stock suficiente', () => {
    // Arrange
    const lotes = [
      { id: 'lote-1', cantidad: 30, fecha_ingreso: '2025-01-10' }
    ];
    const cantidadADescontar = 50;

    // Act & Assert
    expect(() => descontarStockFIFO(lotes, cantidadADescontar)).toThrow('Stock insuficiente');
  });
});
```

## Unit Tests - Route Optimization

```typescript
// src/__tests__/unit/utils/rutas.test.ts
import { optimizarRutaORS } from '@/lib/rutas/ors-optimizer';
import { optimizarRutaLocal } from '@/lib/rutas/local-optimizer';

describe('optimizarRutaORS', () => {
  it('debería optimizar ruta con OpenRouteService', async () => {
    // Arrange
    const clientes = [
      { id: 'c1', coordenadas: [-65.0, -26.0] },
      { id: 'c2', coordenadas: [-65.1, -26.1] },
      { id: 'c3', coordenadas: [-65.2, -26.2] }
    ];

    // Act
    const resultado = await optimizarRutaORS(clientes);

    // Assert
    expect(resultado.ordenVisita).toBeDefined();
    expect(resultado.ordenVisita).toHaveLength(3);
    expect(resultado.distanciaTotal).toBeGreaterThan(0);
    expect(resultado.polyline).toBeDefined();
  });

  it('debería hacer fallback a optimización local si ORS falla', async () => {
    // Arrange
    const clientes = [
      { id: 'c1', coordenadas: [-65.0, -26.0] },
      { id: 'c2', coordenadas: [-65.1, -26.1] }
    ];

    // Mock ORS failure
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ORS error'));

    // Act
    const resultado = await optimizarRutaORS(clientes);

    // Assert
    expect(resultado.ordenVisita).toBeDefined();
    expect(resultado.fallback).toBe('local');
  });
});

describe('optimizarRutaLocal', () => {
  it('debería optimizar con Nearest Neighbor + 2-opt', () => {
    // Arrange
    const clientes = [
      { id: 'c1', coordenadas: [-65.0, -26.0] },
      { id: 'c2', coordenadas: [-65.1, -26.1] },
      { id: 'c3', coordenadas: [-65.2, -26.2] }
    ];
    const puntoPartida = [-65.0, -26.0];

    // Act
    const resultado = optimizarRutaLocal(clientes, puntoPartida);

    // Assert
    expect(resultado.ordenVisita).toBeDefined();
    expect(resultado.ordenVisita).toHaveLength(3);
    expect(resultado.distanciaTotal).toBeGreaterThan(0);
  });
});
```

## Integration Tests - Supabase RPCs

```typescript
// src/__tests__/integration/supabase/rpcs.test.ts
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseServiceKey } from '@/lib/supabase/config';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

describe('Supabase RPCs', () => {
  beforeAll(async () => {
    // Setup: Crear datos de prueba
    await supabase.from('productos').insert({
      codigo: 'POLLO001',
      nombre: 'Pollo Entero',
      precio_venta: 5000
    });
  });

  afterAll(async () => {
    // Cleanup: Eliminar datos de prueba
    await supabase.from('productos').delete().eq('codigo', 'POLLO001');
  });

  describe('fn_descontar_stock_fifo', () => {
    it('debería descontar stock FIFO correctamente', async () => {
      // Arrange
      const loteId = await crearLoteDePrueba();
      const cantidad = 10;

      // Act
      const { data, error } = await supabase.rpc('fn_descontar_stock_fifo', {
        p_producto_id: 'uuid-producto',
        p_cantidad: cantidad
      });

      // Assert
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.lote_usado).toBe(loteId);
    });

    it('debería fallar si no hay stock suficiente', async () => {
      // Act
      const { data, error } = await supabase.rpc('fn_descontar_stock_fifo', {
        p_producto_id: 'uuid-producto',
        p_cantidad: 99999 // Cantidad excesiva
      });

      // Assert
      expect(error).not.toBeNull();
      expect(error.message).toContain('Stock insuficiente');
    });
  });

  describe('fn_acreditar_saldo_cliente_v2', () => {
    it('debería acreditar saldo en cuenta corriente y caja', async () => {
      // Arrange
      const clienteId = await crearClienteDePrueba();
      const monto = 1000;

      // Act
      const { data, error } = await supabase.rpc('fn_acreditar_saldo_cliente_v2', {
        p_cliente_id: clienteId,
        p_monto: monto,
        p_caja_id: 'uuid-caja',
        p_usuario_id: 'uuid-usuario'
      });

      // Assert
      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verificar saldo actualizado
      const { data: cliente } = await supabase
        .from('clientes')
        .select('saldo_actual')
        .eq('id', clienteId)
        .single();

      expect(cliente.saldo_actual).toBe(monto);
    });
  });
});
```

## Integration Tests - Complete Flows

```typescript
// src/__tests__/integration/flows/presupuesto-a-pedido.test.ts
import { crearPresupuestoAction } from '@/actions/crear-presupuesto';
import { convertirPresupuestoAPedidoAction } from '@/actions/convertir-presupuesto';
import { asignarPedidoARutaAction } from '@/actions/asignar-ruta';

describe('Flujo: Presupuesto → Pedido → Ruta', () => {
  it('debería completar el flujo completo', async () => {
    // Step 1: Crear presupuesto
    const presupuestoFormData = new FormData();
    presupuestoFormData.append('cliente_id', 'uuid-cliente');
    presupuestoFormData.append('items', JSON.stringify([
      { producto_id: 'uuid-pollo', cantidad: 5 }
    ]));

    const presupuestoResult = await crearPresupuestoAction(presupuestoFormData);
    expect(presupuestoResult.success).toBe(true);

    // Step 2: Convertir a pedido
    const pedidoResult = await convertirPresupuestoAPedidoAction({
      presupuestoId: presupuestoResult.data.id,
      usuarioId: 'uuid-usuario'
    });
    expect(pedidoResult.success).toBe(true);

    // Step 3: Asignar a ruta
    const rutaResult = await asignarPedidoARutaAction({
      pedidoId: pedidoResult.data.id,
      usuarioId: 'uuid-usuario'
    });
    expect(rutaResult.success).toBe(true);

    // Verify: Pedido asignado a ruta correcta
    expect(rutaResult.data.ruta_id).toBeDefined();
  });
});
```

## E2E Tests - GPS Tracking

```typescript
// src/__tests__/e2e/reparto/gps-tracking.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import { MonitorPage } from '@/app/reparto/monitor/page';

describe('GPS Tracking E2E', () => {
  it('debería mostrar ubicaciones en tiempo real', async () => {
    // Arrange
    render(<MonitorPage />);

    // Act: Simular actualización de GPS
    const ubicacion = {
      repartidor_id: 'uuid-repartidor',
      latitud: -26.0,
      longitud: -65.0,
      timestamp: new Date().toISOString()
    };

    await fetch('/api/reparto/ubicacion', {
      method: 'POST',
      body: JSON.stringify(ubicacion)
    });

    // Assert
    await waitFor(() => {
      const marker = screen.getByTestId(`marker-${ubicacion.repartidor_id}`);
      expect(marker).toBeInTheDocument();
    });
  });

  it('debería mostrar alerta de desvío > 200m', async () => {
    // Arrange
    render(<MonitorPage />);

    // Act: Simular desvío
    const ubicacionDesviada = {
      repartidor_id: 'uuid-repartidor',
      latitud: -26.1, // 11km de desvío
      longitud: -65.1,
      timestamp: new Date().toISOString()
    };

    await fetch('/api/reparto/ubicacion', {
      method: 'POST',
      body: JSON.stringify(ubicacionDesviada)
    });

    // Assert
    await waitFor(() => {
      const alerta = screen.getByText(/desvío/i);
      expect(alerta).toBeInTheDocument();
    });
  });
});
```

## Test Utilities

```typescript
// src/test-utils/supabase-mock.ts
export const mockSupabaseClient = {
  rpc: jest.fn(),
  from: jest.fn(),
  clear: () => {
    mockSupabaseClient.rpc.mockClear();
    mockSupabaseClient.from.mockClear();
  }
};

// src/test-utils/test-helpers.ts
export async function crearLoteDePrueba() {
  const { data } = await supabase.from('lotes').insert({
    numero_lote: 'LOTE-TEST',
    producto_id: 'uuid-producto',
    cantidad_ingresada: 100,
    cantidad_disponible: 100,
    fecha_ingreso: new Date().toISOString().split('T')[0]
  }).select().single();

  return data.id;
}

export async function crearClienteDePrueba() {
  const { data } = await supabase.from('clientes').insert({
    nombre: 'Cliente Test',
    telefono: '123456789',
    zona_entrega: 'Zona Norte'
  }).select().single();

  return data.id;
}
```

## Running Tests

```bash
# Unit tests
npm test

# Unit tests con coverage
npm test -- --coverage

# Integration tests
npm test -- --testPathPattern=integration

# E2E tests
npm test -- --testPathPattern=e2e

# Tests específicos
npm test -- crear-presupuesto.test.ts

# Watch mode
npm test -- --watch
```

## Test Coverage Goals

- **Critical modules**: 90%+ coverage
  - FIFO stock descuento
  - Conciliación bancaria
  - Optimización de rutas
  - Server Actions

- **Important modules**: 80%+ coverage
  - GPS tracking
  - Bot WhatsApp
  - Vertex AI tools

- **General modules**: 70%+ coverage
  - UI components
  - Formularios
  - Tablas

## Anti-Patterns to Avoid

❌ Testing implementation details instead of behavior
❌ Mocking everything (test real integration with Supabase)
❌ Skipping tests for "it's just a simple function"
❌ Tests that depend on external state
❌ Not testing error cases
❌ Tests that are too slow (> 5s per test)

## Quick Reference

| Module | Test Type | Key Assertions |
|--------|-----------|----------------|
| Server Actions | Unit | Success/error responses, revalidatePath |
| FIFO Logic | Unit | Lote ordering, stock calculations |
| RPCs | Integration | Database state, transaction atomicity |
| Flows | Integration | End-to-end business logic |
| GPS | E2E | Real-time updates, alerts |

## Related Skills

- **erp-produccion-stock** - FIFO testing patterns
- **erp-reparto** - GPS tracking tests
- **erp-tesoreria** - Reconciliation tests
- **systematic-debugging** - Debugging test failures
