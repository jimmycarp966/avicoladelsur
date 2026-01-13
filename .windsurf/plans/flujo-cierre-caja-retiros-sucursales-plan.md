# Plan: Flujo de Cierre de Caja y Retiros de Sucursales

Implementar el flujo completo donde el cierre de caja de sucursales genera automáticamente retiros para casa central, con validación por choferes y visualización en tiempo real.

## Resumen del Flujo

1. **Cierre de Caja:** Sucursales cierran caja manteniendo $50,000, el excedente se convierte en retiro
2. **Arqueo de Caja:** Al cerrar, se realiza arqueo con denominaciones de billetes argentinos
3. **Retiro Automático:** Se crea registro en `rutas_retiros` con estado "pendiente"
4. **Validación Chofer:** Choferes ven retiros de su zona junto con las entregas de clientes
5. **Acreditación:** Al validar, se acredita en caja central (independiente del pedido)
6. **Visualización Tesorería:** Admin ve en "Validar Rutas":
   - **Bolsín del reparto:** Dinero que el chofer tenía al salir (para cambio, cobros)
   - **Bolsín de dinero (tesorería):** Dinero que el chofer trae de vuelta:
     - Sección 1: Dinero de clientes (cobros de pedidos)
     - Sección 2: Dinero de retiros de sucursales (con detalle de arqueo)
     - Total del bolsín de dinero (suma de ambas secciones)

**IMPORTANTE:** Los retiros están **vinculados visualmente** al pedido (el chofer los ve junto con las entregas) pero son **independientes** en la base de datos (NO se suman al `total_final` del pedido). Hay dos bolsines separados: el bolsín del reparto (dinero del chofer) y el bolsín de dinero tesorería (dinero que se trae a casa central).

## Pasos de Implementación

### 1. Base de Datos - Migraciones

#### 1.1 Agregar zona_id a sucursales
```sql
ALTER TABLE sucursales ADD COLUMN zona_id UUID REFERENCES zonas(id);
```

#### 1.2 Actualizar tabla rutas_retiros (si no existe)
```sql
CREATE TABLE IF NOT EXISTS rutas_retiros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID REFERENCES rutas_reparto(id),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id),
    vehiculo_id UUID REFERENCES vehiculos(id),
    monto NUMERIC(14,2) NOT NULL,
    chofer_nombre VARCHAR(255),
    descripcion TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'validado', 'cancelado')),
    movimiento_egreso_id UUID REFERENCES tesoreria_movimientos(id),
    movimiento_ingreso_id UUID REFERENCES tesoreria_movimientos(id),
    validado_por UUID REFERENCES usuarios(id),
    validado_at TIMESTAMPTZ,
    created_by UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.3 Crear tabla para arqueo de billetes
```sql
CREATE TABLE IF NOT EXISTS arqueo_billetes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cierre_caja_id UUID NOT NULL REFERENCES cierres_caja(id) ON DELETE CASCADE,
    denominacion NUMERIC(10,2) NOT NULL, -- 100, 200, 500, 1000, 2000, 10000, 20000
    cantidad INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(14,2) GENERATED ALWAYS AS (denominacion * cantidad) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.4 Agregar campos de arqueo a cierres_caja
```sql
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_esperado NUMERIC(14,2);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_real NUMERIC(14,2);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_diferencia NUMERIC(14,2);
ALTER TABLE cierres_caja ADD COLUMN IF NOT EXISTS arqueo_observaciones TEXT;
```

#### 1.5 Crear índices y RLS para nuevas tablas

### 2. Modificar Cierre de Caja

#### 2.1 Actualizar función `cerrarCierreCajaAction`
- Calcular monto de retiro: `saldo_final - 50,000`
- Si monto > 0, crear automáticamente retiro en `rutas_retiros`
- Obtener `zona_id` de la sucursal
- Crear movimiento de egreso en caja de sucursal
- Estado del retiro: "pendiente"
- **Agregar arqueo de billetes:**
  - Calcular `arqueo_esperado` = saldo_final
  - Recibir arqueo de billetes del usuario
  - Calcular `arqueo_real` = suma de billetes
  - Calcular `arqueo_diferencia` = arqueo_real - arqueo_esperado
  - Guardar detalle de billetes en `arqueo_billetes`

#### 2.2 Eliminar lógica de `retiro_tesoro` del cierre
- `retiro_tesoro` es para otra cosa (tesorería → tesoro)
- No se debe usar en cierre de caja de sucursales

### 3. Sistema de Arqueo de Billetes

#### 3.1 Componente `ArqueoBilletesForm`
- Mostrar monto esperado en efectivo
- Formulario para ingresar cantidad de cada denominación:
  - $100: [cantidad] = $subtotal
  - $200: [cantidad] = $subtotal
  - $500: [cantidad] = $subtotal
  - $1.000: [cantidad] = $subtotal
  - $2.000: [cantidad] = $subtotal
  - $10.000: [cantidad] = $subtotal
  - $20.000: [cantidad] = $subtotal
- Calcular automáticamente subtotal por denominación
- Mostrar total del arqueo en tiempo real
- Mostrar diferencia (positiva/negativa) con colores
- Campo de observaciones si hay diferencia

#### 3.2 Validaciones del arqueo
- Si diferencia > 0: Mostrar advertencia "Sobrante de $X"
- Si diferencia < 0: Mostrar error "Faltante de $X"
- Permitir cerrar solo si observaciones explican la diferencia
- Opcional: Requerir aprobación de admin si diferencia > $5.000

#### 3.3 Guardar arqueo en base de datos
- Insertar registros en `arqueo_billetes` para cada denominación
- Actualizar campos `arqueo_*` en `cierres_caja`
- Vincular arqueo al retiro en `rutas_retiros`

### 4. Interfaz para Choferes (Repartidor)

#### 4.1 Crear página `/repartidor/dashboard`
- Mostrar retiros pendientes de la zona del chofer
- Mostrar transferencias de stock pendientes
- Mostrar resumen del día

#### 4.2 Componente `RetirosPendientesCard`
- Lista de retiros pendientes filtrados por zona
- Botón "Validar Retiro" para cada retiro
- Mostrar monto, sucursal, fecha
- **Mostrar detalle de arqueo de billetes** (expandible)

#### 4.3 Componente `TransferenciasCard`
- Lista de transferencias pendientes de la zona
- Estado de cada transferencia

### 5. Validar Rutas (Admin)

#### 5.1 Actualizar `/tesoreria/validar-rutas`
- Mostrar retiros pendientes agrupados por zona
- Mostrar transferencias pendientes
- Vista en tiempo real con Realtime

#### 5.2 Componente `ValidarRutasRealtime`
- Agregar sección de retiros de sucursales con arqueo
- Agregar sección de transferencias
- Mantener sección de pedidos existente
- **Mostrar detalle de arqueo de billetes** para cada retiro:
  - Desglose por denominación
  - Total esperado vs real
  - Diferencia y observaciones

### 6. Actions y Funciones

#### 6.1 `obtenerRetirosPendientesPorZonaAction(zonaId)`
- Filtrar retiros por zona
- Incluir datos de sucursal y vehículo
- **Incluir detalle de arqueo de billetes**

#### 6.2 `validarRetiroAction(retiroId, cajaCentralId)`
- Ya existe, verificar que funcione correctamente
- Acreditar en caja central
- Marcar como validado

#### 6.3 `obtenerTransferenciasPendientesPorZonaAction(zonaId)`
- Filtrar transferencias por zona
- Mostrar estado actual

#### 6.4 `guardarArqueoAction(cierreCajaId, billetes, observaciones)`
- Guardar detalle de billetes en `arqueo_billetes`
- Calcular totales y diferencia
- Actualizar campos `arqueo_*` en `cierres_caja`

### 7. Asignación de Zonas

#### 7.1 Script para asignar zonas a sucursales
- 3 sucursales → Zona Monteros
- 1 sucursal → Zona Simoca

#### 7.2 Verificar que las zonas existan en la tabla `zonas`

### 8. RLS y Permisos

#### 8.1 Políticas para `rutas_retiros`
- Admin: acceso completo
- Repartidor: solo ver retiros de su zona
- Sucursal: solo ver sus propios retiros

#### 8.2 Políticas para `arqueo_billetes`
- Admin: acceso completo
- Sucursal: solo ver sus propios arqueos
- Repartidor: solo ver arqueos de retiros de su zona

#### 8.3 Políticas para `sucursales.zona_id`
- Admin: puede editar
- Otros: solo lectura

## Orden de Ejecución

1. **Migraciones DB** (zonas, rutas_retiros, arqueo_billetes, sucursales.zona_id, cierres_caja.arqueo_*)
2. **Asignar zonas a sucursales** (script SQL)
3. **Crear componente ArqueoBilletesForm**
4. **Modificar cerrarCierreCajaAction** para crear retiros automáticos y guardar arqueo
5. **Crear página de repartidor** con componentes
6. **Actualizar Validar Rutas** con retiros, arqueo y transferencias
7. **Actions auxiliares** (obtener por zona, validar, guardar arqueo)
8. **RLS y permisos**
9. **Testing completo**

## Archivos a Modificar/Crear

### Modificar
- `src/actions/tesoreria.actions.ts` - cerrarCierreCajaAction, agregar guardarArqueoAction
- `src/app/(admin)/(dominios)/tesoreria/validar-rutas/page.tsx`
- `src/components/sucursales/CerrarCajaDialog.tsx` - agregar arqueo
- `src/components/sucursales/AccionesTesoreria.tsx` - agregar arqueo

### Crear
- `src/app/(repartidor)/dashboard/page.tsx`
- `src/components/repartidor/RetirosPendientesCard.tsx`
- `src/components/repartidor/TransferenciasCard.tsx`
- `src/components/repartidor/ResumenDiaCard.tsx`
- `src/components/sucursales/ArqueoBilletesForm.tsx`
- `supabase/migrations/20260113_flujo_cierre_caja_retiros.sql`

## Notas Importantes

- El monto de retiro se calcula como: `saldo_final - 50,000`
- Si el resultado es negativo, no se crea retiro
- Los retiros son INDEPENDIENTES de los pedidos (no se suman a total_final)
- El chofer ve: Pedidos + Retiros + Transferencias en su dashboard
- Todo en tiempo real usando Supabase Realtime
- **Denominaciones de billetes argentinos:** $100, $200, $500, $1.000, $2.000, $10.000, $20.000
- **Arqueo obligatorio** al cerrar caja
- **Diferencia > $5.000** requiere aprobación de admin (opcional)
- Admin: acceso completo
- Repartidor: solo ver retiros de su zona
- Sucursal: solo ver sus propios retiros

#### 7.2 Políticas para `sucursales.zona_id`
- Admin: puede editar
- Otros: solo lectura

## Orden de Ejecución

1. **Migraciones DB** (zonas, rutas_retiros, sucursales.zona_id)
2. **Asignar zonas a sucursales** (script SQL)
3. **Modificar cerrarCierreCajaAction** para crear retiros automáticos
4. **Crear página de repartidor** con componentes
5. **Actualizar Validar Rutas** con retiros y transferencias
6. **Actions auxiliares** (obtener por zona, validar)
7. **RLS y permisos**
8. **Testing completo**

## Archivos a Modificar/Crear

### Modificar
- `src/actions/tesoreria.actions.ts` - cerrarCierreCajaAction
- `src/app/(admin)/(dominios)/tesoreria/validar-rutas/page.tsx`
- `src/components/sucursales/CerrarCajaDialog.tsx`

### Crear
- `src/app/(repartidor)/dashboard/page.tsx`
- `src/components/repartidor/RetirosPendientesCard.tsx`
- `src/components/repartidor/TransferenciasCard.tsx`
- `src/components/repartidor/ResumenDiaCard.tsx`
- `supabase/migrations/20260113_flujo_cierre_caja_retiros.sql`

## Notas Importantes

- El monto de retiro se calcula como: `saldo_final - 50,000`
- Si el resultado es negativo, no se crea retiro
- Los retiros son INDEPENDIENTES de los pedidos (no se suman a total_final)
- El chofer ve: Pedidos + Retiros + Transferencias en su dashboard
- Todo en tiempo real usando Supabase Realtime
