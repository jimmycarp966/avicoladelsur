# 🏗️ Arquitectura del Sistema - Avícola del Sur ERP

## 📋 TL;DR (Resumen Ejecutivo)

Sistema ERP modular completo para Avícola del Sur que unifica Almacén (WMS), Ventas (CRM), Reparto (TMS), Tesorería y Sucursales en una única fuente de verdad con Supabase. Incluye bot de WhatsApp automatizado para pedidos, PWA móvil para repartidores con GPS tracking, planificación semanal de rutas, optimización automática con Google Directions + fallback local, sistema de listas de precios con margen de ganancia automático, gestión multi-sucursal con inventario distribuido y alertas de stock automático, y arquitectura server-side con Next.js 15, React 19, TypeScript y Server Actions. Implementa FIFO automático, RLS completo, validaciones atómicas y trazabilidad total desde ingreso hasta entrega.

**Estado actual**: ✅ **COMPLETO Y FUNCIONAL** - Sistema integral con todos los módulos activos: Ventas, Reparto, Almacén, Tesorería, RRHH y Sucursales. Flujo end-to-end automatizado y en producción.

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
7. **RLS Estricto**: Cada tabla tiene Row Level Security por roles (admin, vendedor, encargado_sucursal, repartidor, almacenista, tesorero)
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

### 🎯 **Modelo de Pedidos Agrupados por Turno/Zona/Fecha**
- **Nueva tabla**: `entregas` - cada entrega representa cliente individual dentro pedido
- **Pedido = Ruta**: Un pedido agrupa múltiples entregas del mismo turno/zona/fecha
- **Cierre automático**: Pedidos se cierran cuando pasa horario de corte (5:00 AM / 15:00)
- **Funciones RPC**: `fn_obtener_o_crear_pedido_abierto()`, `fn_agregar_presupuesto_a_pedido()`
- **Agrupación automática**: Conversión agrupa presupuestos por turno/zona/fecha
- **Cobros individuales**: Cada entrega tiene estado de pago independiente
- **Cuenta corriente**: Actualización individual por cliente en tiempo real

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
- **Generación de Datos Mock**: Sistema completo para crear datos de prueba (rutas, clientes, GPS) para testing del monitor GPS, optimizado para Vercel Free (10s timeout) con logs detallados
- **Monitor GPS Avanzado**: Panel lateral con números clickeables de clientes, modal de vista previa con información completa (cliente y productos), números cambian de color según estado (negro: entregado y cobrado, gris: solo entregado)
- **Visualización Mejorada**: RutasTable muestra nombre/apellido del repartidor y patente/marca/modelo del vehículo (no IDs)
- **Cálculo Automático de Peso**: Trigger SQL recalcula `peso_total_kg` automáticamente al modificar pedidos en la ruta
- **Sincronización de Métricas**: Al optimizar ruta, se actualizan `distancia_estimada_km` y `tiempo_estimado_min` en `rutas_reparto`
- **Obtención de Clientes Mejorada**: Sistema obtiene clientes desde `entregas` cuando pedido no tiene `cliente_id` (modelo agrupado)
- **Conversión PostGIS**: Función mejorada para convertir coordenadas PostGIS (GeoJSON Point) a formato `{lat, lng}` para mapas
- **Flujo de Iniciar Ruta**: Pedidos "Enviados" desde almacén crean rutas con estado `'en_curso'` automáticamente, visibles inmediatamente para repartidor

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

### 🏢 **Sucursales**: Gestión Multi-Sucursal
- **Sucursales**: CRUD completo con configuración individual (umbrales stock, cajas)
- **Inventario Distribuido**: Control de stock por sucursal con catálogo central compartido
- **Alertas Automáticas**: Sistema de alertas de stock bajo configurable por sucursal
- **Tesorería por Sucursal**: Cajas independientes con movimientos automáticos
- **Transferencias**: Solicitudes de envío entre sucursales con trazabilidad
- **Reportes Consolidados**: Vista unificada admin + vistas específicas por sucursal
- **RLS Estricto**: Usuarios ven solo datos de su sucursal asignada
- **Dashboard Sucursal**: Métricas específicas, inventario, ventas y alertas en tiempo real
- **Redirección Automática**: Usuarios con sucursal asignada son redirigidos automáticamente al dashboard de su sucursal al iniciar sesión
- **Asignación de Usuarios**: Los usuarios se asignan a sucursales mediante la tabla `rrhh_empleados` (campo `sucursal_id`)
- **Función Helper**: `getSucursalUsuario()` obtiene la sucursal del usuario desde `rrhh_empleados` con soporte RLS
- **Rutas**: `/sucursales` (admin), `/sucursal/dashboard`, `/sucursal/alerts`, `/sucursal/inventario`, `/sucursal/ventas`, `/sucursal/tesoreria`, `/sucursal/reportes`

### 🤖 **Bot WhatsApp**: Automatización de Ventas
- **Sin Botpress**: Procesamiento directo en Next.js (más rápido/simple)
- **Comandos**: hola, 1(catalogo), 2(instrucciones), POLLO001 5, etc.
- **Validaciones**: Stock, horario, cliente registrado
- **Confirmación**: SÍ/NO explícito antes de crear pedido

### 🔐 **Autenticación**: Sistema de Roles
- **5 Roles principales**: admin (acceso completo), vendedor (casa central - ventas y presupuestos), encargado_sucursal (sucursales - gestión local), repartidor (PWA móvil), almacenista (almacén central)
- **Roles adicionales**: tesorero (tesorería central)
- **RLS**: Políticas por tabla/rol en Supabase
- **JWT**: Autenticación stateless con refresh automático
- **Redirección Inteligente**: Usuarios con sucursal asignada son redirigidos automáticamente a `/sucursal/dashboard` al iniciar sesión
- **Asignación de Sucursales**: Usuarios vinculados a empleados en `rrhh_empleados` con `sucursal_id` asignado
- **Políticas RLS**: Usuarios pueden leer su propio registro en `rrhh_empleados` para obtener su sucursal asignada

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

### 📦 **Configuración de Productos Mayoristas**: Unidad y Peso Personalizados
- **Unidad Mayor Personalizada**: Cada producto puede configurar su propia unidad mayor (`unidad_mayor_nombre`: "caja", "bolsa", "pallet", etc.) en lugar de usar valores hardcodeados
- **Peso por Unidad Mayor Configurable**: Cada producto define su propio `kg_por_unidad_mayor` (no todos son 20 kg por defecto)
- **Visualización Consistente**: El sistema muestra la unidad y peso configurados en cada producto en todos los lugares (presupuestos, pesaje, rutas, monitor GPS)
- **Sin Fallbacks Incorrectos**: Eliminados todos los fallbacks hardcodeados (`|| 'caja'`, `|| 20`). El sistema usa solo los valores configurados en cada producto
- **Validación de Cálculos**: Los cálculos de `solicitadoKg` y `reservadoKg` solo se ejecutan cuando `kg_por_unidad_mayor` está configurado, evitando valores `NaN`
- **Pluralización Inteligente**: Muestra "1 caja" o "2 caja(s)" según corresponda

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
  - Botón "Pasar a Ruta" individual desde tabla o detalle del pedido
  - Generación de rutas diarias (automática y manual)
  - Optimización automática del orden de clientes al asignar a ruta
- **Conversión**: Reserva preventiva → descuento físico al convertir a pedido
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

### **Redirección Automática a Dashboard de Sucursal (Enero 2025)**
- ✅ **Redirección Inteligente**: Usuarios con sucursal asignada en `rrhh_empleados` son redirigidos automáticamente a `/sucursal/dashboard` al iniciar sesión
- ✅ **Verificación Automática**: El sistema verifica la sucursal asignada durante el proceso de login
- ✅ **Política RLS**: Agregada política `empleados_read_own` que permite a usuarios leer su propio registro en `rrhh_empleados` para obtener su `sucursal_id`
- ✅ **Función Helper Mejorada**: `getSucursalUsuario()` usa `maybeSingle()` para manejar mejor casos sin registro
- ✅ **Migración SQL**: `20250101_fix_rls_rrhh_empleados_lectura.sql` agrega la política necesaria para lectura de empleados
- ✅ **Integración Completa**: Funciona tanto en Server Actions (`auth.actions.ts`) como en Client Components (`AuthProvider.tsx`)
- ✅ **Fallback Inteligente**: Si no tiene sucursal asignada, redirige según rol (admin → `/dashboard`, vendedor → `/almacen/pedidos`, encargado_sucursal → `/sucursal/dashboard`, etc.)
- ✅ **Separación de Roles**: Usuarios con `sucursal_id` en `rrhh_empleados` tienen rol `encargado_sucursal` (migración automática desde `vendedor`), mientras que vendedores de casa central mantienen rol `vendedor`
- ✅ **Permisos por Rol**: 
  - `encargado_sucursal`: Acceso completo a módulos de su sucursal (dashboard, inventario, ventas POS, tesorería), solo lectura de presupuestos/pedidos, puede recibir transferencias pero no crearlas
  - `vendedor`: Acceso a módulos centrales (presupuestos, clientes, listas de precios, facturas, almacén central, rutas de reparto), solo lectura de sucursales

### **Vista Previa de Clientes en Monitor GPS (Diciembre 2025)**
- ✅ **Panel lateral de números**: Lista clickeable de clientes con números ordenados por ruta seleccionada
- ✅ **Modal de vista previa**: Información completa del cliente (nombre, dirección, teléfono) y lista de productos
- ✅ **Colores dinámicos**: Números cambian según estado (negro: entregado y cobrado, gris: solo entregado, color de ruta: pendiente)
- ✅ **Sincronización**: Panel lateral, mapa y modal sincronizados (click en número centra el mapa)
- ✅ **Endpoints enriquecidos**: `/api/reparto/rutas-planificadas` y `/api/rutas/[id]/recorrido` incluyen productos y estado de pago

### **Sistema de Generación de Datos Mock para Monitor GPS (Diciembre 2025)**
- ✅ **Función `crearRutasMockMonteros()`**: Genera datos de prueba completos (rutas, clientes, vehículos, pedidos, ubicaciones GPS)
- ✅ **Endpoints API**: 
  - `POST /api/reparto/rutas-mock` - Genera rutas mock con parámetros configurables
  - `DELETE /api/reparto/limpiar-mock` - Elimina todos los datos mock anteriores
- ✅ **Optimización para Vercel Free**: Configurado con `maxDuration = 10` segundos, datos reducidos (20 ubicaciones GPS por ruta, puntos cada 500m)
- ✅ **Logs Detallados**: Sistema completo de logging con tiempos de ejecución por sección para diagnóstico
- ✅ **Componente UI**: `GenerarRutasMockButton` integrado en el monitor GPS para generación desde la interfaz
- ✅ **Optimización Automática**: Aplica algoritmo local (Nearest Neighbor + 2-opt) a las rutas generadas

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

### **Reorganización Funcional del Sidebar (Diciembre 2025)**
- ✅ **Agrupación por Dominios**: Navegación organizada por funciones de negocio (Almacén, Ventas, Reparto, Tesorería)
- ✅ **Transferencias movidas**: De "Sucursales" a "Almacén" (lógica de gestión de inventario)
- ✅ **Submenús Jerárquicos**: Vista sucursal con navegación expandible/collapsible
- ✅ **Auto-expansión**: Submenús se expanden automáticamente cuando contienen página activa
- ✅ **Navegación Intuitiva**: Funciones relacionadas agrupadas lógicamente

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

### **Estructura de Navegación por Dominios Funcionales**
```
🏠 Dashboard

📦 Almacén (WMS)
  ├── Productos
  ├── Lotes
  ├── Presupuestos del Día
  ├── Pedidos
  ├── Transferencias ✅ (Movidas desde Sucursales)
  └── Recepción

🛒 Ventas (CRM)
  ├── Presupuestos
  ├── Clientes
  ├── Listas de Precios ✅
  └── Facturas ✅

🚚 Reparto (TMS)
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
  ├── Gastos
  └── Por Sucursal

🏢 Sucursales (Multi-sucursal)
  ├── Gestión de Sucursales
  ├── Dashboard Sucursal
  ├── Alertas de Stock ✅ (Monitoreo centralizado)
  └── Reportes

👥 RRHH
  ├── Empleados
  ├── Asistencia
  ├── Liquidaciones
  ├── Adelantos
  ├── Licencias
  ├── Evaluaciones
  ├── Novedades
  └── Reportes

📊 Reportes Globales
```

### **Navegación Sucursal (Jerárquica)**
```
🏠 Dashboard

📦 Gestión Local
  ├── Inventario
  ├── Ventas
  └── Alertas de Stock

🚚 Operaciones
  ├── Transferencias
  └── Tesorería

📢 Comunicación
  └── Novedades

📊 Reportes
```

### **Problemas Resueltos**
1. **Error de búsqueda de clientes**: Agregado campo `codigo` faltante en consulta de clientes
2. **Errores en Listas de Precios**: Políticas RLS simplificadas y compatibilidad Next.js 15
3. **Navegación incompleta**: Agregados módulos faltantes al sidebar
4. **Reorganización del Sidebar**: Navegación funcional por dominios con submenús jerárquicos
5. **Google Maps no funcionaba**: Implementado sistema completo de selección de ubicaciones con Maps JavaScript API

### **Módulo de Sucursales Completo (28/11/2025)**
- ✅ **Tablas nuevas**: `sucursales`, `sucursal_settings`, `alertas_stock`
- ✅ **RLS completo**: Políticas por sucursal_id en todas las tablas críticas
- ✅ **Server Actions**: 8 actions completas para gestión de sucursales
- ✅ **API Routes**: 3 endpoints REST para evaluación de stock y transferencias
- ✅ **UI completa**: Dashboard admin + dashboard sucursal con métricas en tiempo real
- ✅ **Alertas automáticas**: Sistema de bajo stock con job/cron integrado
- ✅ **Componente Avisos**: Reutilizable en RRHH y Sucursales
- ✅ **Tesorería integrada**: Movimientos automáticos por sucursal

### **Modelo de Control para Sucursales (02/12/2025)**
- ✅ **Control de precios mayorista/minorista**: Sistema de auditoría de qué lista de precios se usa en cada venta
- ✅ **Cálculo de costo y margen**: Costo promedio ponderado por sucursal + margen bruto por venta
- ✅ **Tablas nuevas**: `conteos_stock`, `conteo_stock_items`, `ajustes_stock`, `auditoria_listas_precios`
- ✅ **Conteos físicos de stock**: Ciclo semanal con tolerancia de merma configurable (1-2%)
- ✅ **Ajustes automáticos**: Mermas dentro de tolerancia se aplican automáticamente
- ✅ **POS mejorado para sucursales**: Componente `POSSucursal` con selección de lista de precios
- ✅ **Reportes de auditoría**: Uso de listas por usuario, márgenes por día, alertas de comportamiento sospechoso
- ✅ **Detección de fraude**: Alertas automáticas por alto % mayorista o ventas mayoristas de bajo volumen
- ✅ **Funciones RPC nuevas**: 
  - `fn_registrar_venta_sucursal()` - Venta con control de lista, costo y margen
  - `fn_iniciar_conteo_stock()` - Inicia conteo físico
  - `fn_completar_conteo_stock()` - Completa conteo y genera ajustes
  - `fn_obtener_costo_promedio_sucursal()` - Costo promedio ponderado
  - `fn_reporte_uso_listas_sucursal()` - Reporte de uso de listas
  - `fn_reporte_margenes_sucursal()` - Reporte de márgenes
  - `fn_detectar_comportamiento_sospechoso()` - Alertas de fraude
- ✅ **Server Actions**: `ventas-sucursal.actions.ts` con 12 funciones
- ✅ **Rutas nuevas**: `/sucursal/inventario/conteos`, `/sucursal/reportes/auditoria`
- ✅ **Vista materializada**: `mv_resumen_listas_sucursal` para reportes rápidos
- ✅ **Migración**: `20251202_modelo_control_sucursales.sql`

### **Mejoras de UX y Manejo de Admins para Sucursales (Diciembre 2025)**
- ✅ **Dashboard mejorado**: Banner destacado con identificación clara de sucursal actual
- ✅ **Selector de sucursales**: Administradores pueden cambiar entre sucursales desde el dashboard
- ✅ **Badges informativos**: Estado de sucursal (Activa/Inactiva) y vista admin
- ✅ **Función helper**: `getSucursalUsuarioConAdmin()` maneja el caso de admin sin sucursal asignada
- ✅ **Manejo robusto**: Todos los componentes de sucursal manejan correctamente admin sin sucursal
- ✅ **Mensajes informativos**: Opción para crear primera sucursal cuando no hay sucursales activas
- ✅ **Componentes actualizados**: 
  - `dashboard/page.tsx`: Selector de sucursales y banner de identificación
  - `ventas/page.tsx`, `alerts/page.tsx`, `inventario/page.tsx`, `tesoreria/page.tsx`, `novedades/page.tsx`, `transferencias/page.tsx`, `inventario/conteos/page.tsx`, `reportes/auditoria/page.tsx`: Todos con soporte para admin sin sucursal
- ✅ **Correcciones técnicas**: Cambio de `createClient` del cliente al servidor en componentes que lo requerían

### **Optimizaciones de Rendimiento (16/12/2025)**
- ✅ **Revalidación Estratégica**: 20+ páginas optimizadas con `revalidate` (Dashboard 30s, Listados 5min, Reportes 1h)
- ✅ **Caché de Consultas**: Productos, zonas y listas de precios cacheados automáticamente
- ✅ **Queries Optimizadas**: Funciones RPC que consolidan múltiples queries (N+1 → 1)
- ✅ **Índices de BD**: 8 índices compuestos nuevos para consultas frecuentes
- ✅ **Materialized Views**: KPIs de ventas pre-calculados (diarias y mensuales)
- ✅ **Funciones RPC Batch**: Validación batch, conversión masiva, aprobación masiva
- ✅ **Expiración Automática**: Reservas de stock se liberan automáticamente cada 15 minutos
- ✅ **Alertas Inteligentes**: Sistema de priorización (crítico, bajo, normal)
- ✅ **Notificaciones Push**: Notificaciones del navegador para eventos críticos
- ✅ **Logging Condicional**: Console.logs solo en desarrollo
- ✅ **Métricas**: Reducción de 70-80% en tiempo de carga, 50-70% en consultas BD
- ✅ **Scripts de testing**: Demo completo + tests HTTP + evaluación automática
- ✅ **Nueva migración**: `20251128_modulo_sucursales.sql` con funciones RPC

---

## 🚀 Optimizaciones Técnicas (Diciembre 2025)

### Solución al Problema N+1
Se implementaron funciones RPC optimizadas para consolidar múltiples consultas en una sola llamada a la base de datos, reduciendo drásticamente la latencia y el uso de recursos.

#### Principales RPCs de Optimización:
1.  **`fn_obtener_cliente_completo(p_cliente_id)`**:
    *   Obtiene datos del cliente.
    *   Calcula estadísticas de pedidos (total, entregados, pendientes) en una subquery.
    *   Obtiene saldo y límite de cuenta corriente.
    *   Recupera listas de precios activas y vigentes.
    *   **Resultado**: JSONB completo en <50ms.

2.  **`fn_obtener_pedido_completo(p_pedido_id)`**:
    *   Obtiene cabecera del pedido y datos del cliente.
    *   Agrega detalles (items) con datos de productos.
    *   Incluye historial de pagos y movimientos de caja.
    *   Obtiene estado de cuenta corriente actual.
    *   **Resultado**: Objeto anidado listo para UI sin round-trips adicionales.

### Bot de WhatsApp: Máquina de Estados en Memoria
Para el flujo de registro de nuevos clientes, el bot implementa una máquina de estados ligera en memoria (`RegistroClienteEstado`) que gestiona la conversación:

1.  **Estados**: `esperando_nombre` → `esperando_direccion` → `esperando_localidad`.
2.  **Persistencia Temporal**: Los datos parciales se mantienen en un `Map` en memoria (RAM).
3.  **Expiración**: Limpieza automática de estados inactivos tras 10 minutos.
4.  **Finalización**: Al completar, llama a `crearClienteDesdeBot` y luego `crearPresupuestoAction`.

---

### **Configuración de Productos Mayoristas (Enero 2025)**
- ✅ **Unidad Mayor Personalizada**: Cada producto puede configurar su propia unidad mayor (`unidad_mayor_nombre`: "caja", "bolsa", "pallet", etc.)
- ✅ **Peso por Unidad Mayor Configurable**: Cada producto define su propio `kg_por_unidad_mayor` (no todos son 20 kg)
- ✅ **Visualización Consistente**: El sistema muestra la unidad y peso configurados en todos los lugares (presupuestos, pesaje, rutas)
- ✅ **Sin Fallbacks Incorrectos**: Eliminados todos los fallbacks hardcodeados (`|| 'caja'`, `|| 20`)
- ✅ **Validación de Cálculos**: Los cálculos solo se ejecutan cuando valores están configurados, evitando `NaN`
- ✅ **Archivos actualizados**: 8 archivos en total (páginas, componentes, actions)

---

*Resumen actualizado el Enero 2025 - Configuración de productos mayoristas implementada + Modelo de control para sucursales + Mejoras de UX y manejo de admins*
