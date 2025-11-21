# Guía de Pruebas - Flujo Completo End-to-End

## 📋 Checklist de Pruebas Post-Implementación

Esta guía cubre todas las pruebas necesarias para validar el flujo completo implementado: **Cliente → Bot → Ventas → Almacén → Reparto → Tesorería**.

---

## 🎯 1. FLUJO DE PRESUPUESTOS Y VENTAS

### 1.1 Bot de WhatsApp - Creación de Presupuestos

**Prueba:** Cliente crea presupuesto vía WhatsApp

**Pasos:**
1. Enviar mensaje a WhatsApp: `POLLO001 5`
2. Verificar respuesta del bot con número de presupuesto (formato: `PRES-YYYYMMDD-XXXX`)
3. Verificar que se incluye link de seguimiento
4. Verificar que el stock se reserva preventivamente (no se descuenta físicamente)

**Resultado esperado:**
- ✅ Bot responde con número de presupuesto único
- ✅ Link de seguimiento funcional
- ✅ Presupuesto aparece en `/ventas/presupuestos` con estado `pendiente`
- ✅ Stock reservado pero no descontado físicamente

**Comandos de prueba:**
```bash
# Verificar presupuesto creado
curl http://localhost:3000/api/ventas/presupuestos?estado=pendiente
```

---

### 1.2 Módulo Ventas - Gestión de Presupuestos

**Prueba:** Vendedor gestiona presupuesto pendiente

**Pasos:**
1. Acceder a `/ventas/presupuestos`
2. Verificar que aparece el presupuesto con estado `Pendiente`
3. Abrir detalle del presupuesto (`/ventas/presupuestos/[id]`)
4. Verificar información del cliente (debe ser deudor por defecto)
5. Verificar métodos de pago múltiples y recargos
6. Asignar zona y turno usando el formulario
7. Probar opciones:
   - **Facturar directo** (si no hay productos pesables)
   - **Enviar a almacén** (si hay productos pesables o requiere pesaje)

**Resultado esperado:**
- ✅ Lista de presupuestos muestra estado correcto
- ✅ Detalle muestra cliente como deudor
- ✅ Métodos de pago se muestran correctamente con recargos
- ✅ Formulario de zona/turno funciona
- ✅ Botón "Facturar sin Almacén" solo aparece si no hay productos pesables
- ✅ Botón "Enviar a Almacén" funciona correctamente

**Verificaciones en BD:**
```sql
-- Verificar presupuesto
SELECT estado, zona_id, turno, metodos_pago 
FROM presupuestos 
WHERE numero_presupuesto = 'PRES-YYYYMMDD-XXXX';

-- Verificar cliente es deudor
SELECT es_deudor FROM clientes WHERE id = 'cliente-id';
```

---

### 1.3 Facturación Directa (Sin Almacén)

**Prueba:** Facturar presupuesto sin productos pesables

**Pasos:**
1. Crear presupuesto con productos NO pesables (categoría diferente a "balanza")
2. En detalle del presupuesto, hacer clic en "Facturar sin Almacén"
3. Verificar que se convierte a pedido automáticamente
4. Verificar que el stock se descuenta físicamente
5. Verificar que aparece en módulo de reparto

**Resultado esperado:**
- ✅ Presupuesto cambia a estado `facturado`
- ✅ Se crea pedido asociado
- ✅ Stock físico descontado
- ✅ Pedido disponible para asignar a ruta

---

## 🏭 2. MÓDULO DE ALMACÉN

### 2.1 Vista de Presupuestos del Día

**Prueba:** Almacén ve presupuestos por fecha/turno

**Pasos:**
1. Acceder a `/almacen/presupuestos-dia`
2. Seleccionar fecha y turno
3. Verificar que muestra total de KG aproximado
4. Verificar que muestra lista de presupuestos para esa fecha/turno
5. Verificar asignación automática de vehículos por peso

**Resultado esperado:**
- ✅ Vista muestra total de KG del día
- ✅ Lista de presupuestos filtrada por fecha/turno
- ✅ Vehículos asignados automáticamente según peso límite
- ✅ Presupuestos con productos pesables resaltados

---

### 2.2 Pesaje de Productos (Categoría Balanza)

**Prueba:** Almacén pesa productos de categoría "balanza"

**Pasos:**
1. Acceder a `/almacen/presupuesto/[id]/pesaje`
2. Verificar que solo muestra productos con `categoria = 'balanza'`
3. Probar tres métodos de pesaje:
   - **Balanza física** (si está configurada): Conectar y leer peso
   - **Ingreso manual**: Ingresar peso manualmente
   - **Simulación**: Usar endpoint de simulación
4. Confirmar peso y verificar que se actualiza
5. Verificar que el precio se recalcula según peso real

**Resultado esperado:**
- ✅ Solo productos pesables son editables
- ✅ Peso se actualiza correctamente
- ✅ Precio se recalcula automáticamente
- ✅ Total del presupuesto se actualiza

**Comandos de prueba:**
```bash
# Simular peso
curl -X POST http://localhost:3000/api/almacen/simular-peso \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_item_id": "uuid-item"}'

# Verificar peso actualizado
SELECT peso_final, precio_unitario, subtotal 
FROM presupuesto_items 
WHERE id = 'uuid-item';
```

---

### 2.3 Finalización de Presupuesto en Almacén

**Prueba:** Almacén finaliza presupuesto después del pesaje

**Pasos:**
1. Completar pesaje de todos los productos pesables
2. Hacer clic en "Finalizar Presupuesto"
3. Verificar que el presupuesto cambia a estado `en_almacen` → `facturado`
4. Verificar que se crea pedido automáticamente
5. Verificar que el stock se descuenta físicamente
6. Verificar que se genera número de pedido

**Resultado esperado:**
- ✅ Presupuesto finalizado correctamente
- ✅ Pedido creado con todos los datos correctos
- ✅ Stock descontado con pesos reales
- ✅ Pedido disponible para asignar a ruta

**Verificaciones en BD:**
```sql
-- Verificar conversión
SELECT p.estado, ped.numero_pedido, ped.total
FROM presupuestos p
JOIN pedidos ped ON ped.presupuesto_id = p.id
WHERE p.id = 'presupuesto-id';

-- Verificar stock descontado
SELECT cantidad_disponible FROM lotes WHERE producto_id = 'producto-id';
```

---

## 🚛 3. MÓDULO DE REPARTO

### 3.1 Vista de Rutas Activas

**Prueba:** Repartidor ve su ruta activa

**Pasos:**
1. Acceder a `/repartidor/home` (o `/home` como repartidor)
2. Verificar que muestra ruta activa si existe
3. Verificar métricas: entregas pendientes, completadas, distancia
4. Verificar botón para ver detalle de ruta

**Resultado esperado:**
- ✅ Ruta activa se muestra correctamente
- ✅ Métricas actualizadas en tiempo real
- ✅ Link a detalle de ruta funcional

---

### 3.2 Hoja de Ruta

**Prueba:** Repartidor ve lista de entregas

**Pasos:**
1. Acceder a `/repartidor/ruta/[ruta_id]`
2. Verificar lista de entregas ordenadas por `orden_entrega`
3. Verificar información de cada entrega:
   - Cliente, dirección, teléfono
   - Productos y cantidades
   - Métodos de pago admitidos
   - Total a cobrar
4. Verificar botón para abrir en Google Maps

**Resultado esperado:**
- ✅ Lista completa de entregas
- ✅ Información correcta de cada entrega
- ✅ Métodos de pago se muestran correctamente
- ✅ Link a Google Maps funcional

---

### 3.3 Registro de Cobro

**Prueba:** Repartidor registra cobro de entrega

**Pasos:**
1. Acceder a detalle de entrega: `/repartidor/ruta/[ruta_id]/entrega/[entrega_id]`
2. En sección "Registrar cobro":
   - Seleccionar método de pago (efectivo, transferencia, QR, tarjeta, cuenta corriente)
   - Ingresar monto cobrado
   - Si es transferencia: ingresar número de transacción
   - Subir comprobante (URL o archivo)
   - Agregar notas
3. Hacer clic en "Registrar cobro"
4. Verificar que el cobro se registra
5. Verificar que aparece en tesorería en tiempo real

**Resultado esperado:**
- ✅ Cobro registrado correctamente
- ✅ Método de pago guardado
- ✅ Comprobante asociado (si se subió)
- ✅ Movimiento aparece en tesorería inmediatamente
- ✅ Estado de pago del pedido actualizado

**Verificaciones en BD:**
```sql
-- Verificar cobro registrado
SELECT metodo_pago, monto_cobrado, numero_transaccion, comprobante_url
FROM cobros_reparto
WHERE pedido_id = 'pedido-id';

-- Verificar movimiento en tesorería
SELECT tipo, monto, metodo_pago, origen_tipo, origen_id
FROM movimientos_caja
WHERE origen_tipo = 'cobro_reparto' AND origen_id = 'cobro-id';
```

---

### 3.4 Registro de Devolución

**Prueba:** Repartidor registra devolución de productos

**Pasos:**
1. En detalle de entrega, sección "Registrar devolución"
2. Seleccionar producto a devolver
3. Ingresar cantidad a devolver
4. Seleccionar motivo (producto dañado, cantidad errónea, no solicitado, cliente ausente, otro)
5. Agregar observaciones
6. Hacer clic en "Registrar devolución"
7. Verificar que la devolución se registra

**Resultado esperado:**
- ✅ Devolución registrada correctamente
- ✅ Motivo y observaciones guardadas
- ✅ Devolución visible en módulo de almacén para procesar

**Verificaciones en BD:**
```sql
-- Verificar devolución
SELECT producto_id, cantidad, motivo, observaciones
FROM devoluciones_reparto
WHERE detalle_ruta_id = 'detalle-ruta-id';
```

---

### 3.5 Marcar Entrega como Completada

**Prueba:** Repartidor marca entrega como entregada

**Pasos:**
1. Después de registrar cobro (o si no requiere cobro)
2. Hacer clic en "Marcar como entregado"
3. Verificar que el estado cambia a `entregado`
4. Verificar que las métricas se actualizan

**Resultado esperado:**
- ✅ Estado actualizado a `entregado`
- ✅ Métricas de entregas completadas actualizadas
- ✅ Entrega no aparece más en pendientes

---

## 💰 4. MÓDULO DE TESORERÍA

### 4.1 Vista de Movimientos en Tiempo Real

**Prueba:** Tesorería ve movimientos actualizados

**Pasos:**
1. Acceder a `/tesoreria/movimientos`
2. Verificar que muestra:
   - Ingresos del día
   - Egresos del día
   - Neto del día
   - Recaudación por método de pago
   - Caja central con totales
3. Realizar un cobro desde reparto
4. Verificar que los movimientos se actualizan automáticamente

**Resultado esperado:**
- ✅ Totales correctos por método de pago
- ✅ Caja central muestra totales actualizados
- ✅ Movimientos se actualizan en tiempo real
- ✅ Ingresos y egresos calculados correctamente

**Verificaciones en BD:**
```sql
-- Verificar totales por método
SELECT metodo_pago, SUM(monto) as total
FROM movimientos_caja
WHERE tipo = 'ingreso' AND DATE(created_at) = CURRENT_DATE
GROUP BY metodo_pago;

-- Verificar caja central
SELECT nombre, saldo_actual FROM cajas WHERE nombre = 'Caja Central';
```

---

### 4.2 Registro Manual de Movimientos

**Prueba:** Registrar ingresos/egresos manuales

**Pasos:**
1. En `/tesoreria/movimientos`, usar formulario "Registrar movimiento"
2. Seleccionar tipo: ingreso o egreso
3. Seleccionar caja
4. Ingresar monto y descripción
5. Seleccionar método de pago
6. Registrar movimiento
7. Verificar que el saldo de la caja se actualiza

**Resultado esperado:**
- ✅ Movimiento registrado correctamente
- ✅ Saldo de caja actualizado
- ✅ Movimiento aparece en lista
- ✅ Totales recalculados

---

## 🔄 5. FLUJO END-TO-END COMPLETO

### 5.1 Flujo Completo: Bot → Almacén → Reparto → Tesorería

**Prueba:** Validar flujo completo desde creación hasta cobro

**Pasos secuenciales:**

1. **Cliente crea presupuesto vía WhatsApp**
   - Enviar: `POLLO001 5, HUEVO001 2`
   - Verificar número de presupuesto

2. **Vendedor gestiona presupuesto**
   - Asignar zona y turno
   - Enviar a almacén

3. **Almacén procesa**
   - Ver presupuesto en `/almacen/presupuestos-dia`
   - Pesar productos de categoría "balanza"
   - Finalizar presupuesto

4. **Sistema convierte a pedido**
   - Verificar que se crea pedido automáticamente
   - Verificar stock descontado

5. **Asignar a ruta**
   - Crear ruta en módulo de reparto
   - Asignar pedido a ruta

6. **Repartidor entrega**
   - Ver ruta en `/repartidor/home`
   - Registrar cobro
   - Marcar como entregado

7. **Tesorería verifica**
   - Verificar movimiento en `/tesoreria/movimientos`
   - Verificar totales actualizados

**Resultado esperado:**
- ✅ Todo el flujo funciona sin errores
- ✅ Datos consistentes en cada paso
- ✅ Stock, caja y estados actualizados correctamente
- ✅ Trazabilidad completa

---

## 🧪 6. PRUEBAS DE INTEGRACIÓN Y API

### 6.1 Endpoints de API

**Pruebas de endpoints críticos:**

```bash
# 1. Simular peso de balanza
curl -X POST http://localhost:3000/api/almacen/simular-peso \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{"presupuesto_item_id": "uuid-item"}'

# 2. Finalizar presupuesto en almacén
curl -X POST http://localhost:3000/api/almacen/presupuesto/finalizar \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{"presupuesto_id": "uuid-presupuesto"}'

# 3. Registrar cobro desde reparto
curl -X POST http://localhost:3000/api/reparto/entrega \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "pedido_id": "uuid-pedido",
    "metodo_pago": "efectivo",
    "monto_cobrado": 1250.50,
    "notas_entrega": "Cliente satisfecho"
  }'

# 4. Registrar devolución
curl -X POST http://localhost:3000/api/reparto/devoluciones \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{
    "pedido_id": "uuid-pedido",
    "detalle_ruta_id": "uuid-detalle",
    "producto_id": "uuid-producto",
    "cantidad": 2,
    "motivo": "producto_dañado",
    "observaciones": "Producto con fecha vencida"
  }'

# 5. Obtener movimientos de tesorería en tiempo real
curl http://localhost:3000/api/tesoreria/movimientos-tiempo-real \
  -H "Cookie: sb-access-token=..."

# 6. Facturar presupuesto directo (sin almacén)
curl -X POST http://localhost:3000/api/ventas/presupuestos/facturar \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=..." \
  -d '{"presupuesto_id": "uuid-presupuesto"}'
```

---

### 6.2 Funciones RPC de Supabase

**Pruebas en SQL Editor de Supabase:**

```sql
-- 1. Verificar reserva de stock preventiva
SELECT * FROM fn_reservar_stock_por_presupuesto('uuid-presupuesto');

-- 2. Actualizar peso de item pesable
SELECT * FROM fn_actualizar_peso_item_presupuesto(
  'uuid-item', 
  5.25  -- peso en kg
);

-- 3. Convertir presupuesto a pedido (desde almacén)
SELECT * FROM fn_convertir_presupuesto_a_pedido(
  'uuid-presupuesto',
  'uuid-usuario',
  'uuid-caja'
);

-- 4. Asignar vehículos por peso
SELECT * FROM fn_asignar_vehiculos_por_peso(
  '2025-11-20'::date,
  'tarde'::text
);

-- 5. Registrar cobro desde reparto
SELECT * FROM fn_registrar_cobro_reparto(
  'uuid-pedido',
  'efectivo'::text,
  1250.50,
  'uuid-repartidor',
  NULL,  -- numero_transaccion
  NULL   -- comprobante_url
);
```

---

## ✅ 7. CHECKLIST FINAL DE VALIDACIÓN

### Funcionalidades Core

- [ ] Bot crea presupuestos con números únicos
- [ ] Clientes se crean como deudores por defecto
- [ ] Presupuestos soportan múltiples métodos de pago con recargos
- [ ] Reserva preventiva de stock funciona (no descuenta físicamente)
- [ ] Vendedor puede facturar directo (sin productos pesables)
- [ ] Vendedor puede enviar a almacén
- [ ] Almacén ve totales por zona/turno
- [ ] Almacén puede pesar productos de categoría "balanza"
- [ ] Almacén puede finalizar presupuesto
- [ ] Conversión presupuesto → pedido funciona correctamente
- [ ] Asignación automática de vehículos por peso funciona
- [ ] Repartidor ve rutas y entregas correctamente
- [ ] Repartidor puede registrar cobros con múltiples métodos
- [ ] Repartidor puede registrar devoluciones
- [ ] Repartidor puede marcar entregas como completadas
- [ ] Tesorería muestra movimientos en tiempo real
- [ ] Tesorería muestra totales por método de pago
- [ ] Caja central se actualiza automáticamente

### Validaciones de Datos

- [ ] Stock se descuenta correctamente después de finalizar presupuesto
- [ ] Precios se recalculan según peso real
- [ ] Totales de presupuestos/pedidos son correctos
- [ ] Estados de presupuestos se actualizan correctamente
- [ ] Movimientos de caja se registran correctamente
- [ ] Saldos de cajas se actualizan correctamente

### Integraciones

- [ ] Bot de WhatsApp funciona correctamente
- [ ] Integración con Supabase funciona
- [ ] Server Actions funcionan correctamente
- [ ] APIs REST funcionan correctamente

---

## 🐛 8. PROBLEMAS COMUNES Y SOLUCIONES

### Error: "Presupuesto no encontrado"
**Solución:** Verificar que el presupuesto existe y el usuario tiene permisos

### Error: "No se puede facturar, hay productos pesables"
**Solución:** Solo presupuestos sin productos pesables pueden facturarse directo

### Error: "Stock insuficiente"
**Solución:** Verificar que hay stock disponible en lotes

### Error: "Vehículo sin capacidad"
**Solución:** Verificar que el peso total no excede la capacidad del vehículo

### Error: "Caja no encontrada"
**Solución:** Verificar que existe una caja configurada

---

## 📝 9. NOTAS PARA DESARROLLADORES

- Todas las operaciones críticas usan funciones RPC para garantizar atomicidad
- Los presupuestos tienen estados: `pendiente` → `en_almacen` → `facturado` → `anulado`
- Los productos de categoría "balanza" son los únicos que requieren pesaje
- Los clientes son deudores por defecto hasta que se confirme el reparto
- Los cobros del reparto se registran automáticamente en tesorería
- La asignación de vehículos es automática según peso y capacidad

---

**Última actualización:** 2025-11-20
**Versión del sistema:** 1.0.0

