# ✅ Checklist de Verificación Pre-Demo
**Fecha**: Viernes 5 de Diciembre, 2025 - 16:22  
**Propósito**: Verificar que todo esté listo para demostrar el flujo completo

---

## 🔍 PRE-VERIFICACIONES CRÍTICAS (Hacer ANTES de empezar)

### 1. Configuración Básica del Sistema

#### Usuarios y Roles
- [ ] **Usuario Admin** configurado y funcional
  - Email: `admin@avicoladelsur.com` (o el que uses)
  - Puede iniciar sesión sin problemas
  - Tiene acceso a todos los módulos

- [ ] **Usuario Repartidor** configurado y funcional
  - Email: `repartidor@avicoladelsur.com` (o el que uses)
  - Puede iniciar sesión en el celular
  - Tiene rol `repartidor` en la BD

#### Base de Datos
- [ ] Servidor de desarrollo corriendo (`npm run dev`)
- [ ] Conexión a Supabase funcionando
- [ ] Variables de entorno configuradas correctamente

---

### 2. Datos Necesarios para la Demo

#### Clientes (Mínimo 2-3)
- [ ] Al menos **2 clientes** creados en el sistema
  - Cada uno debe tener:
    - ✅ Nombre
    - ✅ Teléfono/WhatsApp
    - ✅ **Zona de entrega asignada** (OBLIGATORIO)
    - ✅ **Dirección con coordenadas** (para optimización de rutas)
    - ✅ Tipo de cliente (minorista/mayorista/distribuidor)

**Verificar en**: `/ventas/clientes`
- [ ] Si no hay clientes, crear al menos 2:
  - Cliente 1: Zona "Norte" (para turno mañana)
  - Cliente 2: Zona "Centro" (para turno tarde)

#### Productos (Mínimo 2-3)
- [ ] Al menos **2 productos** en el sistema:
  - ✅ 1 producto **pesable** (categoría BALANZA) - ej: Pollo Entero
  - ✅ 1 producto **no pesable** (unidades) - ej: Huevos
  - ✅ Tienen precio de venta configurado
  - ✅ Tienen stock disponible en lotes

**Verificar en**: `/almacen/productos`
- [ ] Si no hay productos, crear:
  - Producto 1: "Pollo Entero" - categoría BALANZA - precio $500/kg
  - Producto 2: "Huevos" - categoría HUEVOS - precio $200/docena

#### Stock en Lotes
- [ ] Hay **lotes disponibles** para los productos:
  - ✅ Lotes en estado `disponible`
  - ✅ Con `cantidad_disponible > 0`
  - ✅ Fecha de vencimiento válida

**Verificar en**: `/almacen/lotes`
- [ ] Si no hay lotes, crear:
  - Lote de Pollo Entero: 50 kg disponibles
  - Lote de Huevos: 100 docenas disponibles

#### Zonas de Entrega
- [ ] Hay **al menos 1 zona** creada:
  - ✅ Zona activa (ej: "Norte", "Centro", "Sur")
  - ✅ Asignada a clientes

**Verificar en**: Consulta directa a BD o en formularios de cliente

#### Vehículos
- [ ] Hay **al menos 1 vehículo** activo:
  - ✅ Patente, marca, modelo
  - ✅ Capacidad en kg configurada
  - ✅ Estado `activo = true`

**Verificar en**: `/reparto/vehiculos`
- [ ] Vehículos preconfigurados disponibles:
  - Fiorino: 600 kg
  - Hilux: 1500 kg
  - F-4000: 4000 kg

---

### 3. ⚠️ CONFIGURACIÓN CRÍTICA: Plan Semanal de Rutas

**ESTE ES EL PASO MÁS IMPORTANTE ANTES DE LA DEMO**

- [ ] **Plan Semanal creado** para HOY (viernes 5 de diciembre):
  - ✅ Ir a: `/reparto/planificacion`
  - ✅ Crear plan para:
    - **Día**: Viernes (o el día que corresponda según tu semana)
    - **Zona**: La misma zona de tus clientes
    - **Turno**: Tarde (ya que son las 16:22)
    - **Vehículo**: Seleccionar uno disponible
    - **Repartidor**: Asignar al usuario repartidor (opcional pero recomendado)
    - **Capacidad**: Según el vehículo seleccionado

**⚠️ SIN ESTO, NO PODRÁS ASIGNAR PEDIDOS A RUTA**

**Verificar**:
- [ ] El plan aparece en la tabla de planificación
- [ ] Tiene la misma zona que tus clientes
- [ ] Tiene el mismo turno (tarde, ya que son las 16:22)

---

### 4. Configuración de Tesorería

- [ ] **Caja central** creada:
  - ✅ Nombre: "Caja Central" o similar
  - ✅ Saldo inicial configurado

**Verificar en**: `/tesoreria/cajas`

---

## 📱 DISPOSITIVOS PARA LA DEMO

### PC (Admin/Vendedor/Almacén)
- [ ] Navegador abierto y funcionando
- [ ] Sesión iniciada como **admin** o **vendedor**
- [ ] URL: `http://localhost:3000` (o tu URL de producción)

### Celular (Repartidor)
- [ ] Navegador móvil abierto
- [ ] Sesión iniciada como **repartidor**
- [ ] URL: `http://tu-dominio.com` o IP local accesible
- [ ] **Permisos de ubicación habilitados** (para GPS tracking)

---

## 🎯 FLUJO PASO A PASO PARA LA DEMO

### **PASO 1: Crear Presupuesto** (PC - Vendedor)

**⚠️ IMPORTANTE**: Como son las 16:22 (después de las 15:00), el sistema automáticamente asignaría turno "mañana" del día siguiente. **Para hacer la prueba HOY**, debes especificar manualmente:

**En**: `/ventas/presupuestos/nuevo`

- [ ] Seleccionar un **cliente** existente
- [ ] Agregar productos al presupuesto:
  - ✅ 1 producto pesable (ej: Pollo Entero - 5 kg)
  - ✅ 1 producto no pesable (ej: Huevos - 2 docenas)
- [ ] Seleccionar **Zona de entrega** (misma que en el plan semanal)
- [ ] **Fecha de entrega**: **HOY** (5 de diciembre) - **FORZAR MANUALMENTE**
- [ ] **Turno**: Seleccionar **"Tarde"** manualmente (si la interfaz lo permite)
- [ ] Crear presupuesto

**Verificar**:
- [ ] Presupuesto creado con número `PRES-YYYYMMDD-XXXX`
- [ ] Estado: `en_almacen` (aparece automáticamente)
- [ ] **Fecha de entrega**: Viernes 5 de diciembre (HOY)
- [ ] **Turno**: "tarde" (debe ser tarde del día de hoy, no mañana)

---

### **PASO 2: Ver en Presupuestos del Día** (PC - Almacén)

**En**: `/almacen/presupuestos-dia`

- [ ] Seleccionar fecha: **HOY** (5 de diciembre)
- [ ] Seleccionar turno: **Tarde**
- [ ] Seleccionar zona: La zona del cliente

**Verificar**:
- [ ] El presupuesto aparece en la lista
- [ ] Muestra cliente, productos, total
- [ ] Muestra badge "BALANZA" si tiene productos pesables

---

### **PASO 3: Pesaje (Si hay productos pesables)** (PC - Almacén)

**En**: `/almacen/presupuesto/[id]/pesaje`

- [ ] Abrir el presupuesto para pesaje
- [ ] Ingresar peso real de productos pesables:
  - Ejemplo: Pediste 5 kg, pesa realmente 5.250 kg
- [ ] Verificar que el precio se recalcule automáticamente
- [ ] Finalizar pesaje

**Verificar**:
- [ ] Los pesos se guardan correctamente
- [ ] El total final se actualiza

---

### **PASO 4: Convertir a Pedido** (PC - Almacén)

**En**: `/almacen/presupuestos-dia`

- [ ] Click en "Pasar a Pedido" del presupuesto
- [ ] Esperar confirmación

**Verificar**:
- [ ] Presupuesto cambia a estado `facturado`
- [ ] Se crea un pedido con número `PED-YYYYMMDD-XXXX`
- [ ] El pedido aparece en `/almacen/pedidos`
- [ ] Estado del pedido: `preparando`

---

### **PASO 5: Pasar a Ruta** (PC - Almacén)

**Opción A: Desde la tabla de pedidos**
- [ ] Ir a: `/almacen/pedidos`
- [ ] Filtrar por fecha: HOY, turno: Tarde
- [ ] Click en el menú de acciones del pedido
- [ ] Click en "Pasar a ruta"

**Opción B: Desde detalle del pedido** (NUEVO)
- [ ] Ir a: `/almacen/pedidos/[id]`
- [ ] Ver el botón "Pasar a Ruta" en la parte superior
- [ ] Click en "Pasar a Ruta"

**Verificar**:
- [ ] Mensaje de éxito: "Pedido asignado a ruta exitosamente"
- [ ] El pedido queda asignado a la ruta planificada
- [ ] Se optimiza automáticamente el orden de clientes

---

### **PASO 6: Ver Ruta Generada** (PC - Admin)

**En**: `/reparto/rutas`

- [ ] Buscar la ruta del día (viernes 5 de diciembre, turno tarde)
- [ ] Verificar que el pedido esté incluido
- [ ] Ver orden optimizado de entregas

**En**: `/reparto/monitor` (Monitor GPS)

- [ ] Ver la ruta en el mapa
- [ ] Ver polilínea de la ruta optimizada
- [ ] Ver marcadores de clientes

---

### **PASO 7: Chofer Ve la Ruta** (Celular - Repartidor)

**En**: `/repartidor/home` o `/repartidor/entregas`

- [ ] Ver lista de rutas activas
- [ ] Ver la ruta del día con los pedidos asignados

**En**: `/repartidor/ruta/[ruta_id]`

- [ ] Ver hoja de ruta completa
- [ ] Ver lista de entregas ordenadas
- [ ] Ver mapa con la ruta

**Verificar**:
- [ ] Todos los clientes aparecen en orden
- [ ] Se puede ver dirección y teléfono de cada cliente
- [ ] Se puede ver lista de productos por cliente

---

### **PASO 8: Gestionar Entrega Individual** (Celular - Repartidor)

**En**: `/repartidor/ruta/[ruta_id]/entrega/[entrega_id]`

Para cada cliente:
- [ ] Ver información del cliente (nombre, dirección, teléfono)
- [ ] Ver lista completa de productos a entregar
- [ ] Registrar estado de pago:
  - Seleccionar: "Ya pagó" / "Pendiente" / "Pagará después"
  - Si "Ya pagó":
    - Seleccionar método de pago (efectivo, transferencia, etc.)
    - Ingresar monto cobrado
    - Opcional: número de transacción
- [ ] Marcar como entregado

**Verificar**:
- [ ] La información se guarda correctamente
- [ ] Puedes pasar al siguiente cliente

---

### **PASO 9: Finalizar Ruta** (Celular - Repartidor)

**En**: `/repartidor/ruta/[ruta_id]`

- [ ] Verificar que todas las entregas estén completadas
- [ ] Verificar que todas tengan estado de pago definido
- [ ] Click en "Finalizar Ruta"

**Verificar**:
- [ ] La ruta cambia a estado `completada`
- [ ] No se puede editar después de finalizar

---

### **PASO 10: Validar Ruta en Tesorería** (PC - Tesorero)

**En**: `/tesoreria/validar-rutas`

- [ ] Ver la ruta completada en la lista
- [ ] Ver resumen de recaudación:
  - Total registrado por el repartidor
  - Desglose por método de pago
  - Separación: caja vs cuenta corriente
- [ ] Ver lista de entregas con montos individuales
- [ ] Ingresar monto físico recibido
- [ ] Seleccionar caja
- [ ] Agregar observaciones si hay diferencias
- [ ] Click en "Validar Ruta"

**Verificar**:
- [ ] Mensaje de éxito: "Ruta validada exitosamente"
- [ ] Se crean movimientos de caja agrupados por método de pago
- [ ] La caja se actualiza con el dinero recibido
- [ ] Los pedidos se marcan como pagados

---

### **PASO 11: Ver Movimientos en Caja** (PC - Tesorero)

**En**: `/tesoreria/movimientos`

- [ ] Ver los movimientos creados por la validación
- [ ] Verificar que los montos coincidan
- [ ] Ver totales por método de pago

**En**: `/tesoreria/cajas`

- [ ] Ver saldo actualizado de la caja
- [ ] Verificar que el saldo sea correcto

---

## 🔴 CHECKLIST RÁPIDO PRE-DEMO (Últimos 5 minutos)

### Datos Mínimos Necesarios:
- [ ] ✅ Al menos 2 clientes con zona asignada
- [ ] ✅ Al menos 2 productos con stock disponible
- [ ] ✅ Plan semanal creado para HOY + zona + turno tarde
- [ ] ✅ Vehículo activo en el sistema
- [ ] ✅ Caja central creada
- [ ] ✅ Usuario repartidor funcional

### Dispositivos:
- [ ] ✅ PC con sesión admin/vendedor iniciada
- [ ] ✅ Celular con sesión repartidor iniciada
- [ ] ✅ Permisos de ubicación habilitados en celular

### Verificación Rápida del Sistema:
- [ ] ✅ Servidor corriendo (`npm run dev`)
- [ ] ✅ No hay errores en la consola
- [ ] ✅ Las páginas cargan correctamente

---

## ⚠️ PROBLEMAS COMUNES Y SOLUCIONES RÁPIDAS

### Error: "No se pudo asignar el pedido a una ruta planificada"
**Solución**: 
- Verificar que existe un plan semanal para HOY + zona + turno
- Crear el plan en `/reparto/planificacion`

### Error: "El presupuesto tiene productos balanza que deben pesarse"
**Solución**:
- Ir a `/almacen/presupuesto/[id]/pesaje`
- Ingresar pesos reales de productos pesables

### Error: "Zona no asignada"
**Solución**:
- Editar el presupuesto y asignar zona
- O editar el cliente y asignar zona de entrega

### La ruta no aparece en el monitor GPS
**Solución**:
- Verificar que la ruta esté en estado `planificada` o `en_curso`
- Refrescar la página del monitor
- Verificar que el repartidor esté asignado

### El chofer no ve la ruta
**Solución**:
- Verificar que el usuario tenga rol `repartidor`
- Verificar que la ruta esté asignada al repartidor
- Verificar que esté accediendo desde `/repartidor/home`

---

## 📝 NOTAS PARA LA DEMO

### Horario Actual: 16:22 (viernes 5 de diciembre)

**⚠️ PROBLEMA CRÍTICO IDENTIFICADO**:

- **Después de las 15:00 (3 PM)**, el sistema automáticamente asigna turno "mañana" del día siguiente
- Si creas un presupuesto ahora (16:22), se asignará para **MAÑANA (sábado 6) - turno mañana**
- **El repartidor NO verá la ruta HOY, la verá mañana**

**✅ SOLUCIÓN PARA HACER LA DEMO HOY**:

1. **Crear presupuesto especificando manualmente**:
   - Fecha: Viernes 5 de diciembre (HOY)
   - Turno: Tarde
   - Verificar que NO se cambie a mañana

2. **O crear plan semanal para HOY + turno tarde** y forzar que el presupuesto use esa fecha

3. **Ver documento completo**: `SOLUCION_DEMO_HOY.md` para más detalles

**Día de la semana en PostgreSQL**: Viernes = 5 (0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado)

### Zona Horaria:
- El sistema usa: `America/Argentina/Buenos_Aires`
- Verifica que tu sistema tenga la hora correcta

### Productos Pesables:
- Los productos con categoría **BALANZA** requieren pesaje obligatorio
- Los productos sin esta categoría no requieren pesaje

### Optimización de Rutas:
- Se usa Google Directions API si está configurado
- Si no, usa algoritmo local (Nearest Neighbor + 2-opt)
- La optimización se hace automáticamente al asignar pedido a ruta

---

## ✅ ESTADO FINAL ESPERADO

Después de completar la demo, deberías poder ver:

1. ✅ Presupuesto creado y convertido a pedido
2. ✅ Pedido asignado a ruta planificada
3. ✅ Ruta optimizada con orden de clientes
4. ✅ Chofer ve la ruta en su celular
5. ✅ Chofer gestiona entregas y pagos
6. ✅ Ruta finalizada
7. ✅ Tesorero valida y el dinero va a la caja

---

## 🚀 COMANDO RÁPIDO PARA VERIFICAR TODO

```bash
# Verificar servidor
curl http://localhost:3000

# Verificar que compile
npm run build
```

---

**Última actualización**: 5 de diciembre, 2025 - 16:22

