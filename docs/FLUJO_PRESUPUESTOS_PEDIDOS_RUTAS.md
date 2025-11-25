# Flujo Completo: Presupuestos → Pedidos → Rutas Diarias

**Última actualización**: Noviembre 2025  
**Estado**: ✅ Implementado y Verificado

## 📋 Resumen Ejecutivo

Sistema completo de gestión de presupuestos que transforma el proceso operativo desde la creación hasta la entrega, con asignación automática de turnos, fechas y estados, optimización de rutas y trazabilidad completa.

## 🔄 Flujo Operativo Completo

### 1. Creación de Presupuestos

#### Por Bot WhatsApp
```
Cliente envía: "POLLO001 5"
↓
Bot valida stock → fn_crear_presupuesto_desde_bot()
↓
Asignación automática:
- Turno: según horario de corte
- Fecha entrega: automática
- Estado: 'en_almacen'
↓
Reserva preventiva de stock (FIFO)
↓
Respuesta: "Presupuesto PRES-YYYYMMDD-XXXX creado"
```

#### Por Vendedor (Web)
```
Vendedor → /ventas/presupuestos/nuevo
↓
Formulario con:
- Selector de clientes buscable (nombre, teléfono, zona)
- Selector de productos buscable (código, nombre)
- Fecha de entrega: automática (hoy), editable
- Zona: opcional (se detecta del cliente si existe)
↓
Crear Presupuesto
↓
Asignación automática (misma lógica que bot):
- Turno: según horario de corte
- Fecha entrega: automática
- Estado: 'en_almacen'
↓
Presupuesto aparece automáticamente en "Presupuestos del Día"
```

### 2. Horarios de Corte Automáticos

El sistema asigna turno y fecha automáticamente según la hora de creación:

| Hora de Creación | Turno Asignado | Fecha de Entrega |
|-----------------|----------------|------------------|
| Antes de 5:00 AM | Mañana | Mismo día |
| 5:00 AM - 3:00 PM | Tarde | Mismo día |
| Después de 3:00 PM | Mañana | Día siguiente |

**Zona horaria**: America/Argentina/Buenos_Aires

### 3. Presupuestos del Día (Almacén)

```
/almacen/presupuestos-dia
↓
Filtros disponibles:
- Fecha (default: hoy)
- Zona
- Turno (mañana/tarde)
↓
Vista muestra:
- Total de presupuestos del día
- Total de kg estimados
- Lista de presupuestos con:
  - Número de presupuesto
  - Cliente
  - Zona y turno
  - Items con badge "BALANZA" si aplica
  - Botón "Pasar a Pedido" individual
↓
Botón "Pasar a Pedidos del Día" (masivo):
- Convierte todos los presupuestos visibles
- Muestra confirmación con cantidad
- Valida que todos tengan turno y zona
```

### 4. Pesaje de Productos Balanza

```
Presupuesto con productos balanza → /almacen/presupuesto/[id]/pesaje
↓
Interfaz de pesaje:
- Lista de items pesables
- Campo de peso editable por item
- Actualización en tiempo real
↓
Actualizar peso → actualizarPesoItemAction()
↓
Recálculo automático:
- Precio final = precio unitario × peso final
- Subtotal final actualizado
- Total del presupuesto actualizado
```

### 5. Conversión a Pedidos

#### Conversión Individual
```
Presupuesto del Día → Botón "Pasar a Pedido"
↓
confirmarPresupuestoAction()
↓
Validaciones:
- Presupuesto debe tener zona asignada
- Si tiene productos balanza, deben estar pesados
↓
fn_convertir_presupuesto_a_pedido()
↓
- Asigna turno automáticamente si no existe
- Crea pedido en estado 'preparando'
- Descuenta stock físico (FIFO)
- Actualiza presupuesto a estado 'facturado'
↓
Redirige a /almacen/pedidos/[id]
```

#### Conversión Masiva
```
Presupuestos del Día → Botón "Pasar a Pedidos del Día"
↓
Confirmación con cantidad de presupuestos
↓
Procesa cada presupuesto:
- Misma validación que individual
- Muestra progreso
- Errores individuales no detienen el proceso
↓
Todos los pedidos creados aparecen en /almacen/pedidos
```

### 6. Gestión de Pedidos (Almacén)

```
/almacen/pedidos
↓
Filtros:
- Fecha (default: hoy)
- Turno (mañana/tarde/todos)
↓
Vista muestra:
- Lista de pedidos del turno seleccionado
- Estado: preparando, en_ruta, entregado, cancelado
- Información de cliente, zona, turno
↓
Botón "Pasar a Ruta Diaria":
- Opción Automática: Genera rutas para todos los pedidos del turno
- Opción Manual: Selecciona pedidos específicos
```

### 7. Generación de Rutas Diarias

#### Automática
```
Pedidos → "Pasar a Ruta Diaria" → Automática
↓
generarRutaDiariaAutomatica(fecha, turno)
↓
- Obtiene pedidos en estado 'preparando' del turno/fecha
- Agrupa por zona
- Crea rutas automáticas por zona
- Asigna vehículos según capacidad
- Genera optimización de ruta (Google Maps + fallback)
↓
Rutas creadas disponibles en /reparto/rutas
```

#### Manual
```
Pedidos → "Pasar a Ruta Diaria" → Manual
↓
Modal de selección:
- Lista de pedidos disponibles (filtrados por turno)
- Checkboxes para seleccionar
- Resumen: total pedidos, peso estimado, zona
↓
Validaciones:
- Todos deben ser del mismo turno
- Todos deben ser de la misma zona
↓
generarRutaDiariaManual(pedidosIds, fecha, zona_id, turno)
↓
- Crea ruta con pedidos seleccionados
- Asigna vehículo según peso total
- Genera optimización de ruta
```

## 🗄️ Estructura de Datos

### Tabla `presupuestos`
```sql
- id: UUID
- numero_presupuesto: VARCHAR(50) UNIQUE
- cliente_id: UUID
- zona_id: UUID
- estado: 'pendiente' | 'en_almacen' | 'facturado' | 'anulado'
- turno: 'mañana' | 'tarde' (asignado automáticamente)
- fecha_entrega_estimada: DATE (asignada automáticamente)
- total_estimado: DECIMAL(10,2)
- total_final: DECIMAL(10,2)
- observaciones: TEXT
- usuario_vendedor: UUID
- usuario_almacen: UUID
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Tabla `presupuesto_items`
```sql
- id: UUID
- presupuesto_id: UUID
- producto_id: UUID
- cantidad_solicitada: DECIMAL(10,3)
- cantidad_reservada: DECIMAL(10,3)
- precio_unit_est: DECIMAL(10,2)
- precio_unit_final: DECIMAL(10,2)
- pesable: BOOLEAN (true si categoría = 'BALANZA')
- peso_final: DECIMAL(10,3)
- subtotal_est: DECIMAL(10,2)
- subtotal_final: DECIMAL(10,2)
```

## 🔧 Funciones RPC Principales

### `fn_crear_presupuesto_desde_bot()`
**Parámetros:**
- `p_cliente_id`: UUID
- `p_items`: JSONB (array de {producto_id, cantidad, precio_unitario})
- `p_observaciones`: TEXT (opcional)
- `p_zona_id`: UUID (opcional)
- `p_fecha_entrega_estimada`: DATE (opcional)

**Lógica:**
1. Detecta zona del cliente si no se proporciona
2. Determina turno según horario de corte
3. Determina fecha de entrega según horario
4. Crea presupuesto en estado `'en_almacen'`
5. Procesa items y marca como pesables si categoría = 'BALANZA'
6. Reserva stock preventivo (FIFO)

**Retorna:**
```json
{
  "success": true,
  "presupuesto_id": "uuid",
  "numero_presupuesto": "PRES-YYYYMMDD-XXXX",
  "total_estimado": 1234.56,
  "turno": "mañana" | "tarde",
  "fecha_entrega_estimada": "2025-12-01",
  "reserva_result": {...}
}
```

### `fn_convertir_presupuesto_a_pedido()`
**Parámetros:**
- `p_presupuesto_id`: UUID
- `p_user_id`: UUID
- `p_caja_id`: UUID (opcional)

**Lógica:**
1. Valida que presupuesto esté en estado válido
2. Valida que tenga zona asignada
3. Asigna turno automáticamente si no existe (misma lógica que creación)
4. Valida que productos balanza estén pesados
5. Crea pedido en estado 'preparando'
6. Descuenta stock físico (FIFO)
7. Actualiza presupuesto a estado 'facturado'

## 🎨 Interfaz de Usuario

### Módulo Ventas
- **`/ventas/presupuestos`**: Lista completa de presupuestos
- **`/ventas/presupuestos/nuevo`**: Formulario de creación
  - Selector de clientes buscable
  - Selector de productos buscable
  - Fecha automática (editable)
- **`/ventas/presupuestos/[id]`**: Detalle del presupuesto
- **`/ventas/presupuestos/[id]/editar`**: Edición de presupuesto

### Módulo Almacén
- **`/almacen/presupuestos-dia`**: Presupuestos del día
  - Filtros: fecha, zona, turno
  - Conversión masiva e individual
- **`/almacen/presupuesto/[id]/pesaje`**: Interfaz de pesaje
- **`/almacen/pedidos`**: Gestión de pedidos
  - Filtros: fecha, turno
  - Generación de rutas diarias
- **`/almacen/pedidos/[id]`**: Detalle del pedido

## 🔍 Características Técnicas

### Asignación Automática de Turno
- Se aplica tanto al crear presupuesto como al convertir a pedido
- Basado en hora local de Buenos Aires
- Horarios de corte: 5:00 AM y 3:00 PM

### Estado Automático
- Presupuestos se crean en estado `'en_almacen'`
- Aparecen automáticamente en "Presupuestos del Día"
- No requiere acción manual de "enviar a almacén"

### Selectores Buscables
- Implementados con campo de búsqueda dentro del dropdown
- Filtrado en tiempo real
- Búsqueda por múltiples campos (código, nombre, teléfono, zona)

### Next.js 16 Compatibility
- Todos los `params` se manejan como Promise con `await`
- Correcciones aplicadas en todas las páginas dinámicas `[id]`

## 📝 Notas de Implementación

### Migraciones SQL
- `20251130_asignar_turno_auto_presupuesto.sql`: Asignación automática de turno
- `20251130_fix_turno_column.sql`: Asegura que columna `turno` existe

### Cambios en Estructura
- Módulo Pedidos movido de `/ventas/pedidos` a `/almacen/pedidos`
- Sidebar actualizado para reflejar nueva ubicación
- Todas las referencias internas actualizadas

### Validaciones
- Presupuesto debe tener zona antes de convertir a pedido
- Productos balanza deben estar pesados antes de convertir
- Pedidos deben tener turno y zona antes de generar ruta
- Validación de capacidad de vehículo antes de asignar pedidos

## 🧪 Pruebas Recomendadas

1. **Crear presupuesto manual**: Verificar turno y fecha automáticos
2. **Crear presupuesto por bot**: Verificar misma lógica
3. **Ver en Presupuestos del Día**: Debe aparecer automáticamente
4. **Pesaje**: Editar pesos y verificar recálculo
5. **Conversión individual**: Convertir un presupuesto a pedido
6. **Conversión masiva**: Convertir múltiples presupuestos
7. **Generar ruta automática**: Desde módulo de pedidos
8. **Generar ruta manual**: Seleccionar pedidos específicos

