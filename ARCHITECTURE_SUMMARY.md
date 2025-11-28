# 🏗️ Arquitectura del Sistema - Avícola del Sur ERP

## 📋 TL;DR (Resumen Ejecutivo)

Sistema ERP modular completo para Avícola del Sur que unifica Almacén (WMS), Ventas (CRM), Reparto (TMS) y Tesorería en una única fuente de verdad con Supabase. Incluye bot de WhatsApp automatizado para pedidos, PWA móvil para repartidores con GPS tracking, planificación semanal de rutas, optimización automática con Google Directions + fallback local, sistema de listas de precios con margen de ganancia automático, y arquitectura server-side con Next.js 15, React 19, TypeScript y Server Actions. Implementa FIFO automático, RLS completo, validaciones atómicas y trazabilidad total desde ingreso hasta entrega.

**Estado actual**: ✅ **COMPLETO Y FUNCIONAL** - Sistema integral con todos los módulos activos: Ventas, Reparto, Almacén, Tesorería y RRHH. Flujo end-to-end automatizado y en producción.

## 🛠️ Tecnologías Principales

- **Framework**: Next.js 15 (App Router, Server Components)
- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Server Actions + Supabase (Postgres + Auth + Storage + Realtime)
- **Estado**: Zustand (solo estado global: sesión, notificaciones)
- **Formularios**: React Hook Form + Zod validation
- **Tablas**: TanStack Table (paginación, filtros, sorting)
- **Mapas**: Google Maps JavaScript API (ubicaciones clientes) + Leaflet + OpenStreetMap (GPS tracking)
- **Chatbot**: Twilio WhatsApp (sin Botpress - implementación directa)
- **PDF/Reportes**: pdfkit + Supabase Storage
- **Calidad**: ESLint + Prettier + TypeScript strict

## 📁 Estructura de Carpetas (Alto Nivel)

```
src/
├── app/                          # Rutas Next.js (App Router)
│   ├── (admin)/                  # Dashboard administrativo
│   ├── (repartidor)/            # PWA móvil para repartidores
│   ├── api/                      # Endpoints API (bot, tesorería, etc.)
│   └── login/                    # Autenticación
├── actions/                      # Server Actions (lógica de negocio)
├── components/                   # Componentes React reutilizables
│   ├── ui/                       # shadcn/ui + componentes base
│   ├── forms/                    # Formularios con validación
│   ├── tables/                   # Tablas de datos con TanStack
│   └── layout/                   # Layouts admin/repartidor
├── lib/                          # Utilidades y configuración
│   ├── supabase/                 # Clientes Supabase (client/server)
│   ├── schemas/                  # Validaciones Zod
│   └── utils.ts                  # Helpers generales
├── store/                        # Zustand (estado global mínimo)
└── types/                        # TypeScript types (database, domain, api)

supabase/                         # Scripts SQL y migraciones
├── migrations/                   # Historial de cambios BD
└── *.sql                         # Funciones RPC y setup
```

## 🔄 Flujo Principal del Sistema (Pasos)

### **Flujo Automático Completo**:
1. **Planificación semanal** → Admin configura rutas por zona/día/turno/vehículo
2. **Cliente contacta** → Bot WhatsApp recibe pedido o vendedor crea presupuesto
3. **Validación stock** → Consulta lotes disponibles (FIFO automático)
4. **Creación pedido** → fn_convertir_presupuesto_a_pedido() (atómica)
5. **Turno automático** → Si no definido, asigna mañana (<06:00) o tarde (≥06:00)
6. **Asignación automática** → fn_asignar_pedido_a_ruta() busca ruta planificada por zona/turno/día
7. **Validación capacidad** → Verifica peso final ≤ capacidad vehículo planificada
8. **Descuento stock** → Actualiza lotes con FIFO y reservas consumidas
9. **Generación referencia** → PAY-YYYYMMDD-XXXXXX para pagos diferidos
10. **Optimización ruta** → Google Directions o fallback local genera orden visita + polyline
11. **Notificación admin** → Dashboard recibe alerta de nuevo pedido asignado
12. **Preparación almacén** → Almacenista pesa productos balanza, actualiza pesos finales
13. **Reparto asignación** → PWA repartidor recibe hoja ruta con GPS tracking
14. **Entrega** → Firma digital + QR verificación + registro cobro
15. **Cobro automático** → Actualización cuentas corrientes + caja en tiempo real
16. **Conciliación** → Reportes CSV/PDF de movimientos y rutas

## 🔑 12 Puntos Clave del Diseño y Comportamiento

1. **Single Source of Truth**: Todo gira alrededor de Supabase como BD central
2. **Server-Side First**: Server Actions manejan toda lógica crítica, validaciones y operaciones atómicas
3. **Planificación Semanal**: Rutas se definen por semana (zona/día/turno/vehículo) y pedidos se asignan automáticamente
4. **Turnos Automáticos**: Pedidos sin turno definido lo heredan según hora de confirmación (<05:00 mañana mismo día, 05:00-15:00 tarde mismo día, ≥15:00 mañana día siguiente)
5. **Asignación Automática**: fn_asignar_pedido_a_ruta() busca rutas planificadas y valida capacidad por peso final
6. **FIFO Automático**: Sistema de lotes con descuento automático del más antiguo primero
7. **RLS Estricto**: Cada tabla tiene Row Level Security por roles (admin, vendedor, repartidor, almacenista)
8. **Validación Preventiva**: Clientes bloqueados por deuda no pueden crear pedidos
9. **Operaciones Atómicas**: Todas las transacciones críticas usan RPCs de Postgres
10. **Trazabilidad Completa**: Desde lote específico usado hasta firma digital de entrega
11. **Referencias de Pago**: Generación automática con formato PAY-YYYYMMDD-XXXXXX
12. **PWA Mobile-First**: Repartidores tienen app nativa-like con GPS tracking y optimización de rutas

## 📦 Descripción Breve de Cada Módulo Importante

### 🔄 **Flujo Core**: Pedidos desde WhatsApp
- **Bot Twilio**: Procesa comandos naturales, valida stock en tiempo real
- **Server Action**: crearPedidoBot() → fn_crear_pedido_bot() RPC
- **FIFO Automático**: Descuento de lotes ordenados por vencimiento/ingreso
- **Referencias**: Genera PAY-XXXXXX para seguimiento de pagos

### 🏭 **Almacén (WMS)**: Control de Inventario
- **Lotes**: Trazabilidad completa con fechas vencimiento/proveedor
- **Stock FIFO**: Consulta y descuento automático del lote más antiguo
- **Checklists**: Control calidad obligatorio antes de salida
- **Picking**: Optimización de preparación de pedidos

### 💰 **Ventas (CRM)**: Gestión de Clientes y Pedidos
- **Clientes**: Con zonas entrega, límites crédito, bloqueo automático, listas de precios asignadas
- **Pedidos**: Desde web/bot, con estados completos y referencias pago
- **Cotizaciones**: Conversión automática a pedidos aprobados
- **Reclamos**: Seguimiento con estados y asignación
- **Listas de Precios**: Sistema completo con listas base (minorista, mayorista, distribuidor), asignación automática por tipo_cliente, margen de ganancia configurable, precios manuales por producto, selección en presupuestos

### 🗺️ **Google Maps Integration**: Selección de Ubicaciones
- **Maps JavaScript API**: Selector interactivo en formularios de clientes
- **Places API**: Autocompletado inteligente de direcciones
- **Geocoding**: Conversión coordenadas ↔ direcciones
- **Ubicación por Defecto**: Monteros, Tucumán (zona de operación)
- **Fallback Inteligente**: Campo manual si API falla
- **Diagnóstico Avanzado**: Páginas de debugging para troubleshooting

### 🚛 **Reparto (TMS)**: Logística y Entregas
- **Planificación Semanal**: Rutas fijas por zona/día/turno/vehículo con capacidad definida
- **Vehículos Base**: Fiorino (600kg), Hilux (1500kg), F-4000 (4000kg) precargados
- **Asignación Automática**: Pedidos se asignan a rutas planificadas según zona/turno/día
- **Optimización de Rutas**: Google Directions API con fallback local (Nearest Neighbor + 2-opt)
- **GPS Tracking**: PWA móvil envía ubicación cada 5s durante reparto activo
- **Alertas Automáticas**: Desvío (>200m) y cliente saltado (<100m sin entrega)
- **PWA Móvil**: Hoja ruta digital con GPS, entregas y registro de pagos
- **Registro de Pagos**: Repartidores registran estado de pago (Ya pagó/Pendiente/Pagará después) durante la ruta
- **Validación de Cobros**: Sistema de validación donde tesorero verifica y acredita cobros antes de afectar caja
- **Firma Digital**: Verificación con QR y subida automática a Supabase Storage

### 💵 **Tesorería**: Control Financiero
- **Cajas**: Por sucursal con saldos iniciales/actuales
- **Movimientos**: Ingresos/egresos ligados a pedidos/gastos
- **Cuentas Corrientes**: Control saldos y límites por cliente
- **Validación de Cobros**: Repartidores registran pagos durante ruta, tesorero valida antes de acreditar en caja
- **Página de Validación**: `/tesoreria/validar-rutas` para revisar y validar rutas completadas
- **Reportes**: CSV/PDF export con pdfkit

### 👥 **RRHH (Recursos Humanos)**: Gestión de Personal
- **Empleados**: CRUD completo con datos personales, laborales y bancarios
- **Asistencia**: Control diario con reglas críticas (1 falta sin aviso = pérdida presentismo + jornal)
- **Liquidaciones**: Cálculo automático mensual con horas extras, producción y descuentos
- **Adelantos**: Gestión de adelantos en dinero/productos con límite automático del 30% del sueldo básico
- **Licencias**: Gestión de vacaciones, enfermedad, maternidad, estudio
- **Evaluaciones**: Sistema de evaluación por sucursal con 5 criterios (1-5 escala)
- **Novedades**: Comunicación interna segmentada (general, sucursal, categoría)
- **Reportes**: 6 tipos de reportes exportables (Excel/CSV)
- **Rutas**: `/rrhh/empleados`, `/rrhh/asistencia`, `/rrhh/liquidaciones`, `/rrhh/adelantos`, `/rrhh/licencias`, `/rrhh/evaluaciones`, `/rrhh/novedades`, `/rrhh/reportes`

### 🤖 **Bot WhatsApp**: Automatización de Ventas
- **Sin Botpress**: Procesamiento directo en Next.js (más rápido/simple)
- **Comandos**: hola, 1(catalogo), 2(instrucciones), POLLO001 5, etc.
- **Validaciones**: Stock, horario, cliente registrado
- **Confirmación**: SÍ/NO explícito antes de crear pedido

### 🔐 **Autenticación**: Sistema de Roles
- **4 Roles**: admin(vendedor+almacen+reparto), vendedor, repartidor, almacenista
- **RLS**: Políticas por tabla/rol en Supabase
- **JWT**: Autenticación stateless con refresh automático

### 📊 **Reportes**: Business Intelligence
- **Formatos**: CSV (separado por ;) y PDF (profesional con paginación)
- **Módulos**: Ventas, gastos, movimientos caja, cuentas corrientes, rutas y entregas
- **Server-side**: Generación con pdfkit, descarga directa

### 🗓️ **Planificación Semanal**: Gestión de Rutas
- **Nueva tabla**: `plan_rutas_semanal` con zona/día/turno/vehículo/repartidor/capacidad
- **Vehículos fijos**: 3 modelos precargados (Fiorino 600kg, Hilux 1500kg, F-4000 4000kg)
- **UI de planificación**: `/reparto/planificacion` para crear/editar/eliminar planes semanales
- **Asignación automática**: Pedidos se asignan a rutas planificadas según zona/turno/día
- **Validación capacidad**: Peso final del pedido ≤ capacidad del vehículo planificada
- **RPC integrada**: `fn_asignar_pedido_a_ruta()` busca planes y valida restricciones

### 💵 **Sistema de Listas de Precios**: Gestión de Precios por Cliente
- **Tablas nuevas**: `listas_precios`, `precios_productos`, `clientes_listas_precios`
- **Listas base**: MINORISTA, MAYORISTA, DISTRIBUIDOR (asignación automática por tipo_cliente)
- **Asignación dual**: Cada cliente puede tener hasta 2 listas activas (1 automática + 1 manual)
- **Margen de ganancia**: Campo `margen_ganancia` en listas para cálculo automático desde `precio_costo`
- **Vigencia opcional**: Campo `vigencia_activa` (default: false). Si está activado, valida fechas de vigencia. Si está desactivado, la lista está siempre vigente desde que se modifica hasta que se actualice
- **Precios manuales**: Gestión individual de precios por producto en cada lista
- **Selección en presupuestos**: Vendedor elige qué lista usar al crear presupuestos
- **Bot integrado**: Usa automáticamente la primera lista asignada del cliente
- **RPC funciones**: `fn_obtener_precio_producto()`, `fn_asignar_lista_automatica_cliente()` (actualizada para validar vigencia), `fn_validar_listas_cliente()`
- **UI completa**: `/ventas/listas-precios` para CRUD de listas y gestión de precios por producto

---

## 🎯 Flujo Completo Automatizado Implementado

**Estado**: ✅ **COMPLETO Y FUNCIONAL** - Flujo end-to-end automático desde presupuesto hasta cobro

**Flujo automático**: `Plan Semanal → Bot WhatsApp/Vendedor → Presupuesto (Pendiente) → Turno Auto → Asignación Ruta → Almacén (Pesaje) → Pedido (Facturado) → Optimización Ruta → Reparto (GPS Tracking) → Entrega/Cobro → Tesorería (Tiempo Real)`

### **Fases Automáticas**:

#### **1. Planificación Semanal** (Previa)
- Admin configura rutas fijas: zona/día/turno/vehículo/capacidad
- Vehículos base: Fiorino (600kg), Hilux (1500kg), F-4000 (4000kg)
- UI: `/reparto/planificacion` para gestión completa

#### **2. Creación de Presupuestos** (Automática)
- **Bot WhatsApp**: Crea presupuestos, valida stock, reserva FIFO
- **Vendedor Web**: Crea presupuestos con selectores buscables (clientes y productos)
- **Asignación automática al crear**:
  - **Turno**: <05:00 mañana mismo día, 05:00-15:00 tarde mismo día, ≥15:00 mañana día siguiente
  - **Fecha entrega**: Automática según horario (editable)
  - **Estado**: 'en_almacen' (aparece automáticamente en Presupuestos del Día)
- **Asignación automática al convertir**: Si no tiene turno, se asigna con misma lógica
- **Asignación de ruta**: Busca ruta planificada por zona/turno/día, valida capacidad

#### **3. Procesamiento en Almacén** (Semi-automático)
- **Presupuestos del Día**: Vista filtrada por fecha/turno/zona
  - Presupuestos aparecen automáticamente al crearse
  - Conversión masiva: Todos los presupuestos visibles a pedidos
  - Conversión individual: Botón por presupuesto
- **Pesaje**: Obligatorio para productos "balanza"
  - Edición de pesos en tiempo real
  - Actualización automática de precios y totales
- **Pedidos del Día**: Gestión de pedidos (módulo movido a Almacén)
  - Filtros por fecha y turno
  - Generación de rutas diarias (automática y manual)
- **Conversión**: Reserva preventiva → descuento físico al convertir a pedido
- Revalidación de capacidad del vehículo con pesos finales

#### **4. Reparto con GPS** (Automático)
- **Optimización**: Google Directions API + fallback local (Nearest Neighbor + 2-opt)
- **PWA móvil**: Hoja ruta digital con GPS tracking cada 5s
- **Monitor admin**: Mapa Leaflet en tiempo real con polylíneas y alertas
- **Alertas**: Desvío (>200m) y cliente saltado (<100m sin entrega)

#### **5. Cobro y Conciliación** (Semi-automático con Validación)
- **Registro de pagos**: Repartidores registran estado de pago durante la ruta (Ya pagó/Pendiente/Pagará después)
- **Validación requerida**: Todas las entregas deben tener estado de pago definido antes de finalizar ruta
- **Validación tesorero**: Tesorero revisa rutas completadas, verifica montos y valida antes de acreditar en caja
- **Movimientos de caja**: Se crean solo tras validación del tesorero, agrupados por método de pago
- Referencias PAY-XXXXXX para seguimiento
- Reportes CSV/PDF de movimientos y rutas

### **Características Técnicas**:
- **Vehículos fijos**: 3 modelos con capacidades específicas
- **Planificación semanal**: Rutas predeterminadas por zona/día/turno
- **Validación de capacidad**: Peso final ≤ capacidad vehículo planificada
- **Turnos automáticos**: Basados en hora de confirmación Buenos Aires (5:00 AM y 15:00 como cortes)
- **GPS tracking**: Polling cada 5s durante reparto activo
- **Optimización híbrida**: Google Directions + fallback local robusto
- **Validación de cobros**: Sistema de doble verificación (repartidor registra, tesorero valida)
- **RLS completo**: Políticas por rol en todas las tablas
- **Operaciones atómicas**: Todas las transacciones críticas en RPCs

**Ver [`TESTING.md`](../TESTING.md) para guía completa de pruebas del flujo automático.**

---

## 🔧 **Actualizaciones Recientes**

### **Vigencia Opcional en Listas de Precios (07/12/2025)**
- ✅ **Campo `vigencia_activa`**: Nuevo campo BOOLEAN en tabla `listas_precios` (default: false)
- ✅ **Comportamiento por defecto**: Listas están siempre vigentes (sin validar fechas)
- ✅ **Validación condicional**: Si `vigencia_activa = true`, valida `fecha_vigencia_desde` y `fecha_vigencia_hasta`
- ✅ **UI actualizada**: Checkbox en formularios de crear/editar para activar/desactivar validación
- ✅ **Funciones SQL actualizadas**: `fn_asignar_lista_automatica_cliente()` valida vigencia solo si está activada
- ✅ **Actions actualizadas**: `obtenerListasPreciosAction()` y `obtenerListasClienteAction()` filtran por vigencia condicionalmente
- ✅ **Migraciones**: 
  - `20251207_agregar_vigencia_activa_listas_precios.sql` (agrega campo)
  - `20251207_actualizar_fn_asignar_lista_automatica_vigencia.sql` (actualiza función RPC)

### **Navegación del Sidebar Actualizada (03/12/2025)**
- ✅ **Agregado**: "Listas de Precios" al menú Ventas (`/ventas/listas-precios`)
- ✅ **Agregado**: "Facturas" al menú Ventas (`/ventas/facturas`)
- ✅ **Íconos**: Tag (🏷️) para Listas de Precios, Receipt (📄) para Facturas

### **Correcciones Técnicas - Listas de Precios (03/12/2025)**
- ✅ **Políticas RLS Simplificadas**: Eliminadas políticas complejas que causaban errores de permisos
- ✅ **Nueva migración**: `20251203_fix_rls_listas_precios.sql` con políticas simplificadas
- ✅ **Compatibilidad Next.js 15**: Actualizadas páginas dinámicas para usar `await params`
- ✅ **Validación de UUID**: Agregada validación de IDs antes de consultas a BD
- ✅ **Manejo de Errores Mejorado**: Logging detallado para diagnóstico de problemas

### **Estructura de Navegación Completa**
```
🏠 Dashboard
📦 Almacén
  ├── Productos
  ├── Lotes
  ├── Presupuestos del Día
  ├── Pedidos
  └── Recepción

🛒 Ventas
  ├── Presupuestos
  ├── Clientes
  ├── Listas de Precios ✅
  └── Facturas ✅

🚚 Reparto
  ├── Planificación semanal
  ├── Rutas
  ├── Monitor GPS
  └── Vehículos

💰 Tesorería
  ├── Cajas
  ├── Movimientos
  ├── Validar rutas
  ├── Cierres de Caja
  ├── Tesoro
  └── Gastos

👥 RRHH
  ├── Empleados
  ├── Asistencia
  ├── Liquidaciones
  ├── Adelantos
  ├── Licencias
  ├── Evaluaciones
  ├── Novedades
  └── Reportes

📊 Reportes
```

### **Problemas Resueltos**
1. **Error de búsqueda de clientes**: Agregado campo `codigo` faltante en consulta de clientes
2. **Errores en Listas de Precios**: Políticas RLS simplificadas y compatibilidad Next.js 15
3. **Navegación incompleta**: Agregados módulos faltantes al sidebar
4. **Google Maps no funcionaba**: Implementado sistema completo de selección de ubicaciones con Maps JavaScript API

---

*Resumen actualizado el 28/11/2025 - Google Maps implementado para selección de ubicaciones de clientes*
