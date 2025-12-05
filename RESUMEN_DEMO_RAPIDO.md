# ⚡ RESUMEN RÁPIDO - Demo del Viernes 5 de Diciembre (16:22)

## 🎯 LO MÁS IMPORTANTE (Hacer PRIMERO)

### ✅ Checklist Ultra-Rápido (5 minutos)

1. **📅 PLAN SEMANAL** (CRÍTICO - SIN ESTO NO FUNCIONA)
   - Ir a: `/reparto/planificacion`
   - Crear plan para:
     - **Día**: Viernes (día 5 en la semana: 0=Domingo, 1=Lunes... 5=Viernes)
     - **Zona**: La misma que tus clientes (ej: "Norte", "Centro")
     - **Turno**: **Tarde** (ya que son las 16:22)
     - **Vehículo**: Seleccionar uno (ej: Fiorino, Hilux, F-4000)
     - **Repartidor**: Asignar usuario repartidor (opcional)

2. **👥 CLIENTES**
   - Mínimo 2 clientes con zona asignada
   - Verificar en: `/ventas/clientes`

3. **📦 PRODUCTOS Y STOCK**
   - Al menos 2 productos (1 pesable, 1 no pesable)
   - Stock disponible en lotes
   - Verificar en: `/almacen/productos` y `/almacen/lotes`

4. **🚗 VEHÍCULO**
   - Al menos 1 vehículo activo
   - Verificar en: `/reparto/vehiculos`

5. **💰 CAJA**
   - Caja central creada
   - Verificar en: `/tesoreria/cajas`

6. **👤 USUARIOS**
   - Admin iniciado en PC
   - Repartidor iniciado en celular

---

## 📱 DISPOSITIVOS

- **PC**: Sesión admin/vendedor en `http://localhost:3000`
- **Celular**: Sesión repartidor (permisos de ubicación activados)

---

## 🔄 FLUJO EN 11 PASOS

### 1️⃣ Crear Presupuesto (PC)
   - `/ventas/presupuestos/nuevo`
   - Cliente + productos + zona + fecha HOY
   - ✅ Estado debe quedar: `en_almacen`

### 2️⃣ Ver en Presupuestos del Día (PC)
   - `/almacen/presupuestos-dia`
   - Filtro: HOY + Tarde + Zona
   - ✅ Debe aparecer el presupuesto

### 3️⃣ Pesaje (PC) - Si hay productos pesables
   - `/almacen/presupuesto/[id]/pesaje`
   - Ingresar peso real
   - ✅ Precio se recalcula automáticamente

### 4️⃣ Convertir a Pedido (PC)
   - Desde `/almacen/presupuestos-dia`
   - Click "Pasar a Pedido"
   - ✅ Estado: `facturado` → Pedido `preparando`

### 5️⃣ Pasar a Ruta (PC) ⭐ NUEVO
   - **Opción A**: `/almacen/pedidos` → menú acciones → "Pasar a ruta"
   - **Opción B**: `/almacen/pedidos/[id]` → botón "Pasar a Ruta"
   - ✅ Mensaje: "Pedido asignado a ruta exitosamente"

### 6️⃣ Ver Ruta (PC)
   - `/reparto/rutas` → buscar ruta del día
   - `/reparto/monitor` → ver mapa con ruta optimizada
   - ✅ Ruta con orden optimizado de clientes

### 7️⃣ Chofer Ve la Ruta (Celular)
   - `/repartidor/home` → rutas activas
   - `/repartidor/ruta/[ruta_id]` → hoja de ruta
   - ✅ Lista de entregas ordenadas

### 8️⃣ Gestionar Entregas (Celular)
   - `/repartidor/ruta/[ruta_id]/entrega/[entrega_id]`
   - Ver productos → Registrar pago → Marcar entregado
   - ✅ Información se guarda correctamente

### 9️⃣ Finalizar Ruta (Celular)
   - Desde `/repartidor/ruta/[ruta_id]`
   - Click "Finalizar Ruta"
   - ✅ Estado: `completada`

### 🔟 Validar en Tesorería (PC)
   - `/tesoreria/validar-rutas`
   - Ver resumen → Ingresar monto físico → Validar
   - ✅ Movimientos de caja creados

### 1️⃣1️⃣ Ver Movimientos (PC)
   - `/tesoreria/movimientos` → Ver movimientos
   - `/tesoreria/cajas` → Ver saldo actualizado
   - ✅ Todo correcto

---

## ⚠️ PROBLEMAS COMUNES

| Problema | Solución |
|----------|----------|
| "No hay ruta planificada" | Crear plan en `/reparto/planificacion` |
| "Zona no asignada" | Editar cliente/presupuesto y asignar zona |
| "Productos balanza deben pesarse" | Ir a `/almacen/presupuesto/[id]/pesaje` |
| Chofer no ve la ruta | Verificar rol `repartidor` y que ruta esté asignada |

---

## 🎯 DÍA DE LA SEMANA PARA PLAN

**Viernes = día 5** (en PostgreSQL: 0=Domingo, 1=Lunes... 5=Viernes)

Al crear el plan semanal, seleccionar **Viernes** o **día 5**.

---

## 📝 NOTAS IMPORTANTES

- **Hora actual**: 16:22 → **⚠️ PROBLEMA**: Después de las 15:00, el sistema asigna turno "mañana" del día siguiente
- **Fecha**: Viernes 5 de diciembre, 2025
- **Turno automático**: Si creas presupuesto ahora sin especificar, se asignará para MAÑANA (sábado 6) - turno mañana
- **✅ SOLUCIÓN**: Forzar fecha HOY + turno tarde manualmente al crear presupuesto
- **Zona**: Debe coincidir con el plan semanal
- **Optimización**: Se hace automáticamente al pasar a ruta

**Ver `SOLUCION_DEMO_HOY.md` para solución completa**

---

## ✅ VERIFICACIÓN FINAL

Antes de empezar, asegúrate de tener:

- [ ] ✅ Plan semanal para Viernes + Tarde + Zona
- [ ] ✅ Al menos 2 clientes con zona
- [ ] ✅ Al menos 2 productos con stock
- [ ] ✅ Vehículo activo
- [ ] ✅ Caja central
- [ ] ✅ Admin en PC
- [ ] ✅ Repartidor en celular
- [ ] ✅ Servidor corriendo

---

**🚀 ¡Listo para empezar la demo!**

Para más detalles, ver `CHECKLIST_DEMO.md`

