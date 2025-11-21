# Plan de Pruebas Maestro - Avícola del Sur
# Actualizado: Noviembre 2025

Este documento define el flujo de pruebas End-to-End para validar la lógica de negocio: **Cliente (Deudor) → Bot (Presupuesto) → Ventas → Almacén (Pesaje) → Reparto (Ruta) → Tesorería (Cierre)**.

---

## 📋 Glosario Crítico

- **Presupuesto**: Documento inicial (cotización). Genera reserva de stock *preventiva*.
- **Pedido**: Documento final confirmado que va al camión. Descuenta stock *físico*.
- **Producto Balanza**: Categoría especial que requiere pesaje obligatorio en almacén.
- **Cliente Deudor**: Estado por defecto de todo cliente hasta que el reparto rinde cuentas.

---

## 🧪 1. Flujo de Ventas (Bot y Vendedor)

### 0. Planificación Semanal (Prerequisito)
- [ ] **Crear plan** en `/reparto/planificacion`: definir zona, día, turno, vehículo (Fiorino 600 kg, Hilux 1500 kg o F-4000 4000 kg) y opcional repartidor.
- [ ] **Verificar** que el plan figure en la tabla y que coincida con los pedidos que se probarán (misma zona/turno/día).

### 1.1 Entrada por WhatsApp (Bot)
**Objetivo**: Validar que el bot tome presupuestos y reserve stock virtualmente.

- [ ] **Crear Presupuesto**: Enviar mensaje "POLLO001 10kg" al bot.
    - *Validación*: Recibir número `PRES-2025...`.
    - *Validación BD*: Tabla `stock_reservations` tiene registro. Tabla `lotes` **NO** ha bajado su `cantidad_disponible`.
    - *Estado*: El presupuesto debe nacer en estado `pendiente`.

### 1.2 Gestión del Vendedor (Web)
**Objetivo**: Validar asignación de zona, turno y verificación de pagos.

- [ ] **Revisión de Presupuesto**: Entrar al módulo Ventas.
    - *Acción*: Abrir el presupuesto pendiente.
    - *Acción*: Asignar **Zona** (obligatoria) y, si corresponde, **Turno** (opcional).
    - *Nota*: Si no se define turno manualmente, el sistema lo calcula al confirmar (≤ 06:00 → Mañana, > 06:00 → Tarde).
    - *Acción*: Verificar formas de pago (ej. Efectivo + Transferencia). Verificar si aplica recargo.
- [ ] **Bifurcación de Flujo**:
    - **Caso A (Con Balanza)**: Si hay productos categoría 'BALANZA', el botón debe decir "Enviar a Almacén".
    - **Caso B (Sin Balanza/Secos)**: Si son solo maples/cajas cerradas, habilitar opción "Facturar Directo" (pasa directo a Pedido sin pasar por pesaje).

---

## ⚖️ 2. Flujo de Almacén (Pesaje y Armado)

### 2.1 Tablero de Control
**Objetivo**: Almacén solo ve lo que debe preparar hoy.

- [ ] **Vista General**:
    - *Validación*: Ver total de KG aproximados para el turno actual (corte 15hs).
    - *Validación*: Lista de presupuestos filtrada por Zona/Turno.

### 2.2 Proceso de Pesaje (Categoría Balanza)
**Objetivo**: Transformar peso estimado en peso real.

- [ ] **Edición de Pesables**:
    - *Acción*: Abrir presupuesto en estado `en_almacen`.
    - *Validación UI*: Solo los inputs de productos 'BALANZA' son editables. Los unitarios (ej. maples) están bloqueados.
    - *Acción*: Ingresar peso real (ej. 2.1kg sube a 2.25kg).
    - *Resultado*: El precio total del ítem y del presupuesto se recalcula automáticamente.

### 2.3 Cierre de Armado y Asignación
**Objetivo**: Confirmar el pedido final y asignarlo a vehículo.

- [ ] **Finalizar Presupuesto**:
    - *Acción*: Click en "Confirmar Armado".
    - *Efecto Sistema*: 
        1. Presupuesto pasa a estado `facturado`.
        2. Se crea un `pedido` oficial (`PED-...`).
        3. Se consume la reserva y se descuenta stock físico real de `lotes`.
- [ ] **Asignación Vehicular**:
    - *Prueba*: Tras la conversión, consultar las tablas `rutas_reparto` y `detalles_ruta`.
    - *Validación*: Cada pedido queda insertado automáticamente en la ruta del día (fecha + zona + turno). Si no existía ruta, se crea una nueva en estado `planificada` con vehículo y repartidor disponibles.

### 2.4 Recepción y Producción (Ingresos/Egresos)
- [ ] **Ingreso Mercadería**: Registrar ingreso en `kg` o `unidades`.
- [ ] **Egreso a Producción**:
    - *Acción*: Sacar producto 'Pollo Entero' (Balanza) hacia 'Producción'.
    - *Resultado*: Se descuenta del stock de venta y entra al circuito de cortes.

---

## 🚚 3. Flujo de Reparto (Ruta y Entrega)

### 3.1 Inicio de Ruta
**Objetivo**: Control de salida.

- [ ] **Checklist Inicial**:
    - *Acción*: Chofer completa estado del vehículo (aceite, ruedas) en App.
    - *Validación*: No deja iniciar ruta sin checklist.
- [ ] **Ruta Autogenerada**:
    - *Validación*: Luego de convertir un presupuesto, `/reparto/monitor` muestra la ruta del día (fecha + zona + turno) con el pedido incorporado y polilínea optimizada.

### 3.2 Gestión de Entregas
**Objetivo**: Trazabilidad y Cobranza en sitio.

- [ ] **Hoja de Ruta Inteligente**:
    - *UI*: Ver lista ordenada (Google Maps suggestion).
    - *Acción*: Entrar al detalle de un cliente.
- [ ] **Cobranza**:
    - *Escenario Múltiple*: Cliente paga mitad efectivo, mitad transferencia.
    - *Acción*: Registrar ambos pagos. Subir comprobante de transferencia.
- [ ] **Devoluciones**:
    - *Acción*: Cliente rechaza 1 pollo por mal estado.
    - *Sistema*: Registrar devolución con motivo "Producto Dañado".
    - *Efecto*: Se genera registro en tabla `devoluciones` (para revisión posterior de almacén/calidad).
- [ ] **Finalizar Entrega**: Marcar como entregado. Cliente sigue siendo deudor en sistema hasta que Tesorería valide (o saldo quede en 0).

### 3.3 Cierre de Ruta
- [ ] **Checklist Final**: Registrar estado final del vehículo y km.

---

## 💰 4. Flujo de Tesorería (Control)

### 4.1 Monitoreo Tiempo Real
**Objetivo**: Ver la plata entrando mientras el camión sigue en calle.

- [ ] **Vista en Vivo**:
    - *Acción*: Tesorero entra a dashboard mientras Repartidor carga un cobro.
    - *Validación*: El cobro aparece instantáneamente en "Ingresos del día" (sin refrescar o al refrescar pantalla).

### 4.2 Cierre de Caja (Rendición)
**Objetivo**: Conciliar lo físico con lo sistémico.

- [ ] **Rendición de Chofer**:
    - *Acción*: Chofer entrega efectivo.
    - *Sistema*: Tesorero valida contra el total "Efectivo reportado" en la ruta.
- [ ] **Movimientos Internos**:
    - *Acción*: Retiro a Tesoro (Casa Central).
    - *Acción*: Pago de Gasto (Combustible).
- [ ] **Cierre Diario**:
    - *Acción*: Generar cierre de caja.
    - *Resultado*: Se guarda snapshot del día. Saldos se resetean o acumulan según configuración.

---

## 🛠️ Comandos SQL de Verificación Rápida

Usa estos queries en Supabase SQL Editor para validar los hitos clave:

```sql
-- 1. Verificar Reserva Preventiva (Bot)
SELECT p.numero_presupuesto, p.estado, sr.cantidad_reservada 
FROM presupuestos p 
JOIN stock_reservations sr ON sr.presupuesto_id = p.id
WHERE p.numero_presupuesto = 'ULTIMO_PRESUPUESTO';

-- 2. Verificar Pesaje Real (Almacén)
SELECT pi.peso_final, pi.precio_unit_final, pi.subtotal_final 
FROM presupuesto_items pi 
WHERE pi.pesable = true;

-- 3. Verificar Conversión a Pedido
SELECT numero_pedido, total_final, estado, zona_id 
FROM pedidos 
ORDER BY created_at DESC LIMIT 1;

-- 4. Verificar Cobro Reparto en Tesorería
SELECT tipo, monto, metodo_pago, origen_tipo 
FROM tesoreria_movimientos 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 5. Verificar Asignación Automática de Ruta
SELECT 
  rr.fecha_ruta,
  rr.turno,
  rr.zona_id,
  dr.pedido_id
FROM rutas_reparto rr
JOIN detalles_ruta dr ON dr.ruta_id = rr.id
ORDER BY rr.fecha_ruta DESC, rr.turno
LIMIT 10;
```
