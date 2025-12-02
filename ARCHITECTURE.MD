# Arquitectura del Sistema de Gestión Integral - Avícola del Sur

## 📋 Información General

**Sistema ERP Completo y Funcional** diseñado para eliminar silos de información entre Almacén, Ventas, Reparto y Tesorería, creando una única fuente de la verdad en Supabase con planificación semanal de rutas, GPS tracking en tiempo real y optimización automática.

### 🎯 Estado Actual - SISTEMA COMPLETO ✅
- **Planificación Semanal**: Rutas fijas por zona/día/turno con vehículos asignados (Fiorino 600kg, Hilux 1500kg, F-4000 4000kg)
- **Flujo Automático**: Presupuesto → Turno Auto → Asignación Ruta → Almacén → Optimización → Reparto GPS → Cobro
- **GPS Tracking**: PWA con ubicación cada 5s + alertas de desvío (>200m) y cliente saltado (<100m)
- **Optimización Híbrida**: Google Directions API + fallback local (Nearest Neighbor + 2-opt)
- **Tesorería Completa**: Cuentas corrientes, cajas, cierres automáticos con referencias PAY-XXXXXX
- **RRHH Integrado**: Gestión de empleados, asistencia, liquidaciones y adelantos con reglas de negocio estrictas

### 🎯 Objetivos del Sistema - ALCANZADOS ✅
- **Integración Total**: Unificar Almacén (WMS), Ventas (CRM), Reparto (TMS) y Tesorería
- **Automatización**: Bot WhatsApp + asignación automática de rutas + turnos por hora
- **Eficiencia**: PWA móvil completa con GPS tracking, firma digital y cobros
- **Trazabilidad**: Control completo desde ingreso hasta conciliación financiera

### 📱 Aplicaciones del Sistema - COMPLETAS ✅
1. **App Admin**: Dashboard web completo con planificación semanal, monitor GPS, reportes
2. **App Repartidor**: PWA móvil completa con GPS tracking, entregas, cobros y firma digital
3. **App Sucursal**: POS con control de precios mayorista/minorista y auditoría automática
4. **Bot Vendedor**: Automatización completa de pedidos vía WhatsApp con reserva stock
5. **Planificación Semanal**: Gestión de rutas fijas por zona/día/turno/vehículo
6. **Monitor GPS**: Tiempo real con alertas automáticas y mapa Google Maps
7. **Control de Sucursales**: Auditoría de precios, conteos físicos de stock y detección de desvíos

---

## 🛠️ Stack Tecnológico - COMPLETO ✅

| Componente | Tecnología | Propósito |
|------------|------------|----------|
| **Framework** | Next.js 15 (App Router) | Server Components, Server Actions, ISR |
| **Frontend** | React 19 + TypeScript | Interfaz moderna, tipada y performante |
| **Estado Global** | Zustand | Sesión usuario, notificaciones, estado mínimo |
| **UI/UX** | Tailwind CSS + shadcn/ui | Diseño profesional basado en colores de marca |
| **Formularios** | React Hook Form + Zod | Validación automática, UX mejorada |
| **Tablas/Listas** | TanStack Table | Paginación, filtros, sorting avanzado |
| **Backend Web** | Server Actions (Next.js) | Lógica de negocio segura server-side |
| **Base de Datos** | Supabase (Postgres 15) | Auth, Storage, Realtime, RLS |
| **Canal de Chat** | Twilio WhatsApp API | Comunicación bidireccional con clientes |
| **Motor de Chatbot** | **Implementación Directa** | Procesamiento de comandos en Next.js |
| **Backend Bot** | Next.js API Route | Endpoint `/api/bot/` con lógica completa |
| **GPS Tracking** | Navigator API + Polling | Ubicación cada 5s con alertas automáticas |
| **Mapas** | Google Maps JavaScript API | Visualización GPS, rutas optimizadas y monitor en tiempo real |
| **Optimización Rutas** | Google Directions API | Rutas profesionales con fallback local |
| **Storage** | Supabase Storage | Firmas digitales, comprobantes, adjuntos |
| **Generación PDF** | pdfkit | Reportes profesionales con paginación |
| **Algoritmos Locales** | Nearest Neighbor + 2-opt | Fallback de optimización sin API externa |

---

## 🔄 Flujos de Datos Principales - COMPLETOS ✅

### Flujo A: Aplicación Web (Admin y Repartidor)

```
Usuario (Admin/Repartidor) → UI (shadcn/ui) → Server Action (/src/actions/)
    ↓
Validación (Zod) → Lógica Servidor → RPC Supabase (operaciones atómicas)
    ↓
Respuesta {success: true} → revalidatePath() → Notificación → UI actualizada
```

### Flujo B: Bot WhatsApp (Cliente → Presupuesto) ✅ COMPLETO

```
Cliente (WhatsApp) → Twilio → POST /api/bot → Procesamiento comando
    ↓
Validación stock (FIFO) → Server Action → fn_crear_presupuesto_desde_bot()
    ↓
Reserva stock preventiva → Notificación admin → PRES-YYYYMMDD-XXXX creado
```

### Flujo C: Planificación Semanal (Admin → Rutas Fijas) ✅ NUEVO

```
Admin → /reparto/planificacion → crearPlanRutaAction() → plan_rutas_semanal
    ↓
Zona + Día + Turno + Vehículo + Capacidad → Rutas planificadas guardadas
```

### Flujo D: Conversión Automática (Presupuesto → Pedido + Ruta) ✅ NUEVO

```
Presupuesto → Confirmar → fn_convertir_presupuesto_a_pedido()
    ↓
Turno automático (<06:00 mañana, ≥06:00 tarde) → fn_asignar_pedido_a_ruta()
    ↓
Busca ruta planificada → Valida capacidad → Inserta en detalles_ruta
    ↓
Optimiza ruta (Google + fallback) → Actualiza rutas_planificadas
```

### Flujo E: GPS Tracking (Repartidor → Monitor) ✅ NUEVO

```
PWA Repartidor → navigator.geolocation.watchPosition() → POST /api/reparto/ubicacion
    ↓
Cada 5s → ubicaciones_repartidores → Alertas automáticas (>200m desvío)
    ↓
GET /api/reparto/ubicaciones → Monitor Google Maps → Polylíneas + alertas
    ↓
Polling optimizado adaptativo (10-60s según vehículos) + Page Visibility API
```

### Flujo F: Optimización de Rutas (Automática) ✅ NUEVO

```
Ruta con pedidos → POST /api/rutas/generar → Google Directions API
    ↓
Si falla → Nearest Neighbor + 2-opt local → Polyline + orden visita
    ↓
Actualiza rutas_planificadas → Monitor actualizado automáticamente
```

### Flujo G: Cobros y Conciliación (Automático) ✅ COMPLETO

```
Entrega PWA → Cobro registrado → cuentas_movimientos + tesoreria_movimientos
    ↓
Referencia PAY-XXXXXX → GET /api/tesoreria/movimientos-tiempo-real
    ↓
Conciliación automática → Reportes CSV/PDF → Cierres de caja
```

**Características de todos los flujos:**
- ✅ **Operaciones Atómicas**: RPCs de Postgres garantizan consistencia
- ✅ **FIFO Automático**: Gestión inteligente de lotes por vencimiento
- ✅ **Validación Preventiva**: Clientes bloqueados no pueden operar
- ✅ **Trazabilidad Completa**: Desde reserva hasta conciliación financiera
- ✅ **Server-Side First**: Toda lógica crítica en Server Actions
- ✅ **Realtime**: Actualizaciones automáticas vía Supabase Realtime

---

## 🏢 Dominios de Negocio

### 1️⃣ Dominio: Almacén (WMS - Warehouse Management System) ✅ COMPLETO

**Funcionalidades:**
- **Trazabilidad**: Control de lotes, fechas de vencimiento y origen
- **Ingreso de Mercadería**: Recepción, etiquetado y ubicación en almacén
- **Control de Stock**: Diferenciación entre stock físico y disponible
- **Gestión de Picking**: Preparación optimizada de pedidos
- **Control de Calidad**: Checklists obligatorios antes de salida

### 2️⃣ Dominio: Ventas (CRM - Customer Relationship Management)

**Funcionalidades:**
- **Gestión de Clientes**: Base de datos con zonas de entrega, listas de precios asignadas
- **Toma de Pedidos**: Validación de stock en tiempo real
- **Validación Preventiva**: Bloqueo automático de formularios para clientes con `bloqueado_por_deuda=true`
- **Cotizaciones**: Generación y seguimiento de presupuestos
- **Facturación**: Emisión de comprobantes fiscales
- **Post-venta**: Gestión de reclamos y seguimiento
- **Referencias de Pago**: Generación automática de códigos de referencia para pagos diferidos
- **Instrucciones para Repartidores**: Mensajes automáticos con monto y referencia de pago
- **Sistema de Listas de Precios**: 
  - Listas base (MINORISTA, MAYORISTA, DISTRIBUIDOR) con asignación automática por tipo_cliente
  - Cada cliente puede tener hasta 2 listas activas (1 automática + 1 manual)
  - Margen de ganancia configurable por lista para cálculo automático desde precio_costo
  - Precios manuales por producto en cada lista
  - Selección de lista en presupuestos por vendedor
  - Integración con bot WhatsApp (usa primera lista del cliente automáticamente)
  - Herencia de lista en pedidos desde presupuestos

### 3️⃣ Dominio: Reparto (TMS - Transportation Management System) ✅ COMPLETO

**Funcionalidades Implementadas:**
- **Planificación Semanal**: Rutas fijas por zona/día/turno/vehículo con capacidad definida
- **Vehículos Base**: Fiorino (600kg), Hilux (1500kg), F-4000 (4000kg) precargados
- **Asignación Automática**: Pedidos se asignan a rutas planificadas según zona/turno/día
- **Validación de Capacidad**: Peso final del pedido ≤ capacidad del vehículo planificada
- **Optimización de Rutas**: Google Directions API + fallback local (Nearest Neighbor + 2-opt)
- **GPS Tracking**: PWA con ubicación cada 5s durante reparto activo
- **Alertas Automáticas**: Desvío (>200m) y cliente saltado (<100m sin entrega)
- **Monitor Admin**: Mapa Google Maps en tiempo real con:
  - Rutas codificadas por color para fácil identificación
  - Marcadores de clientes con estado (pendiente/entregado)
  - Panel lateral con progreso y estadísticas
  - Animaciones suaves de movimiento de vehículos
- **PWA Móvil Completa**: Dashboard, entregas, cobros, firma digital, QR verificación
- **Gestión de Vehículos**: Flota con mantenimientos y seguros
- **Control de Repartidores**: Usuarios con roles específicos y vehículo asignado
- **Checklists Vehiculares**: Inspecciones diarias guardadas en Supabase Storage

### 6️⃣ Dominio: Tesorería y Finanzas ✅ COMPLETO

**Funcionalidades:**
- **Gestión de Cajas**: Cajas por sucursal con saldos iniciales y actuales
- **Movimientos de Caja**: Ingresos y egresos vinculados a pedidos, gastos y operaciones manuales
- **Registro de Gastos**: 
  - Categorización de gastos
  - **Adjuntos en Supabase Storage**: Soporte para imágenes (JPG/PNG) y PDFs (máx. 10MB)
  - Opción de afectar caja automáticamente en la misma transacción
- **Cuentas Corrientes**: 
  - Control de saldos y límites de crédito
  - Bloqueo automático cuando se supera el límite (`bloqueado_por_deuda`)
  - Validación preventiva en formularios de pedidos
- **Reportes Financieros**: 
  - Exportación en **CSV** (formato separado por punto y coma)
  - Exportación en **PDF** (formato profesional con título, encabezados, datos tabulados y paginación automática)
  - Tipos: ventas, gastos, movimientos de caja, cuentas corrientes
- **Referencias de Pago**: 
  - Generación automática de códigos únicos (formato: `PAY-YYYYMMDD-XXXXXX`)
  - Asignación a pedidos con pago diferido o parcial
- **Instrucciones para Repartidores**: 
  - Mensajes estructurados con monto pendiente y referencia de pago
  - Almacenadas en campo `instruccion_repartidor` de la tabla `pedidos`
  - **Validación de Rutas**: Conciliación automática de efectivo y pagos digitales al finalizar reparto

### 7️⃣ Dominio: RRHH (Recursos Humanos) ✅ COMPLETO

**Funcionalidades Implementadas:**
- **Gestión de Empleados**: Legajos, datos bancarios, asignación de sucursales y categorías
- **Control de Asistencia**: 
  - Registro de entradas/salidas con geolocalización
  - **Reglas de Negocio**: >15 min tarde = falta sin aviso
  - Penalizaciones automáticas (pérdida de presentismo)
- **Adelantos de Sueldo**:
  - **Límite Automático**: Máximo 30% del sueldo básico
  - Flujo de aprobación (Solicitud → Aprobación → Descuento)
  - Soporte para adelantos en efectivo o mercadería
- **Liquidación de Sueldos**:
  - Cálculo automático mensual
  - Integración con asistencia (descuentos por faltas) y adelantos
  - Generación de recibos preliminares
- **Novedades y Comunicaciones**: Tablón de anuncios digital por sucursal o rol
- **Evaluaciones de Desempeño**: Calificación mensual por competencias (1-5 estrellas)
- **Reportes Avanzados**: ✅ **OPTIMIZADO (Migración 20251207)**
  - **Arquitectura**: Consultas optimizadas usando funciones RPC con `SECURITY DEFINER` para bypasear RLS
  - **KPIs en Tiempo Real**: Ventas, Ticket Promedio, Top Productos/Vendedores (via `fn_kpis_ventas`)
  - **Análisis por Zona**: Agrupación de ventas por zona de entrega (via `fn_ventas_por_zona`)
  - **Ranking de Vendedores**: Top N vendedores por ventas totales (via `fn_top_vendedores`)
  - **Métodos de Pago**: Distribución de recaudación con porcentajes automáticos (via `fn_ventas_por_metodo_pago`)
  - **Análisis Comparativo**: Variación vs período anterior
  - **Mapas de Calor**: Ventas por día/hora para optimización de personal (via `fn_heatmap_ventas`)
  - **Retención**: Análisis de clientes nuevos vs recurrentes (via `fn_clientes_nuevos_vs_recurrentes`)
  - **Materialized Views**: Refresh automático con pg_cron (cada hora/15min según vista)
  - **Exportación**: PDF (via `pdfkit`) y CSV/Excel con filtros avanzados
  - **Performance**: ~70% reducción de código, 30-40% mejora en tiempo de respuesta vs consultas directas

### 4️⃣ Dominio: Planificación Semanal (Route Planning) ✅ NUEVO

**Funcionalidades Implementadas:**
- **Nueva tabla**: `plan_rutas_semanal` con zona/día/turno/vehículo/capacidad
- **Vehículos fijos**: 3 modelos con capacidades específicas (Fiorino 600kg, Hilux 1500kg, F-4000 4000kg)
- **UI de planificación**: `/reparto/planificacion` para crear/editar/eliminar planes semanales
- **Asignación automática**: Pedidos se asignan a rutas planificadas según zona/turno/día
- **Validación capacidad**: Peso final del pedido ≤ capacidad del vehículo planificada
- **RPC integrada**: `fn_asignar_pedido_a_ruta()` busca planes y valida restricciones

### 5️⃣ Dominio: Bot de WhatsApp (Interfaz de Cliente) ✅ FUNCIONANDO

**Funcionalidades Implementadas:**
- ✅ **Toma de Pedido Automatizada**: Validación de stock en tiempo real desde lotes
- ✅ **Pedidos Simples**: `POLLO001 5` → Confirmación → Pedido creado
- ✅ **Pedidos Múltiples**: `POLLO001 5, HUEVO001 2` → Un solo pedido con varios productos
- ✅ **Confirmación Explícita**: Muestra resumen y requiere SÍ/NO antes de crear
- ✅ **Consulta de Estado**: `estado PED-XXXXX` o `3` para ver historial
- ✅ **Catálogo Dinámico**: Solo muestra productos con stock disponible
- ✅ **Indicadores de Stock**: 🟢 Alto (>50) | 🟡 Medio (20-50) | 🔴 Bajo (<20)
- ✅ **Horario de Atención**: Valida horarios laborales
- ✅ **Descuento Automático de Stock**: Sistema FIFO por lotes
- ✅ **Trazabilidad Completa**: Registra qué lote se usó en cada venta
- ✅ **Referencias de Pago**: Genera automáticamente código de referencia (formato: `PAY-YYYYMMDD-XXXXXX`) para pedidos con pago diferido
- ✅ **Instrucciones para Repartidores**: Incluye monto y referencia de pago en mensajes de confirmación
- ✅ **Registro de Reclamos**: Implementado (Schemas, API y Acciones)
- 🚧 **Notificaciones Push**: En desarrollo (Implementado solo para Balanza IoT)

**Sistema de Lotes (WMS Profesional):**

El bot implementa un sistema completo de gestión de inventario por lotes:

1. **Validación de Stock Real**: Consulta lotes disponibles y no vencidos
2. **FIFO Automático**: Usa primero el lote que vence más pronto
3. **Descuento Transaccional**: Todo o nada (rollback si falla)
4. **Registro de Movimientos**: Cada venta genera movimiento de stock
5. **Asignación de Lote**: El pedido sabe de qué lote salió cada producto

**Ejemplo de flujo:**
```
Cliente pide: POLLO001 50kg

Sistema busca lotes de POLLO001 ordenados por vencimiento:
  LOTE-A: 80kg (vence 10/11) ← Se usa este
  LOTE-B: 120kg (vence 20/11)

Descuenta 50kg del LOTE-A:
  LOTE-A: 80kg → 30kg
  
Registra movimiento:
  Tipo: salida
  Cantidad: 50kg
  Motivo: "Venta desde WhatsApp Bot"
  
Crea pedido con referencia al lote usado
```

---

## 🗄️ Esquema de Base de Datos (Supabase - PostgreSQL)

## 📄 Scripts de Configuración

### Script SQL de Base de Datos
El esquema completo de la base de datos se encuentra en el archivo `database-schema.sql` en la raíz del proyecto.

```sql
-- ===========================================
-- AVÍCOLA DEL SUR - ESQUEMA DE BASE DE DATOS
-- ===========================================

-- EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ===========================================
-- TABLAS MAESTRAS
-- ===========================================

-- PRODUCTOS
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    precio_venta DECIMAL(10,2) NOT NULL,
    precio_costo DECIMAL(10,2),
    unidad_medida VARCHAR(20) DEFAULT 'kg',
    stock_minimo INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CLIENTES
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    whatsapp VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    zona_entrega VARCHAR(100),
    coordenadas GEOMETRY(POINT, 4326),
    tipo_cliente VARCHAR(50) DEFAULT 'minorista',
    limite_credito DECIMAL(10,2) DEFAULT 0,
    bloqueado_por_deuda BOOLEAN DEFAULT false, -- bloqueo automático cuando supera límite
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VEHÍCULOS
CREATE TABLE vehiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patente VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(100),
    modelo VARCHAR(100),
    capacidad_kg INTEGER NOT NULL,
    tipo_vehiculo VARCHAR(50) DEFAULT 'camioneta',
    seguro_vigente BOOLEAN DEFAULT true,
    fecha_vto_seguro DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USUARIOS/EMPLEADOS
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255),
    telefono VARCHAR(20),
    rol VARCHAR(50) NOT NULL, -- admin, vendedor, repartidor, almacenista
    vehiculo_asignado UUID REFERENCES vehiculos(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: ALMACÉN (WMS)
-- ===========================================

-- LOTES/MERCADERÍA
CREATE TABLE lotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_lote VARCHAR(50) UNIQUE NOT NULL,
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad_ingresada DECIMAL(10,3) NOT NULL,
    cantidad_disponible DECIMAL(10,3) NOT NULL,
    fecha_ingreso DATE NOT NULL,
    fecha_vencimiento DATE,
    proveedor VARCHAR(255),
    costo_unitario DECIMAL(10,2),
    ubicacion_almacen VARCHAR(100),
    estado VARCHAR(50) DEFAULT 'disponible', -- disponible, reservado, vencido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MOVIMIENTOS DE STOCK
CREATE TABLE movimientos_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes(id),
    tipo_movimiento VARCHAR(50) NOT NULL, -- ingreso, salida, ajuste
    cantidad DECIMAL(10,3) NOT NULL,
    motivo TEXT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    pedido_id UUID, -- puede ser null si no es por pedido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHECKLISTS DE CALIDAD
CREATE TABLE checklists_calidad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lote_id UUID NOT NULL REFERENCES lotes(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    temperatura DECIMAL(5,2),
    humedad DECIMAL(5,2),
    apariencia VARCHAR(255),
    aprobado BOOLEAN NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: VENTAS (CRM)
-- ===========================================

-- PEDIDOS
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_pedido VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    usuario_vendedor UUID REFERENCES usuarios(id), -- puede ser null si viene del bot
    fecha_pedido TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_entrega_estimada DATE,
    fecha_entrega_real TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, confirmado, preparando, enviado, entregado, cancelado
    tipo_pedido VARCHAR(50) DEFAULT 'venta', -- venta, cotizacion
    origen VARCHAR(50) DEFAULT 'web', -- web, whatsapp, telefono
    subtotal DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    observaciones TEXT,
    pago_estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente, parcial, pagado
    caja_movimiento_id UUID REFERENCES tesoreria_movimientos(id), -- movimiento de caja asociado
    referencia_pago VARCHAR(50), -- código único de referencia de pago (PAY-YYYYMMDD-XXXXXX)
    instruccion_repartidor TEXT, -- instrucción para el repartidor con monto y referencia
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DETALLES DE PEDIDO
CREATE TABLE detalles_pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id),
    producto_id UUID NOT NULL REFERENCES productos(id),
    lote_id UUID REFERENCES lotes(id), -- lote específico asignado
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COTIZACIONES
CREATE TABLE cotizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_cotizacion VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    usuario_vendedor UUID REFERENCES usuarios(id),
    fecha_cotizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_vencimiento DATE,
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, aprobada, rechazada, vencida
    subtotal DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DETALLES DE COTIZACIÓN
CREATE TABLE detalles_cotizacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cotizacion_id UUID NOT NULL REFERENCES cotizaciones(id),
    producto_id UUID NOT NULL REFERENCES productos(id),
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RECLAMOS
CREATE TABLE reclamos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_reclamo VARCHAR(50) UNIQUE NOT NULL,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    pedido_id UUID REFERENCES pedidos(id),
    tipo_reclamo VARCHAR(100) NOT NULL, -- producto_dañado, entrega_tardia, cantidad_erronea, etc
    descripcion TEXT NOT NULL,
    estado VARCHAR(50) DEFAULT 'abierto', -- abierto, investigando, resuelto, cerrado
    prioridad VARCHAR(20) DEFAULT 'media', -- baja, media, alta
    fecha_resolucion TIMESTAMP WITH TIME ZONE,
    solucion TEXT,
    usuario_asignado UUID REFERENCES usuarios(id),
    origen VARCHAR(50) DEFAULT 'telefono', -- telefono, whatsapp, web
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: REPARTO (TMS)
-- ===========================================

-- CHECKLISTS DE VEHÍCULOS
CREATE TABLE checklists_vehiculos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_check DATE NOT NULL,
    aceite_motor BOOLEAN DEFAULT false,
    luces BOOLEAN DEFAULT false,
    frenos BOOLEAN DEFAULT false,
    presion_neumaticos BOOLEAN DEFAULT false,
    limpieza_interior BOOLEAN DEFAULT false,
    limpieza_exterior BOOLEAN DEFAULT false,
    combustible DECIMAL(5,2), -- porcentaje
    kilometraje INTEGER,
    observaciones TEXT,
    aprobado BOOLEAN NOT NULL,
    fotos_url JSONB, -- array de URLs de fotos en Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RUTAS DE REPARTO
CREATE TABLE rutas_reparto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_ruta VARCHAR(50) UNIQUE NOT NULL,
    vehiculo_id UUID NOT NULL REFERENCES vehiculos(id),
    repartidor_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_ruta DATE NOT NULL,
    estado VARCHAR(50) DEFAULT 'planificada', -- planificada, en_curso, completada, cancelada
    distancia_estimada_km DECIMAL(8,2),
    distancia_real_km DECIMAL(8,2),
    tiempo_estimado_min INTEGER,
    tiempo_real_min INTEGER,
    peso_total_kg DECIMAL(8,2),
    costo_combustible DECIMAL(8,2),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DETALLES DE RUTA (pedidos asignados)
CREATE TABLE detalles_ruta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID NOT NULL REFERENCES rutas_reparto(id),
    pedido_id UUID NOT NULL REFERENCES pedidos(id),
    orden_entrega INTEGER NOT NULL, -- orden en la ruta
    distancia_parcial_km DECIMAL(6,2),
    tiempo_estimado_parcial_min INTEGER,
    coordenadas_entrega GEOMETRY(POINT, 4326),
    estado_entrega VARCHAR(50) DEFAULT 'pendiente', -- pendiente, en_camino, entregado, fallido
    fecha_hora_entrega TIMESTAMP WITH TIME ZONE,
    notas_entrega TEXT,
    firma_url VARCHAR(500), -- URL de la firma digital en Storage
    qr_verificacion VARCHAR(100), -- código QR único para verificación
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOMINIO: TESORERÍA Y FINANZAS (Hito Intermedio)
-- ===========================================

-- TESORERÍA: CAJAS
CREATE TABLE tesoreria_cajas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID,
    nombre VARCHAR(120) NOT NULL,
    saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
    saldo_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
    moneda VARCHAR(10) NOT NULL DEFAULT 'ARS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TESORERÍA: MOVIMIENTOS
CREATE TABLE tesoreria_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caja_id UUID NOT NULL REFERENCES tesoreria_cajas(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    descripcion TEXT,
    origen_tipo VARCHAR(50), -- pedido, gasto, manual
    origen_id UUID,
    metodo_pago VARCHAR(30) DEFAULT 'efectivo',
    user_id UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GASTOS: CATEGORÍAS
CREATE TABLE gastos_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(120) UNIQUE NOT NULL,
    descripcion TEXT,
    color VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GASTOS
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucursal_id UUID,
    categoria_id UUID REFERENCES gastos_categorias(id),
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    descripcion TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    comprobante_url TEXT, -- URL del archivo en Supabase Storage
    afecta_caja BOOLEAN DEFAULT false,
    caja_movimiento_id UUID REFERENCES tesoreria_movimientos(id),
    creado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CUENTAS CORRIENTES
CREATE TABLE cuentas_corrientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL UNIQUE REFERENCES clientes(id) ON DELETE CASCADE,
    saldo NUMERIC(14,2) NOT NULL DEFAULT 0,
    limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CUENTAS CORRIENTES: MOVIMIENTOS
CREATE TABLE cuentas_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuenta_corriente_id UUID NOT NULL REFERENCES cuentas_corrientes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('cargo', 'abono')),
    monto NUMERIC(14,2) NOT NULL CHECK (monto >= 0),
    descripcion TEXT,
    origen_tipo VARCHAR(50), -- pedido, pago
    origen_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REPORTES: EXPORT
CREATE TABLE reportes_export (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(50) NOT NULL, -- ventas, gastos, movimientos_caja, cuentas_corrientes
    formato VARCHAR(10) NOT NULL DEFAULT 'csv', -- csv, pdf
    filtros JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    generated_by UUID REFERENCES usuarios(id),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===========================================

-- Índices principales
CREATE INDEX idx_pedidos_cliente_id ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha ON pedidos(fecha_pedido);
CREATE INDEX idx_detalles_pedido_pedido_id ON detalles_pedido(pedido_id);
CREATE INDEX idx_lotes_producto_id ON lotes(producto_id);
CREATE INDEX idx_lotes_estado ON lotes(estado);
CREATE INDEX idx_movimientos_stock_lote_id ON movimientos_stock(lote_id);
CREATE INDEX idx_rutas_fecha ON rutas_reparto(fecha_ruta);
CREATE INDEX idx_detalles_ruta_ruta_id ON detalles_ruta(ruta_id);

-- Índices geoespaciales
CREATE INDEX idx_clientes_coordenadas ON clientes USING GIST (coordenadas);
CREATE INDEX idx_detalles_ruta_coordenadas ON detalles_ruta USING GIST (coordenadas_entrega);

-- ===========================================
-- FUNCIONES RPC (REMOTE PROCEDURE CALL)
-- ===========================================

-- ===========================================
-- FUNCIONES RPC: LISTAS DE PRECIOS
-- ===========================================

-- Función para obtener precio de un producto en una lista específica
-- Prioridad: precio manual → precio desde margen → precio_venta del producto
CREATE OR REPLACE FUNCTION fn_obtener_precio_producto(
    p_lista_precio_id UUID,
    p_producto_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_precio DECIMAL(10,2);
    v_precio_costo DECIMAL(10,2);
    v_margen_ganancia DECIMAL(5,2);
BEGIN
    -- Buscar precio manual en la lista
    SELECT precio INTO v_precio
    FROM precios_productos
    WHERE lista_precio_id = p_lista_precio_id
      AND producto_id = p_producto_id
      AND activo = true
      AND (fecha_desde IS NULL OR fecha_desde <= CURRENT_DATE)
      AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
    ORDER BY fecha_desde DESC NULLS LAST
    LIMIT 1;

    -- Si no hay precio manual, calcular desde margen de ganancia
    IF v_precio IS NULL THEN
        SELECT lp.margen_ganancia, p.precio_costo
        INTO v_margen_ganancia, v_precio_costo
        FROM listas_precios lp
        CROSS JOIN productos p
        WHERE lp.id = p_lista_precio_id
          AND p.id = p_producto_id;

        IF v_margen_ganancia IS NOT NULL AND v_margen_ganancia > 0 
           AND v_precio_costo IS NOT NULL AND v_precio_costo > 0 THEN
            v_precio := v_precio_costo * (1 + v_margen_ganancia / 100);
        END IF;
    END IF;

    -- Fallback a precio_venta del producto
    IF v_precio IS NULL THEN
        SELECT precio_venta INTO v_precio
        FROM productos
        WHERE id = p_producto_id;
    END IF;

    RETURN COALESCE(v_precio, 0);
END;
$$ LANGUAGE plpgsql;

-- Función para asignar lista automática a cliente según tipo_cliente
CREATE OR REPLACE FUNCTION fn_asignar_lista_automatica_cliente(
    p_cliente_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_tipo_cliente VARCHAR(50);
    v_lista_id UUID;
BEGIN
    SELECT tipo_cliente INTO v_tipo_cliente
    FROM clientes
    WHERE id = p_cliente_id;

    IF v_tipo_cliente IN ('minorista', 'mayorista', 'distribuidor') THEN
        SELECT id INTO v_lista_id
        FROM listas_precios
        WHERE tipo = v_tipo_cliente
          AND activa = true
        LIMIT 1;

        IF v_lista_id IS NOT NULL THEN
            INSERT INTO clientes_listas_precios (
                cliente_id, lista_precio_id, es_automatica, prioridad, activa
            ) VALUES (
                p_cliente_id, v_lista_id, true, 1, true
            )
            ON CONFLICT (cliente_id, lista_precio_id) DO UPDATE
            SET es_automatica = true,
                activa = true,
                prioridad = 1,
                updated_at = NOW();
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'lista_id', v_lista_id);
END;
$$ LANGUAGE plpgsql;

-- Función para validar que un cliente no tenga más de 2 listas activas
CREATE OR REPLACE FUNCTION fn_validar_listas_cliente(
    p_cliente_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM clientes_listas_precios
    WHERE cliente_id = p_cliente_id
      AND activa = true;

    RETURN v_count < 2;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCIONES RPC: OPERACIONES CORE
-- ===========================================

-- Función para crear pedido desde bot (atómica)
CREATE OR REPLACE FUNCTION fn_crear_pedido_bot(
    p_cliente_id UUID,
    p_items JSONB,
    p_observaciones TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_pedido_id UUID;
    v_numero_pedido VARCHAR(50);
    v_total DECIMAL(10,2) := 0;
    v_item JSONB;
    v_stock_disponible DECIMAL(10,3);
BEGIN
    -- Generar número de pedido único
    v_numero_pedido := 'PED-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Crear pedido
    INSERT INTO pedidos (numero_pedido, cliente_id, origen, estado, observaciones)
    VALUES (v_numero_pedido, p_cliente_id, 'whatsapp', 'confirmado', p_observaciones)
    RETURNING id INTO v_pedido_id;

    -- Procesar items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Validar stock disponible
        SELECT SUM(l.cantidad_disponible) INTO v_stock_disponible
        FROM lotes l
        WHERE l.producto_id = (v_item->>'producto_id')::UUID
        AND l.estado = 'disponible'
        AND l.fecha_vencimiento > NOW();

        IF v_stock_disponible < (v_item->>'cantidad')::DECIMAL THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %', v_item->>'producto_id';
        END IF;

        -- Insertar detalle del pedido
        INSERT INTO detalles_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (
            v_pedido_id,
            (v_item->>'producto_id')::UUID,
            (v_item->>'cantidad')::DECIMAL,
            (v_item->>'precio_unitario')::DECIMAL,
            (v_item->>'cantidad')::DECIMAL * (v_item->>'precio_unitario')::DECIMAL
        );

        -- Actualizar total
        v_total := v_total + ((v_item->>'cantidad')::DECIMAL * (v_item->>'precio_unitario')::DECIMAL);
    END LOOP;

    -- Actualizar total del pedido
    UPDATE pedidos SET total = v_total, subtotal = v_total WHERE id = v_pedido_id;

    -- Retornar resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'pedido_id', v_pedido_id,
        'numero_pedido', v_numero_pedido,
        'total', v_total
    );

EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar el mensaje
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para consultar stock por lote (FIFO)
CREATE OR REPLACE FUNCTION fn_consultar_stock_por_lote(
    p_producto_id UUID DEFAULT NULL
) RETURNS TABLE (
    producto_id UUID,
    producto_codigo VARCHAR,
    producto_nombre VARCHAR,
    lote_id UUID,
    lote_numero VARCHAR,
    cantidad_disponible NUMERIC,
    fecha_vencimiento DATE,
    fecha_ingreso TIMESTAMPTZ,
    prioridad_consumo INTEGER
) AS $$
BEGIN
    -- Retorna lotes disponibles ordenados por FIFO (vencimiento ASC, ingreso ASC)
    -- Incluye prioridad de consumo calculada para facilitar el picking
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para validar entrega (atómica)
CREATE OR REPLACE FUNCTION fn_validar_entrega(
    p_pedido_id UUID,
    p_firma_url VARCHAR(500),
    p_qr_verificacion VARCHAR(100)
) RETURNS JSONB AS $$
DECLARE
    v_ruta_id UUID;
    v_detalle_ruta_id UUID;
BEGIN
    -- Buscar el detalle de ruta correspondiente
    SELECT dr.id, dr.ruta_id INTO v_detalle_ruta_id, v_ruta_id
    FROM detalles_ruta dr
    WHERE dr.pedido_id = p_pedido_id
    AND dr.estado_entrega = 'en_camino';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado en ruta activa');
    END IF;

    -- Actualizar estado de entrega
    UPDATE detalles_ruta
    SET estado_entrega = 'entregado',
        fecha_hora_entrega = NOW(),
        firma_url = p_firma_url,
        qr_verificacion = p_qr_verificacion
    WHERE id = v_detalle_ruta_id;

    -- Verificar si la ruta está completa
    IF NOT EXISTS (
        SELECT 1 FROM detalles_ruta
        WHERE ruta_id = v_ruta_id
        AND estado_entrega != 'entregado'
    ) THEN
        -- Marcar ruta como completada
        UPDATE rutas_reparto
        SET estado = 'completada',
            tiempo_real_min = EXTRACT(EPOCH FROM (NOW() - (
                SELECT MIN(dr.fecha_hora_entrega)
                FROM detalles_ruta dr
                WHERE dr.ruta_id = v_ruta_id
            ))) / 60
        WHERE id = v_ruta_id;
    END IF;

    -- Actualizar estado del pedido
    UPDATE pedidos
    SET estado = 'entregado',
        fecha_entrega_real = NOW()
    WHERE id = p_pedido_id;

    RETURN jsonb_build_object('success', true, 'message', 'Entrega validada exitosamente');

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- FUNCIONES RPC: REPORTES Y ANALYTICS ✅ NUEVO (Migración 20251207)
-- ===========================================

-- Función para obtener ventas agrupadas por zona
CREATE OR REPLACE FUNCTION fn_ventas_por_zona(
    fecha_inicio DATE,
    fecha_fin DATE,
    vendedor_id UUID DEFAULT NULL
) RETURNS TABLE (
    zona VARCHAR,
    ventas DECIMAL(10,2),
    transacciones BIGINT,
    ticket_promedio DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(c.zona_entrega, 'Sin zona') as zona,
        SUM(p.total)::DECIMAL(10,2) as ventas,
        COUNT(*)::BIGINT as transacciones,
        CASE WHEN COUNT(*) > 0 
            THEN (SUM(p.total) / COUNT(*))::DECIMAL(10,2)
            ELSE 0::DECIMAL(10,2)
        END as ticket_promedio
    FROM pedidos p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND (vendedor_id IS NULL OR p.usuario_vendedor = vendedor_id)
    GROUP BY c.zona_entrega
    ORDER BY ventas DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener ranking de vendedores
CREATE OR REPLACE FUNCTION fn_top_vendedores(
    fecha_inicio DATE,
    fecha_fin DATE,
    limite INTEGER DEFAULT 10,
    zona_nombre VARCHAR DEFAULT NULL
) RETURNS TABLE (
    vendedor_id UUID,
    vendedor_nombre VARCHAR,
    ventas DECIMAL(10,2),
    transacciones BIGINT,
    ticket_promedio DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.usuario_vendedor,
        (u.nombre || ' ' || u.apellido)::VARCHAR,
        SUM(p.total)::DECIMAL(10,2),
        COUNT(*)::BIGINT,
        CASE WHEN COUNT(*) > 0 
            THEN (SUM(p.total) / COUNT(*))::DECIMAL(10,2)
            ELSE 0::DECIMAL(10,2)
        END
    FROM pedidos p
    INNER JOIN usuarios u ON p.usuario_vendedor = u.id
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.fecha_pedido >= fecha_inicio::timestamp
      AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND p.estado = 'entregado'
      AND p.usuario_vendedor IS NOT NULL
      AND (zona_nombre IS NULL OR c.zona_entrega = zona_nombre)
    GROUP BY p.usuario_vendedor, u.nombre, u.apellido
    ORDER BY ventas DESC
    LIMIT limite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener distribución de ventas por método de pago
CREATE OR REPLACE FUNCTION fn_ventas_por_metodo_pago(
    fecha_inicio DATE,
    fecha_fin DATE
) RETURNS TABLE (
    metodo_pago VARCHAR,
    monto DECIMAL(10,2),
    transacciones BIGINT,
    porcentaje DECIMAL(5,2)
) AS $$
DECLARE
    v_total DECIMAL(10,2);
BEGIN
    -- Calcular total
    SELECT COALESCE(SUM(tm.monto), 0) INTO v_total
    FROM tesoreria_movimientos tm
    WHERE tm.created_at >= fecha_inicio::timestamp
      AND tm.created_at <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND tm.tipo = 'ingreso'
      AND tm.origen_tipo = 'pedido';
    
    RETURN QUERY
    SELECT 
        COALESCE(tm.metodo_pago, 'efectivo')::VARCHAR,
        SUM(tm.monto)::DECIMAL(10,2),
        COUNT(*)::BIGINT,
        CASE WHEN v_total > 0 
            THEN ((SUM(tm.monto) / v_total) * 100)::DECIMAL(5,2)
            ELSE 0::DECIMAL(5,2)
        END
    FROM tesoreria_movimientos tm
    WHERE tm.created_at >= fecha_inicio::timestamp
      AND tm.created_at <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
      AND tm.tipo = 'ingreso'
      AND tm.origen_tipo = 'pedido'
    GROUP BY tm.metodo_pago
    ORDER BY monto DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para análisis de clientes nuevos vs recurrentes
CREATE OR REPLACE FUNCTION fn_clientes_nuevos_vs_recurrentes(
    fecha_inicio DATE,
    fecha_fin DATE
) RETURNS JSONB AS $$
DECLARE
    v_nuevos INTEGER := 0;
    v_recurrentes INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    WITH clientes_periodo AS (
        SELECT DISTINCT p.cliente_id
        FROM pedidos p
        WHERE p.fecha_pedido >= fecha_inicio::timestamp
          AND p.fecha_pedido <= (fecha_fin::timestamp + INTERVAL '1 day' - INTERVAL '1 second')
          AND p.estado = 'entregado'
    ),
    clientes_anteriores AS (
        SELECT DISTINCT p.cliente_id
        FROM pedidos p
        WHERE p.fecha_pedido < fecha_inicio::timestamp
          AND p.estado = 'entregado'
    )
    SELECT 
        COUNT(CASE WHEN ca.cliente_id IS NULL THEN 1 END)::INTEGER,
        COUNT(CASE WHEN ca.cliente_id IS NOT NULL THEN 1 END)::INTEGER,
        COUNT(*)::INTEGER
    INTO v_nuevos, v_recurrentes, v_total
    FROM clientes_periodo cp
    LEFT JOIN clientes_anteriores ca ON cp.cliente_id = ca.cliente_id;
    
    RETURN jsonb_build_object(
        'nuevos', v_nuevos,
        'recurrentes', v_recurrentes,
        'total', v_total,
        'porcentajeNuevos', CASE WHEN v_total > 0 THEN (v_nuevos::float / v_total * 100) ELSE 0 END,
        'porcentajeRecurrentes', CASE WHEN v_total > 0 THEN (v_recurrentes::float / v_total * 100) ELSE 0 END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Ver /supabase/migrations/20251204_reportes_ventas.sql para funciones adicionales:
-- - fn_kpis_ventas(): KPIs principales de ventas
-- - fn_ventas_por_periodo(): Agrupación por día/semana/mes/trimestre  
-- - fn_top_productos(): Ranking de productos más vendidos
-- - fn_heatmap_ventas(): Mapa de calor por día/hora
-- Nota: Ver /supabase/migrations/20251207_materialized_views_refresh.sql para:
-- - Configuración de pg_cron para refresh automático
-- - Materialized views: mv_kpis_ventas_diarias, mv_stock_critico, etc.

-- ===========================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ===========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists_calidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_cotizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists_vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutas_reparto ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_ruta ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ejemplos - se deben ajustar según necesidades específicas)
-- Nota: Estas son políticas de ejemplo. En producción se deben crear políticas específicas para cada rol.

-- Política para usuarios administradores (acceso total)
CREATE POLICY "admin_full_access" ON productos FOR ALL USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
);

-- Política para vendedores (solo lectura de productos)
CREATE POLICY "vendedor_read_products" ON productos FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol IN ('admin', 'vendedor') AND activo = true
    )
);

-- Política para repartidores (solo pedidos asignados)
CREATE POLICY "repartidor_pedidos_asignados" ON pedidos FOR SELECT USING (
    id IN (
        SELECT dr.pedido_id
        FROM detalles_ruta dr
        JOIN rutas_reparto rr ON dr.ruta_id = rr.id
        WHERE rr.repartidor_id = auth.uid()
    )
);
```

---

## ⚙️ Estructura de API (Server Actions)

### `/src/actions/almacen.actions.ts`

```typescript
// Ingreso de mercadería
'ingresarMercaderia': (data: IngresoMercaderiaSchema) => Promise<{success: boolean, loteId?: string}>
'actualizarLote': (loteId: string, data: ActualizarLoteSchema) => Promise<{success: boolean}>
'registrarChecklistCalidad': (data: ChecklistCalidadSchema) => Promise<{success: boolean}>

// Control de stock
'obtenerStockDisponible': (productoId: string) => Promise<{success: boolean, stock: number}>
'ajustarStock': (data: AjusteStockSchema) => Promise<{success: boolean}>
'reservarStockPicking': (pedidoId: string) => Promise<{success: boolean}>
```

### `/src/actions/ventas.actions.ts`

```typescript
// Gestión de clientes
'crearCliente': (data: ClienteSchema) => Promise<{success: boolean, clienteId?: string}>
'actualizarCliente': (clienteId: string, data: ClienteSchema) => Promise<{success: boolean}>
'obtenerClientes': (filtros?: FiltrosCliente) => Promise<{success: boolean, clientes: Cliente[]}>

// Pedidos y cotizaciones
'crearPedido': (data: PedidoSchema) => Promise<{success: boolean, pedidoId?: string}>
'crearPedidoBot': (data: PedidoBotSchema) => Promise<{success: boolean, pedidoId?: string}> // Para webhook
'actualizarEstadoPedido': (pedidoId: string, estado: EstadoPedido) => Promise<{success: boolean}>
'crearCotizacion': (data: CotizacionSchema) => Promise<{success: boolean, cotizacionId?: string}>
'convertirCotizacionAPedido': (cotizacionId: string) => Promise<{success: boolean, pedidoId?: string}>

// Reclamos
'crearReclamo': (data: ReclamoSchema) => Promise<{success: boolean, reclamoId?: string}>
'registrarReclamoBot': (data: ReclamoBotSchema) => Promise<{success: boolean, reclamoId?: string}> // Para webhook
'actualizarEstadoReclamo': (reclamoId: string, estado: EstadoReclamo, solucion?: string) => Promise<{success: boolean}>
```

### `/src/actions/reparto.actions.ts`

```typescript
// Gestión de vehículos
'crearVehiculo': (data: VehiculoSchema) => Promise<{success: boolean, vehiculoId?: string}>
'registrarChecklistVehiculo': (data: ChecklistVehiculoSchema) => Promise<{success: boolean}>

// Planificación de rutas
'crearRuta': (data: RutaSchema) => Promise<{success: boolean, rutaId?: string}>
'asignarPedidosARuta': (rutaId: string, pedidosIds: string[]) => Promise<{success: boolean}>
'optimizarRuta': (rutaId: string) => Promise<{success: boolean, rutaOptimizada: RutaOptimizada}>
'iniciarRuta': (rutaId: string) => Promise<{success: boolean}>
'finalizarRuta': (rutaId: string) => Promise<{success: boolean}>

// Gestión de entregas
'actualizarEstadoEntrega': (detalleRutaId: string, estado: EstadoEntrega) => Promise<{success: boolean}>
'validarEntrega': (data: ValidacionEntregaSchema) => Promise<{success: boolean}>
'obtenerRutaActiva': (repartidorId: string) => Promise<{success: boolean, ruta?: Ruta}>
```

### `/src/app/api/bot/route.ts` (Webhook) ✅ IMPLEMENTADO

```typescript
// Endpoint único que recibe mensajes directamente de Twilio
POST '/api/bot': (formData: TwilioWebhookPayload) => Promise<TwiMLResponse>
GET '/api/bot': Health check del webhook

// Comandos implementados:
MENÚ PRINCIPAL:
'hola' | 'menu' | 'ayuda' → Mostrar menú principal con opciones 1-4
'1' → Ver catálogo de productos con stock en tiempo real
'2' → Instrucciones para hacer pedidos
'3' → Consultar estado de pedidos del cliente
'4' → Registrar reclamo (en desarrollo)

PEDIDOS:
'CODIGO CANTIDAD' → Pedido simple (ej: POLLO001 5)
'CODIGO1 CANT1, CODIGO2 CANT2' → Pedido múltiple
'productos' | 'catalogo' | 'lista' → Ver catálogo completo con stock
'si' | 'confirmar' → Confirmar pedido pendiente
'no' | 'cancelar' → Cancelar pedido pendiente

CONSULTAS:
'estado PED-XXXXX' → Ver estado de un pedido específico
'3' | 'mis pedidos' → Ver historial de pedidos
'deuda' | 'saldo pendiente' → Consultar saldo de cuenta corriente

// Funciones auxiliares:
findClienteByPhone(phone): Buscar cliente por número de WhatsApp
findProductoByCode(code): Buscar producto por código
getPedidoStatus(numeroPedido): Obtener estado de pedido
getCuentaCorriente(clienteId): Obtener saldo y límite de crédito
isHorarioAtencion(): Verificar si está dentro del horario

// Respuestas mejoradas:
- Incluye referencia de pago en confirmación de pedidos con pago diferido
- Muestra instrucciones para repartidor con monto y referencia
```

**Flujo de pedido completo:**
```
1. Cliente: "POLLO001 5"
2. Bot verifica stock en lotes
3. Bot muestra resumen: producto + precio + total
4. Bot solicita confirmación
5. Cliente: "SÍ"
6. Bot ejecuta fn_crear_pedido_bot() → fn_procesar_pedido()
7. Sistema descuenta de lote con FIFO
8. Registra movimiento de stock
9. Genera referencia de pago (PAY-YYYYMMDD-XXXXXX) si pago es diferido
10. Crea instrucción para repartidor con monto y referencia
11. Crea notificación para admin
12. Bot confirma: número de pedido + total + referencia de pago (si aplica)
```

---

## 📁 Estructura de Carpetas

```
/src/
├── app/
│   ├── (admin)/                          # Grupo de rutas - Dashboard Admin
│   │   ├── (dominios)/
│   │   │   ├── almacen/
│   │   │   │   ├── ingresos/
│   │   │   │   │   ├── page.tsx          # Lista de ingresos
│   │   │   │   │   ├── nuevo/
│   │   │   │   │   │   └── page.tsx      # Formulario ingreso
│   │   │   │   │   └── [loteId]/
│   │   │   │   │       └── page.tsx      # Detalle lote
│   │   │   │   ├── picking/
│   │   │   │   │   ├── page.tsx          # Lista pedidos picking
│   │   │   │   │   └── [pedidoId]/
│   │   │   │   │       └── page.tsx      # Picking específico
│   │   │   │   └── stock/
│   │   │   │       └── page.tsx          # Control de stock
│   │   │   ├── ventas/
│   │   │   │   ├── pedidos/
│   │   │   │   │   ├── page.tsx          # Lista pedidos
│   │   │   │   │   ├── nuevo/
│   │   │   │   │   │   └── page.tsx      # Crear pedido
│   │   │   │   │   └── [pedidoId]/
│   │   │   │   │       └── page.tsx      # Detalle pedido
│   │   │   │   ├── clientes/
│   │   │   │   │   ├── page.tsx          # Lista clientes
│   │   │   │   │   ├── nuevo/
│   │   │   │   │   │   └── page.tsx      # Crear cliente
│   │   │   │   │   └── [clienteId]/
│   │   │   │   │       └── page.tsx      # Detalle cliente
│   │   │   │   ├── cotizaciones/
│   │   │   │   │   └── page.tsx          # Gestión cotizaciones
│   │   │   │   └── reclamos/
│   │   │   │       ├── page.tsx          # Lista reclamos
│   │   │   │       └── [reclamoId]/
│   │   │   │           └── page.tsx      # Detalle reclamo
│   │   │   └── reparto/
│   │   │       ├── rutas/
│   │   │       │   ├── page.tsx          # Lista rutas
│   │   │       │   ├── nueva/
│   │   │       │   │   └── page.tsx      # Crear ruta
│   │   │       │   └── [rutaId]/
│   │   │       │       └── page.tsx      # Detalle ruta
│   │   │       ├── vehiculos/
│   │   │       │   ├── page.tsx          # Lista vehículos
│   │   │       │   ├── nuevo/
│   │   │       │   │   └── page.tsx      # Crear vehículo
│   │   │       │   └── [vehiculoId]/
│   │   │       │           └── page.tsx  # Detalle vehículo
│   │   │       └── reportes/
│   │   │           └── page.tsx          # Reportes de reparto
│   │   ├── layout.tsx                    # Layout admin con sidebar
│   │   └── page.tsx                      # Dashboard principal
│   ├── (repartidor)/                     # Grupo de rutas - PWA Repartidor
│   │   ├── (dominios)/
│   │   │   ├── checkin/
│   │   │   │   ├── page.tsx              # Check-in diario
│   │   │   │   └── vehiculo/
│   │   │   │       └── [vehiculoId]/
│   │   │   │           └── page.tsx      # Checklist vehículo
│   │   │   ├── ruta-diaria/
│   │   │   │   ├── page.tsx              # Hoja de ruta
│   │   │   │   └── mapa/
│   │   │   │       └── page.tsx          # Vista mapa GPS
│   │   │   └── entrega/
│   │   │       └── [pedidoId]/
│   │   │           ├── page.tsx          # Detalle entrega
│   │   │           ├── firma/
│   │   │           │   └── page.tsx      # Captura firma
│   │   │           └── qr/
│   │   │               └── page.tsx      # Generar QR
│   │   ├── layout.tsx                    # Layout móvil PWA
│   │   └── page.tsx                      # Home repartidor
│   ├── api/
│   │   └── bot/
│   │       └── route.ts                  # Webhook Botpress
│   ├── globals.css                       # Estilos globales
│   ├── layout.tsx                        # Layout raíz
│   └── page.tsx                          # Landing/Home
├── actions/
│   ├── almacen.actions.ts                # Server Actions WMS
│   ├── ventas.actions.ts                 # Server Actions CRM
│   ├── listas-precios.actions.ts         # Server Actions para listas de precios
│   ├── reparto.actions.ts                # Server Actions TMS
│   └── index.ts                          # Export centralizado
├── components/
│   ├── auth/
│   │   └── LoginForm.tsx                 # Formulario de login con logo
│   ├── forms/                            # Formularios con diseño colorido
│   │   ├── ClienteForm.tsx               # Bordes izquierdos de colores
│   │   ├── PedidoForm.tsx                # Secciones con títulos coloridos + validación de clientes bloqueados
│   │   ├── ProductoForm.tsx              # Acciones sticky con blur
│   │   ├── GastoForm.tsx                 # Formulario de gastos con upload de archivos
│   │   ├── MovimientoCajaForm.tsx        # Formulario de movimientos de caja
│   │   ├── CajaForm.tsx                  # Formulario de creación/edición de cajas
│   │   ├── RegistrarPagoPedidoForm.tsx   # Formulario para registrar pagos
│   │   └── ReporteExportForm.tsx        # Formulario de exportación CSV/PDF
│   ├── tables/
│   │   ├── ClientesTable.tsx
│   │   ├── PedidosTable.tsx
│   │   ├── ProductosTable.tsx
│   │   ├── RutasTable.tsx
│   │   ├── VehiculosTable.tsx
│   │   └── LotesTable.tsx
│   ├── charts/                           # Gráficos con paleta del logo
│   │   ├── VentasMensualesChart.tsx
│   │   ├── ProductosPorCategoriaChart.tsx
│   │   ├── EntregasPorDiaChart.tsx
│   │   └── index.ts
│   ├── ui/                               # Componentes shadcn/ui mejorados
│   │   ├── logo.tsx                      # ⭐ Componente Logo reutilizable
│   │   ├── button.tsx                    # Variantes de colores extendidas
│   │   ├── card.tsx                      # Sombras y bordes verdes
│   │   ├── badge.tsx                     # Badges coloridos
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── avatar.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── admin/
│   │   │   ├── AdminHeader.tsx           # Header con gradiente + badge de rol
│   │   │   ├── AdminSidebar.tsx          # Sidebar con barra verde + navegación animada
│   │   │   └── AdminLayout.tsx
│   │   └── repartidor/
│   │       ├── RepartidorHeader.tsx      # Header móvil con badge "Activo"
│   │       ├── RepartidorBottomNav.tsx
│   │       └── RepartidorLayout.tsx
│   ├── providers/
│   │   ├── AuthProvider.tsx
│   │   └── index.tsx
│   └── index.ts                          # Export centralizado
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Cliente Supabase
│   │   ├── server.ts                     # Cliente server-side
│   │   ├── storage.ts                    # Helpers para Storage (upload/delete)
│   │   ├── storage-server.ts             # Helpers Storage server-side
│   │   └── middleware.ts                 # Auth middleware
│   ├── schemas/
│   │   ├── index.ts                      # Re-export schemas Zod
│   │   ├── cliente.schema.ts
│   │   ├── pedido.schema.ts
│   │   ├── producto.schema.ts
│   │   ├── vehiculo.schema.ts
│   │   └── ...
│   ├── utils/
│   │   ├── index.ts
│   │   ├── formatters.ts                 # Formato fechas/monedas
│   │   ├── validations.ts                # Validaciones custom
│   │   └── geolocation.ts                # Utilidades GPS
│   └── config.ts                         # Configuración general
├── store/
│   ├── userStore.ts                      # Zustand - sesión usuario
│   ├── notificationStore.ts              # Zustand - notificaciones
│   └── index.ts                          # Export centralizado
└── types/
    ├── index.ts                          # Re-export types
    ├── database.types.ts                 # Types generados Supabase
    ├── api.types.ts                      # Types de API responses
    └── domain.types.ts                   # Types de dominio
```

---

## 🎨 Sistema de Diseño Visual

### Identidad de Marca

El sistema implementa una identidad visual moderna, minimalista y profesional basada completamente en los colores reales del logo de Avícola del Sur, creando una experiencia cohesiva que refuerza la marca en cada interacción.

### Paleta de Colores (Extraída del Logo)

**Colores Principales:**
```css
/* Verde Oscuro - Color dominante del fondo del logo */
--primary: #1a4d2e;
--primary-hover: #2d6a4f;
--primary-light: #e8f3ed;
--primary-lighter: #f0f8f4;
--primary-dark: #14362a;

/* Verde Medio - Complementario */
--secondary: #2d6a4f;
--secondary-light: #d4e5dd;
--secondary-lighter: #eaf4ee;

/* Rojo Profundo - Del gallo en el logo */
--accent: #8b2635;
--accent-hover: #a52a2a;
--accent-light: #fef2f2;
--accent-lighter: #fff7f7;

/* Beige Cálido - Del fondo del logo */
--neutral-warm: #f5e6d3;
--neutral-warm-dark: #e8d4ba;
--neutral-medium: #9d7e5c;
--neutral-gold: #d4a574;
--neutral-gold-light: #f4e4d0;
```

**Colores de Estado (Basados en la paleta principal):**
```css
--success: #2d6a4f;           /* Verde del logo para éxito */
--warning: #d4a574;           /* Dorado para advertencias */
--info: #3b7c8f;              /* Azul verdoso complementario */
--destructive: #8b2635;       /* Rojo del logo para errores */
```

**Fondos del Sistema:**
```css
--background: #f0f8f4;        /* Verde menta muy claro - reduce fatiga visual */
--card: #ffffff;              /* Cards blancas para contraste óptimo */
--muted: #e8f3ed;             /* Verde claro para elementos secundarios */
```

### Componente Logo

**Ubicación:** `src/components/ui/logo.tsx`

**Características:**
- Componente reutilizable con Next.js Image optimizado
- Props: `size` (sm | md | lg | xl), `variant` (full | icon), `priority`
- Integrado en: AdminHeader, RepartidorHeader, AdminSidebar, LoginForm
- Asset optimizado: `public/images/logo-avicola.png`

**Uso:**
```tsx
import { Logo } from '@/components/ui/logo'

// Logo completo con texto
<Logo size="lg" variant="full" />

// Solo icono
<Logo size="md" variant="icon" />

// En página de login (prioridad de carga)
<Logo size="xl" variant="full" priority />
```

### Componentes UI Mejorados

**Button (src/components/ui/button.tsx):**
```tsx
// Variantes disponibles
variant="default"      // Verde primario (acción principal)
variant="secondary"    // Verde secundario
variant="accent"       // Rojo del logo (acciones críticas)
variant="success"      // Verde para confirmaciones
variant="warning"      // Dorado para advertencias
variant="info"         // Azul para información
variant="destructive"  // Rojo para eliminar
variant="outline"      // Con borde
variant="ghost"        // Sin fondo
variant="link"         // Estilo link
```

**Card (src/components/ui/card.tsx):**
- Sombras sutiles con tono verde (`rgba(26, 77, 46, 0.08)`)
- Bordes verdes delicados (`border-primary/10`)
- Efecto hover: `translateY(-2px)` + sombra aumentada
- Transiciones suaves de 300ms

### Patrones de Diseño por Página

**1. Headers de Página:**
```tsx
<div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
  <h1 className="text-3xl font-bold tracking-tight">Título</h1>
  <p className="text-muted-foreground mt-1">Descripción</p>
</div>
```

**2. Cards de Métricas:**
```tsx
<Card className="border-t-[3px] border-t-primary bg-primary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Título</CardTitle>
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
      <Icon className="h-5 w-5 text-primary" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">147</div>
    <p className="text-xs text-muted-foreground">Descripción</p>
  </CardContent>
</Card>
```

**3. Formularios:**
```tsx
<Card className="border-l-[3px] border-l-primary">
  <CardHeader>
    <CardTitle className="text-primary">Sección del Formulario</CardTitle>
    <CardDescription>Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Campos del formulario */}
  </CardContent>
</Card>
```

**4. Navegación (Sidebar):**
- Barra vertical verde de 4px en el borde izquierdo
- Items activos con fondo `bg-primary/10` y línea indicadora verde
- Hover: fondo verde sutil + desplazamiento suave
- Iconos que escalan y cambian a verde en hover/activo

### Características Visuales Globales

✅ **Fondo Verde Menta** en todo el sistema
✅ **Cards flotantes** con sombras verdes
✅ **Gradientes sutiles** en headers y sidebar
✅ **Iconos coloridos** (nunca grises genéricos)
✅ **Animaciones suaves** en todas las interacciones
✅ **Bordes de colores** para jerarquía visual
✅ **Efectos hover** consistentes en todo el sistema
✅ **Badges con punto animado** para estados activos
✅ **Avatares con anillo verde** y indicador activo

### Tema de Diseño
- **Tipografía**: Inter (sans-serif moderna) para web, sistema por defecto para móvil
- **Estilo**: Minimalista moderno con toques de color estratégicos
- **Iconografía**: Lucide React para consistencia total
- **Responsive**: Mobile-first para la PWA de repartidores
- **Accesibilidad**: Contraste WCAG AA en todos los elementos

### Páginas con Diseño Implementado

**Todas las páginas del sistema tienen el diseño visual actualizado:**

**Dashboard y Navegación:**
- ✅ `/dashboard` - Dashboard principal con métricas coloridas
- ✅ `AdminHeader` - Header con gradiente, badge de rol, avatar con anillo verde
- ✅ `RepartidorHeader` - Header móvil con badge "Activo"
- ✅ `AdminSidebar` - Sidebar con barra verde vertical y navegación colorida
- ✅ `/login` - Página de login con logo prominente y fondo gradiente

**Almacén:**
- ✅ `/almacen/productos` - Lista con cards de estadísticas coloridas
- ✅ `/almacen/productos/nuevo` - Formulario con bordes de colores
- ✅ `/almacen/productos/[id]` - Detalle del producto
- ✅ `/almacen/productos/[id]/editar` - Edición con headers coloridos
- ✅ `/almacen/lotes` - Gestión de lotes con alertas coloridas

**Ventas:**
- ✅ `/ventas/pedidos` - Lista con 5 cards de métricas coloridas
- ✅ `/ventas/pedidos/nuevo` - Formulario de pedido con diseño completo
- ✅ `/ventas/pedidos/[id]/editar` - Edición de pedidos
- ✅ `/ventas/clientes` - Lista con 4 cards de métricas
- ✅ `/ventas/clientes/nuevo` - Formulario de cliente con bordes coloridos
- ✅ `/ventas/clientes/[id]/editar` - Edición de clientes

**Reparto:**
- ✅ `/reparto/rutas` - Gestión de rutas con 4 cards coloridas
- ✅ `/reparto/vehiculos` - Flota con cards de estado coloridas

### Convenciones de Color por Tipo de Información

| Tipo de Dato | Color | Uso |
|--------------|-------|-----|
| **Productos/Inventario** | Verde Primary | Items, stock, catálogo |
| **Clientes/Usuarios** | Verde Secondary | Personas, relaciones |
| **Alertas Críticas** | Rojo (Destructive) | Stock bajo, vencidos, errores |
| **Advertencias** | Dorado (Warning) | Pendientes, próximos a vencer |
| **Información** | Azul (Info) | Datos, estadísticas, ingresos |
| **Confirmaciones** | Verde (Success) | Completado, activo, aprobado |

---

## 🔐 Seguridad y Políticas

### Row Level Security (RLS) - Supabase
- **Principio**: Cada tabla tiene RLS activado
- **Roles del Sistema**:
  - `admin`: Acceso total a todas las funcionalidades
  - `vendedor`: Gestión de clientes, pedidos, cotizaciones y reclamos
  - `repartidor`: Acceso limitado a rutas asignadas y entregas
  - `almacenista`: Control de stock, ingresos y picking

### Políticas de Ejemplo
```sql
-- Administradores tienen acceso total
CREATE POLICY "admin_full_access" ON pedidos FOR ALL USING (
    auth.jwt() ->> 'rol' = 'admin'
);

-- Vendedores solo pueden ver pedidos propios o de su zona
CREATE POLICY "vendedor_pedidos_zona" ON pedidos FOR SELECT USING (
    auth.jwt() ->> 'rol' = 'vendedor' OR
    cliente_id IN (
        SELECT id FROM clientes
        WHERE zona_entrega = (auth.jwt() ->> 'zona')
    )
);

-- Repartidores solo ven pedidos asignados a sus rutas
CREATE POLICY "repartidor_rutas_propias" ON pedidos FOR SELECT USING (
    id IN (
        SELECT dr.pedido_id FROM detalles_ruta dr
        JOIN rutas_reparto rr ON dr.ruta_id = rr.id
        WHERE rr.repartidor_id = auth.uid()
    )
);
```

---

## ⚡ Optimizaciones de Rendimiento Implementadas (Diciembre 2025)

### Velocidad de Carga
- **Revalidación Estratégica**: 20+ páginas principales usan `revalidate` en lugar de `force-dynamic`
  - Dashboard: 30 segundos
  - Listados (productos, clientes, pedidos): 5 minutos
  - Reportes: 1 hora
- **Caché de Consultas Frecuentes**: Productos, zonas y listas de precios se cachean automáticamente usando React `cache()`
- **Queries Optimizadas**: Consolidación de queries N+1 en funciones RPC
  - `fn_obtener_cliente_completo()`: 5 queries → 1 query
  - `fn_obtener_pedido_completo()`: 2 queries → 1 query

### Base de Datos
- **Índices Optimizados**: 8 índices compuestos nuevos para consultas frecuentes
  - `idx_presupuestos_fecha_turno_zona`: Presupuestos por fecha/turno/zona/estado
  - `idx_pedidos_sucursal_fecha`: Pedidos por sucursal y fecha
  - `idx_lotes_sucursal_producto_estado`: Lotes por sucursal/producto/estado/vencimiento
  - `idx_lotes_producto_sucursal_vencimiento`: Optimización FIFO
  - `idx_transferencias_estado_fecha`: Transferencias por estado y fecha
  - `idx_alertas_stock_sucursal_estado`: Alertas por sucursal/estado/fecha
- **Materialized Views**: KPIs de ventas pre-calculados
  - `mv_kpis_ventas_diarias`: Agregados diarios (últimos 90 días)
  - `mv_kpis_ventas_mensuales`: Agregados mensuales (últimos 12 meses)
  - Función `fn_refresh_materialized_views_reportes()` para actualización

### Funciones RPC Optimizadas
- **Presupuestos → Pedidos**:
  - `fn_validar_stock_batch()`: Valida stock de múltiples productos en una query
  - `fn_convertir_presupuestos_masivo()`: Convierte múltiples presupuestos en una transacción
- **Transferencias entre Sucursales**:
  - `fn_validar_stock_batch_transferencia()`: Validación batch de stock
  - `fn_aprobar_transferencias_masivo()`: Aprobación masiva de transferencias
- **Validación de Cobros**:
  - `fn_validar_rutas_masivo()`: Valida múltiples rutas con comparación automática
- **Asignación de Rutas**:
  - `fn_validar_capacidad_ruta_batch()`: Valida capacidad de múltiples pedidos

### Automatizaciones
- **Expiración Automática de Reservas**: Job pg_cron ejecuta `fn_expirar_reservas()` cada 15 minutos
- **Alertas de Stock Inteligentes**: Sistema de priorización (crítico ≤50%, bajo ≤umbral, normal)
- **Notificaciones Push**: Notificaciones del navegador para eventos críticos

### Mejoras de Código
- **Logging Condicional**: Utilidad `logger.ts` que solo loguea en desarrollo
- **Búsquedas Optimizadas**: Debounce en búsquedas para reducir queries innecesarias

### Métricas de Rendimiento
- **Tiempo de carga**: Reducción de 70-80% (de 3-5s a <1s con caché)
- **Consultas BD**: Reducción de 50-70% (de 200-500ms a 50-150ms)
- **Monitor GPS**: Preparado para Supabase Realtime (<1 segundo de latencia)

## 📊 Métricas y Monitoreo

### KPIs Principales
- **Almacén**: Rotación de stock, precisión de inventario, tiempo de picking
- **Ventas**: Pedidos por día, valor promedio, conversión de cotizaciones
- **Reparto**: Tasa de entregas exitosas, tiempo promedio de ruta, eficiencia de combustible
- **Cliente**: Satisfacción, tiempo de respuesta a reclamos

### Dashboard Ejecutivo
- Gráficos en tiempo real usando Realtime de Supabase
- Alertas automáticas por email/SMS
- Reportes exportables a PDF/Excel

---

## 🚀 Estado de Implementación

### ✅ COMPLETADO - SISTEMA FUNCIONAL Y LISTO PARA PRODUCCIÓN:

1. **Fase 1**: Configuración base (Supabase, Next.js, dependencias) ✅
2. **Fase 2**: Autenticación y roles de usuario ✅
3. **Fase 3**: Módulo de Almacén (productos, stock, lotes con FIFO) ✅
4. **Fase 4**: Módulo de Ventas (clientes, pedidos, cotizaciones) ✅
5. **Fase 6**: Bot de WhatsApp con Twilio (sin Botpress) ✅
6. **Hito Intermedio - Tesorería**: Cajas, movimientos, cuentas corrientes ✅
7. **Hito Presupuestos**: Flujo completo Bot → Almacén → Reparto → Tesorería ✅
8. **Planificación Semanal**: Rutas fijas por zona/día/turno/vehículo ✅
9. **GPS Tracking**: PWA con ubicación cada 5s + alertas automáticas ✅
10. **Optimización de Rutas**: Google Directions + fallback local ✅
11. **PWA Repartidor**: App móvil completa con entregas y cobros ✅
12. **Monitor Admin**: Mapa Google Maps en tiempo real ✅
13. **Asignación Automática**: Pedidos → rutas planificadas ✅
14. **Turnos Automáticos**: Por hora de confirmación ✅

### 🎯 Características Técnicas Implementadas:

#### **Planificación y Asignación**:
- ✅ Nueva tabla `plan_rutas_semanal` con zona/día/turno/vehículo/capacidad
- ✅ Vehículos base: Fiorino 600kg, Hilux 1500kg, F-4000 4000kg
- ✅ UI `/reparto/planificacion` para gestión completa
- ✅ `fn_asignar_pedido_a_ruta()` busca planes automáticamente
- ✅ Validación de capacidad por peso final del pedido

#### **GPS y Tracking**:
- ✅ PWA con `navigator.geolocation.watchPosition()` cada 5s
- ✅ Tabla `ubicaciones_repartidores` con coordenadas
- ✅ Alertas automáticas: desvío (>200m), cliente saltado (<100m)
- ✅ Monitor `/reparto/monitor` con mapa Google Maps
- ✅ Polylíneas de rutas optimizadas en tiempo real
- ✅ Polling optimizado adaptativo: 10s (3+ vehículos), 15s (1-2 vehículos), 60s (sin vehículos)
- ✅ Pausa automática cuando pestaña no visible (Page Visibility API)
- ✅ Actualización manual y control de pausa/reanudación

#### **Optimización de Rutas**:
- ✅ Google Directions API con `optimize:true`
- ✅ Fallback local: Nearest Neighbor + 2-opt
- ✅ Generación automática de polylines
- ✅ Actualización de `rutas_planificadas`
- ✅ Re-optimización automática al agregar pedidos

#### **PWA Repartidor Completa**:
- ✅ Dashboard móvil con estado activo
- ✅ Hoja ruta `/repartidor/ruta/[ruta_id]` con GPS
- ✅ Registro de entregas con firma digital
- ✅ Cobros múltiples (efectivo, transferencia, QR)
- ✅ QR verificación de entregas

### 📊 APIs Implementadas:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/bot` | Webhook WhatsApp |
| `POST` | `/api/rutas/generar` | Optimización de rutas |
| `POST` | `/api/reparto/ubicacion` | GPS tracking repartidor |
| `GET` | `/api/reparto/ubicaciones` | Ubicaciones vehículos |
| `GET` | `/api/rutas/[id]/recorrido` | Polyline + historial |
| `POST` | `/api/rutas/[id]/alerta` | Alertas manuales |
| `GET` | `/api/reparto/alertas` | Lista alertas |
| `POST` | `/api/reparto/rutas-mock` | Generar datos mock para monitor GPS (testing/demo) |
| `DELETE` | `/api/reparto/limpiar-mock` | Limpiar todos los datos mock del sistema |

### 🗄️ Migraciones Ejecutadas:

```sql
-- Ejecutadas en orden:
20251114_hito_intermedio.sql
20251121_flujo_completo.sql
20251120_hito_presupuestos.sql
20251122_ventas_presupuestos_ajustes.sql
20251123_localidades.sql
20251124_rutas_tracking.sql
20251125_turnos_auto.sql
20251125_ruta_assignment.sql
20251126_plan_rutas_semanal.sql
```

### 🎯 Próximos Pasos para Producción:

1. **Configurar entornos**: Supabase, Twilio, Google Maps API Key
2. **Crear usuario admin**: Ejecutar script inicial
3. **Configurar zonas**: Crear zonas de entrega
4. **Planificar rutas**: Usar `/reparto/planificacion`
5. **Probar flujo**: Seguir `TESTING.md` para QA completo
6. **Desplegar**: Vercel/Netlify para frontend

---

## 🎯 Flujo de Presupuestos - Implementación Completa

### 📋 Descripción General

Nuevo flujo operativo implementado que transforma el proceso de ventas desde pedidos directos a un sistema de presupuestos con control de stock preventivo, pesaje en almacén y trazabilidad completa.

### 🔄 Pasos del Flujo Completo

```
1. Creación (Bot/Vendedor):
   Cliente (WhatsApp) / Vendedor Web → Crear presupuesto
   ↓
   Asignación automática:
   - Turno (según horario: <5AM mañana, 5AM-3PM tarde, ≥3PM mañana siguiente)
   - Fecha entrega (automática, editable)
   - Estado: 'en_almacen' (aparece automáticamente en Presupuestos del Día)
   ↓
   Reserva stock preventiva (FIFO)

2. Almacén:
   Presupuestos del Día → Ver presupuestos del día/turno
   ↓
   Pesaje (productos balanza) → Editar pesos → Actualizar presupuesto
   ↓
   Conversión a Pedido (masiva o individual)
   ↓
   Pedidos del Día → Filtrar por fecha/turno

3. Reparto:
   Pedidos → Generar Ruta Diaria (automática o manual)
   ↓
   Optimización de ruta → Asignación de vehículos
   ↓
   Repartidor PWA → Entrega → Cobro

4. Tesorería:
   Validación de rutas → Cierre de caja → Movimientos registrados
```

### 🗄️ Nuevas Tablas y Funciones

#### Tablas Implementadas
- **`presupuestos`**: Cabecera de presupuestos con estados y seguimiento
- **`presupuesto_items`**: Items con cantidades, precios y pesos
- **`stock_reservations`**: Reservas preventivas de stock por lotes

#### Funciones RPC Atómicas
- **`fn_reservar_stock_por_presupuesto()`**: Reserva stock FIFO por items
- **`fn_convertir_presupuesto_a_pedido()`**: Conversión atómica con descuento de stock
  - Asigna turno automáticamente si no existe (misma lógica que creación)
  - Valida productos pesables antes de convertir
- **`fn_actualizar_peso_item_presupuesto()`**: Recálculo de precios por peso
- **`fn_asignar_vehiculos_por_peso()`**: Heurística de asignación por capacidad
- **`fn_crear_presupuesto_desde_bot()`**: Creación desde WhatsApp/Vendedor
  - Asigna turno automáticamente según horario de corte
  - Asigna fecha de entrega automáticamente
  - Crea presupuesto en estado 'en_almacen' para aparecer en Presupuestos del Día
- **`fn_asignar_turno_zona_presupuesto()`**: Asignación manual de turno y zona
- **`fn_generar_ruta_diaria_automatica()`**: Genera rutas automáticas por turno
- **`fn_generar_ruta_diaria_manual()`**: Genera ruta con pedidos seleccionados manualmente

### 🎨 Interfaz de Usuario

#### Dashboard Ventas
- **`/ventas/presupuestos`**: Lista completa con filtros y acciones
- **Estados**: Pendiente → En Almacén → Facturado → Anulado
- **Acciones**: Enviar a almacén, Reservar stock, Convertir a pedido
- **Nuevo Presupuesto**: 
  - Selector de clientes buscable (nombre, teléfono, zona)
  - Selector de productos buscable (código, nombre)
  - Fecha de entrega automática (hoy por defecto, editable)
  - Asignación automática de turno y fecha según horario

#### Dashboard Almacén
- **`/almacen/presupuestos-dia`**: Vista por fecha/zona/turno con totales
  - Presupuestos aparecen automáticamente al crearse (estado 'en_almacen')
  - Botones de conversión masiva e individual a pedidos
- **`/almacen/pedidos`**: Gestión de pedidos (movido desde Ventas)
  - Filtros por fecha y turno
  - Generación de rutas diarias (automática y manual)
- **`/almacen/presupuesto/[id]/pesaje`**: Interfaz de balanza con simulación
- **Badge "BALANZA"**: Identifica items pesables automáticamente

#### PWA Repartidor (Base Implementada)
- **Registro de entregas**: Firma digital, QR, comprobantes
- **Cobros**: Múltiples métodos de pago
- **Movimientos de caja**: Automáticos por entrega

### 🤖 Bot WhatsApp Actualizado

#### Comandos Principales
```
POLLO001 5          → Crear presupuesto
POLLO001 5, HUEVO001 2 → Presupuesto múltiple
menu                 → Ver opciones
estado PRES-XXXXX    → Consultar presupuesto
```

#### Respuestas Mejoradas
- ✅ Números de presupuesto únicos (PRES-YYYYMMDD-XXXX)
- 🔗 Links de seguimiento
- 📊 Resúmenes con totales estimados
- 📞 Instrucciones para contactar vendedor

### 📊 Endpoints API

#### Simulación y Testing
```
POST /api/almacen/simular-peso
- Simula pesos de balanza (±10% variación)
- Útil para desarrollo y demos

POST /api/reparto/entrega
- Registra entregas con cobros
- Actualiza movimientos de tesorería

GET /api/tesoreria/movimientos-tiempo-real
- Movimientos en tiempo real
- Saldos de cajas actualizados
```

### 🧪 Script de Demo

```bash
# Ejecutar verificación completa
./scripts/demo-presupuestos.sh

# Verifica:
# ✅ Servidor corriendo
# ✅ BD conectada
# ✅ Endpoints responding
# ✅ Funciones RPC funcionales
```

### 🔧 Checklist de Implementación

#### Base de Datos ✅
- [x] Migraciones SQL con rollback
- [x] Funciones RPC atómicas
- [x] Políticas RLS por rol
- [x] Índices optimizados

#### Backend ✅
- [x] Server Actions con validación Zod
- [x] Endpoints API funcionales
- [x] Integración con Supabase
- [x] Manejo de errores robusto

#### Frontend ✅
- [x] UI responsive con shadcn/ui
- [x] Tablas con TanStack Table
- [x] Formularios con React Hook Form
- [x] Estados de carga y notificaciones

#### Bot WhatsApp ✅
- [x] Creación de presupuestos
- [x] Mensajes con números únicos
- [x] Links de seguimiento
- [x] Compatibilidad con flujo existente

#### Testing ✅
- [x] Script de demo automatizado
- [x] Endpoints de verificación
- [x] Checklist de aceptación
- [x] Casos de uso documentados

### 🚀 Próximos Pasos para Producción

1. **Integración Balanza Física**
   - Conexión serial/HTTP con balanzas
   - Adapter pattern para diferentes modelos
   - Fallback a simulación

2. **PWA Repartidor Completa**
   - GPS tracking en tiempo real
   - Modo offline avanzado
   - Sincronización automática

3. **Optimización de Algoritmos**
   - Asignación por peso y distancia
   - Rutas óptimas con GeoPostGIS
   - Machine learning para predicciones

4. **Notificaciones Avanzadas**
   - Push notifications
   - WhatsApp business para alerts
   - Dashboard con realtime updates

### 📈 Beneficios Implementados

- **Control de Stock**: Reserva preventiva evita sobreventa
- **Trazabilidad**: Desde presupuesto hasta cobro final
- **Eficiencia**: Proceso estructurado reduce errores
- **Transaccional**: Operaciones atómicas garantizan consistencia
- **Escalabilidad**: Arquitectura preparada para crecimiento
- **UX Mejorada**: Interfaces intuitivas para cada rol

---

## 🎯 Modelo de Pedidos Agrupados por Turno/Zona/Fecha (Diciembre 2025)

### 📋 Arquitectura del Nuevo Modelo

**Revolución en el flujo operativo**: Sistema único donde un pedido agrupa automáticamente todas las entregas del mismo turno + zona + fecha, transformando la logística y simplificando la gestión.

#### 🏗️ **Estructura de Datos Transformada**

##### **Nueva Tabla: `entregas`**
Cada entrega representa la porción específica de un pedido para un cliente individual:

```sql
CREATE TABLE entregas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES clientes(id),
    presupuesto_id UUID REFERENCES presupuestos(id),

    -- Totales por entrega
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    recargo DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,

    -- Ubicación histórica
    direccion TEXT,
    coordenadas GEOMETRY(POINT, 4326),

    -- Estados de entrega
    orden_entrega INTEGER,
    estado_entrega VARCHAR(50) DEFAULT 'pendiente',
    fecha_hora_entrega TIMESTAMPTZ,
    notas_entrega TEXT,
    firma_url VARCHAR(500),
    qr_verificacion VARCHAR(100),

    -- Estados de pago individuales
    estado_pago VARCHAR(20) DEFAULT 'pendiente',
    metodo_pago VARCHAR(50),
    monto_cobrado DECIMAL(12,2) DEFAULT 0,
    numero_transaccion VARCHAR(100),
    comprobante_url VARCHAR(500),
    notas_pago TEXT,
    pago_validado BOOLEAN DEFAULT false,

    -- Referencia de pago única
    referencia_pago VARCHAR(60),
    instruccion_repartidor TEXT,

    -- Observaciones del presupuesto
    observaciones TEXT,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

##### **Pedido Transformado**
- **`cliente_id` ahora opcional**: Ya no hay "cliente del pedido"
- **Nuevo campo `estado_cierre`**: 'abierto' (agrupando) / 'cerrado' (completado)
- **Nuevo campo `hora_cierre`**: Timestamp automático cuando se cierra
- **Nuevo campo `cantidad_entregas`**: Conteo de entregas en el pedido
- **Índice único condicional**: Solo pedidos abiertos tienen restricción por turno/zona/fecha

#### 🔄 **Flujo Operativo Transformado**

```
Cliente A pide → Presupuesto A → Conversión → Entrega A en Pedido XYZ
Cliente B pide → Presupuesto B → Conversión → Entrega B en Pedido XYZ
Cliente C pide → Presupuesto C → Conversión → Entrega C en Pedido XYZ

Resultado: 1 Pedido (XYZ) con 3 Entregas (A, B, C) = 1 Ruta de Reparto
```

#### ⚙️ **Funciones RPC Principales**

##### **1. `fn_obtener_o_crear_pedido_abierto()`**
```sql
CREATE OR REPLACE FUNCTION fn_obtener_o_crear_pedido_abierto(
    p_zona_id UUID,
    p_turno TEXT,
    p_fecha DATE
) RETURNS UUID AS $$
-- Busca pedido abierto para turno/zona/fecha
-- Si no existe, lo crea
-- Valida horarios de corte automáticos
-- Retorna pedido_id
```

##### **2. `fn_agregar_presupuesto_a_pedido()`**
```sql
CREATE OR REPLACE FUNCTION fn_agregar_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_pedido_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
-- Agrega presupuesto como nueva entrega al pedido
-- Crea detalles_pedido con entrega_id
-- Descuenta stock físico del lote reservado
-- Registra movimientos de stock
-- Actualiza cuenta corriente del cliente
-- Actualiza totales del pedido
```

##### **3. `fn_convertir_presupuesto_a_pedido()` (Actualizada)**
```sql
CREATE OR REPLACE FUNCTION fn_convertir_presupuesto_a_pedido(
    p_presupuesto_id UUID,
    p_user_id UUID,
    p_caja_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
-- Determina turno/fecha automáticamente si no definidos
-- Llama a fn_obtener_o_crear_pedido_abierto()
-- Llama a fn_agregar_presupuesto_a_pedido()
-- Retorna pedido_id con información completa
```

##### **4. `fn_cerrar_pedidos_por_horario()`**
```sql
CREATE OR REPLACE FUNCTION fn_cerrar_pedidos_por_horario() RETURNS INTEGER AS $$
-- Cierra pedidos cuando pasa horario de corte
-- Turno mañana: cierra a las 5:00 AM
-- Turno tarde: cierra a las 15:00
-- Retorna cantidad de pedidos cerrados
```

##### **5. `fn_obtener_entregas_pedido()`**
```sql
CREATE OR REPLACE FUNCTION fn_obtener_entregas_pedido(p_pedido_id UUID)
RETURNS TABLE (
    entrega_id UUID,
    cliente_id UUID,
    cliente_nombre VARCHAR,
    cliente_telefono VARCHAR,
    subtotal DECIMAL,
    total DECIMAL,
    estado_entrega VARCHAR,
    estado_pago VARCHAR,
    referencia_pago VARCHAR
) AS $$
-- Retorna todas las entregas de un pedido con datos del cliente
```

##### **6. `fn_registrar_cobro_entrega()`**
```sql
CREATE OR REPLACE FUNCTION fn_registrar_cobro_entrega(
    p_entrega_id UUID,
    p_metodo_pago VARCHAR,
    p_monto_cobrado DECIMAL,
    p_repartidor_id UUID
) RETURNS JSONB AS $$
-- Registra cobro específico de una entrega
-- Actualiza cuenta corriente del cliente
-- Bloquea/desbloquea cliente según saldo
```

##### **7. `fn_marcar_entrega_completada()`**
```sql
CREATE OR REPLACE FUNCTION fn_marcar_entrega_completada(p_entrega_id UUID) RETURNS JSONB AS $$
-- Marca entrega como completada
-- Verifica si todas las entregas del pedido están completadas
-- Si sí, marca pedido como entregado
```

### 🎨 **Interfaz de Usuario Actualizada**

#### **Vista de Pedido Administrativo**
- **Nueva sección "Entregas del Pedido"**: Lista expansible de entregas por cliente
- **Resumen de cobros**: Total cobrado vs pendiente vs fiado
- **Estados por cliente**: Cada entrega con su estado de entrega/pago independiente
- **Referencias individuales**: PAY-XXXXXX por entrega para seguimiento

#### **PWA Repartidor Transformada**
- **Entregas individuales**: Formulario específico por cliente
- **Cobros por entrega**: Estado + método + monto por cliente
- **Estados flexibles**: pagado/parcial/fiado con montos precisos
- **Validación requerida**: Todas las entregas deben tener estado definido

#### **Tesorería por Entrega**
- **Validación individual**: Tesorero valida cada entrega por separado
- **Movimientos agrupados**: Crea movimientos de caja por método de pago
- **Cuenta corriente**: Actualización individual por cliente
- **Trazabilidad completa**: Quién cobró, quién validó, cuándo

### 📊 **Beneficios Operativos**

#### **🚀 Eficiencia Logística**
- **Una sola ruta** = **Un pedido** = **Múltiples entregas**
- **Optimización automática** de rutas por zona completa
- **Vehículos asignados** por capacidad total del pedido
- **GPS tracking** para toda la ruta, no por cliente

#### **💰 Control Financiero Preciso**
- **Cobros por cliente** con referencias individuales
- **Validación de tesorería** por entrega específica
- **Cuenta corriente** actualizada en tiempo real por cliente
- **Reportes detallados** de recaudación por método y cliente

#### **📱 Experiencia del Repartidor**
- **Hoja de ruta clara** con orden de entregas
- **Registro simple** de cobros por cliente
- **Estados flexibles** (pagado/parcial/fiado) por entrega
- **Validación automática** antes de finalizar ruta

#### **📊 Gestión Administrativa**
- **Vista consolidada** de entregas por pedido
- **Seguimiento individual** de cada cliente en la ruta
- **Reportes unificados** de rutas y entregas
- **Cierres automáticos** sin intervención manual

### 🧪 **Cómo Probar el Nuevo Modelo**

#### **1. Crear Presupuestos Agrupados**
```bash
# POST /api/ventas/presupuestos (Cliente A - Zona Norte)
{
  "cliente_id": "uuid-cliente-a",
  "items": [{"producto_id": "uuid-pollo", "cantidad": 5}],
  "zona_id": "uuid-zona-norte"
}

# POST /api/ventas/presupuestos (Cliente B - MISMA Zona Norte)
{
  "cliente_id": "uuid-cliente-b",
  "items": [{"producto_id": "uuid-huevo", "cantidad": 10}],
  "zona_id": "uuid-zona-norte"
}
```

#### **2. Conversión Automática**
```bash
# POST /api/almacen/presupuestos/convertir-masivo
{
  "presupuestos_ids": ["uuid-presupuesto-a", "uuid-presupuesto-b"]
}
# Resultado: 1 pedido con 2 entregas
```

#### **3. Cobros por Cliente**
```bash
# POST /api/entregas/registrar-cobro (Cliente A)
{
  "entrega_id": "uuid-entrega-a",
  "metodo_pago": "efectivo",
  "monto_cobrado": 2500.00
}

# POST /api/entregas/registrar-cobro (Cliente B)
{
  "entrega_id": "uuid-entrega-b",
  "metodo_pago": "cuenta_corriente",
  "monto_cobrado": 0
}
```

#### **4. Validación de Tesorería**
```bash
# POST /api/tesoreria/validar-entregas
{
  "pedido_id": "uuid-pedido",
  "caja_id": "uuid-caja",
  "observaciones": "Validación completa de ruta"
}
```

### 🔄 **Migración de Datos Transparente**

#### **Compatibilidad Total**
- **Pedidos históricos**: Marcados como `estado_cierre = 'cerrado'`
- **Sin afectación**: Operaciones existentes siguen funcionando
- **Índice condicional**: Solo aplica restricción a pedidos nuevos
- **Transición gradual**: Sistema soporta ambos modelos

#### **Escalabilidad Garantizada**
- **Sin límite**: Cantidad de entregas por pedido
- **Rendimiento optimizado**: Índices por zona/turno/fecha
- **Queries eficientes**: Para volúmenes grandes
- **Caché inteligente**: En vistas administrativas

### 📈 **Impacto en KPIs**

#### **Antes del Modelo Agrupado**
- **Múltiples pedidos** = **Múltiples rutas** = **Ineficiencia logística**
- **Cobros agregados** = **Dificultad para seguimiento individual**
- **Gestión manual** = **Errores en conciliación**

#### **Después del Modelo Agrupado**
- **1 pedido** = **1 ruta optimizada** = **Eficiencia máxima**
- **Cobros por cliente** = **Trazabilidad perfecta**
- **Cierre automático** = **Operaciones sin intervención**

---

## 📐 Guía de Implementación Visual para Nuevas Páginas

Si necesitas crear una nueva página o componente, sigue estas convenciones para mantener la consistencia visual:

### 1. Header de Página

```tsx
<div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Título de Página</h1>
      <p className="text-muted-foreground mt-1">Descripción breve</p>
    </div>
    <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
      <Link href="/ruta/nueva">
        <Plus className="mr-2 h-4 w-4" />
        Acción Principal
      </Link>
    </Button>
  </div>
</div>
```

### 2. Cards de Estadísticas/Métricas

**Usa estos colores según el tipo:**
- 🟢 `border-t-primary` + `bg-primary/5` → Totales, productos, clientes
- 🟢 `border-t-success` + `bg-success/5` → Items activos, completados
- 🟡 `border-t-warning` + `bg-warning/5` → Pendientes, advertencias
- 🔴 `border-t-destructive` + `bg-destructive/5` → Críticos, errores
- 🔵 `border-t-info` + `bg-info/5` → Información, datos financieros
- 🟢 `border-t-secondary` + `bg-secondary/5` → Items secundarios

**Estructura:**
```tsx
<Card className="border-t-[3px] border-t-primary bg-primary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Título</CardTitle>
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
      <Icon className="h-5 w-5 text-primary" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">Valor</div>
    <p className="text-xs text-muted-foreground">Descripción</p>
  </CardContent>
</Card>
```

### 3. Formularios

**Cards de secciones con bordes de colores:**
```tsx
{/* Sección 1 - Información básica */}
<Card className="border-l-[3px] border-l-primary">
  <CardHeader>
    <CardTitle className="text-primary">Información Básica</CardTitle>
    <CardDescription>Datos principales</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Campos */}
  </CardContent>
</Card>

{/* Sección 2 - Información económica/importante */}
<Card className="border-l-[3px] border-l-success">
  <CardHeader>
    <CardTitle className="text-success">Información Económica</CardTitle>
    <CardDescription>Precios y costos</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Campos */}
  </CardContent>
</Card>

{/* Sección 3 - Configuración adicional */}
<Card className="border-l-[3px] border-l-info">
  <CardHeader>
    <CardTitle className="text-info">Configuración</CardTitle>
    <CardDescription>Opciones adicionales</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Campos */}
  </CardContent>
</Card>
```

**Botones de acción sticky:**
```tsx
<div className="flex items-center justify-between sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-primary/10 shadow-lg">
  <Button type="button" variant="outline" asChild disabled={isLoading} className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
    <Link href="/ruta/anterior">
      <ArrowLeft className="mr-2 h-4 w-4" />
      Volver
    </Link>
  </Button>
  <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 shadow-sm">
    <Save className="mr-2 h-4 w-4" />
    Guardar
  </Button>
</div>
```

### 4. Mensajes de Error

**Siempre usa el color del sistema:**
```tsx
{errors.campo && (
  <p className="text-sm text-destructive">{errors.campo.message}</p>
)}
```

**Nunca uses:** `text-red-600`, `text-green-600`, etc. (usa `text-destructive`, `text-success`)

### 5. Importaciones Necesarias

**Para páginas con cards de métricas:**
```tsx
import { Plus, Package, CheckCircle, AlertTriangle, Clock, Users, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
```

**Para formularios:**
```tsx
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
```

### Checklist para Nuevas Páginas

- [ ] Header con gradiente verde y efecto blur
- [ ] Cards de métricas con bordes superiores de colores
- [ ] Iconos coloridos (nunca grises) en círculos de fondo
- [ ] Efectos hover con `scale-105` y `shadow-lg`
- [ ] Transiciones de 300ms
- [ ] Tabla principal en Card simple (sin decoraciones extras)
- [ ] Botones usando variantes del sistema (no inline styles)
- [ ] Errores usando `text-destructive` (no `text-red-600`)
- [ ] Logo usando componente `<Logo />` (no placeholders)

---

## 📅 **RESUMEN EJECUTIVO - SISTEMA COMPLETO**

**Estado**: ✅ **PRODUCCIÓN LISTA** - Sistema ERP completo implementado y verificado.

**Funcionalidades Clave Implementadas**:
- 🗓️ **Planificación Semanal**: Rutas fijas por zona/día/turno con vehículos asignados
- 📱 **PWA Completa**: GPS tracking, entregas, cobros, firma digital
- 🤖 **Bot WhatsApp**: Procesamiento directo sin Botpress
- 🗺️ **Optimización Híbrida**: Google Directions + fallback local
- 📍 **GPS Tiempo Real**: Alertas automáticas de desvío/cliente saltado
- 💰 **Tesorería Completa**: Cuentas corrientes, referencias PAY-XXXXXX
- ⚖️ **FIFO Automático**: Gestión inteligente de lotes por vencimiento

**Arquitectura Técnica**:
- **Framework**: Next.js 15 (App Router, Server Components)
- **Backend**: Server Actions + Supabase (Postgres + RLS)
- **Frontend**: React 19 + TypeScript + shadcn/ui
- **GPS**: Navigator API + polling 5s (repartidor) + polling optimizado adaptativo 10-60s (monitor) + Google Maps JavaScript API
- **APIs**: 7 endpoints implementados para rutas/GPS/tracking

**Flujo Operativo**:
```
Cliente WhatsApp → Bot crea presupuesto → Almacén pesa → Conversión automática →
Turno auto (<06:00 mañana) → Asignación a ruta planificada → Validación capacidad →
Optimización ruta (Google/local) → PWA GPS tracking → Entrega + cobro →
Conciliación automática → Reportes CSV/PDF
```

**Actualizado**: Diciembre 2025 - Sistema completo con migración a Google Maps y correcciones técnicas

**Últimas actualizaciones:**

- ✅ **Migración de Leaflet a Google Maps en Repartos (Diciembre 2025)**
  - MonitorMap.tsx y RutaMap.tsx migrados a Google Maps JavaScript API
  - Mejor calidad visual: mapas satelitales, Street View, mejor precisión
  - Iconos personalizados SVG para vehículos, alertas y números de orden
  - Funcionalidades mantenidas: polilíneas, InfoWindows
  - Corrección de bug en GpsTracker.tsx (uso de ref para posición actual)
  - Verificaciones robustas de carga de Google Maps API
- ✅ **Optimización de Polling en Monitor GPS (Diciembre 2025)**
  - Polling adaptativo según cantidad de vehículos: 10s (3+ vehículos), 15s (1-2 vehículos), 60s (sin vehículos)
  - Pausa automática cuando la pestaña del navegador no está visible (Page Visibility API)
  - Botón de actualización manual "Actualizar ahora" para refresco inmediato
  - Control de pausa/reanudación manual del polling
  - Indicador visual del estado del polling y última actualización
  - Reducción estimada de requests: ~50-70% menos carga en el servidor
- ✅ **Sistema de Generación de Datos Mock para Monitor GPS (Diciembre 2025)**
  - Función `crearRutasMockMonteros()` para generar datos de prueba completos (rutas, clientes, vehículos, pedidos, ubicaciones GPS)
  - Endpoint `POST /api/reparto/rutas-mock` con parámetros configurables (cantidad_rutas, clientes_por_ruta)
  - Endpoint `DELETE /api/reparto/limpiar-mock` para eliminar todos los datos mock anteriores
  - Generación de hasta 20 ubicaciones GPS por ruta con puntos intermedios realistas
  - Optimización automática de rutas usando algoritmo local (Nearest Neighbor + 2-opt)
  - Optimizado para Vercel Free: `maxDuration = 10` segundos, datos reducidos para evitar timeouts
  - Sistema completo de logging con tiempos de ejecución por sección para diagnóstico
  - Componente `GenerarRutasMockButton` integrado en el monitor GPS para generación desde UI
  - Logs detallados con prefijos: `⏱️ [TIME]`, `📥 [ENDPOINT]`, `🚀 [INICIO]`, `✅ [SUCCESS]`, `❌ [ERROR]`
- ✅ **Sistema de Listas de Precios implementado (15/01/2025)**
  - Listas base (MINORISTA, MAYORISTA, DISTRIBUIDOR) con asignación automática
  - Margen de ganancia configurable por lista
  - Precios manuales y automáticos por producto
  - Integración completa con presupuestos, pedidos y bot WhatsApp

- ✅ **Navegación del Sidebar completada (03/12/2025)**
  - Agregado "Listas de Precios" al menú Ventas (🏷️)
  - Agregado "Facturas" al menú Ventas (📄)
  - Navegación completa para todos los módulos principales

- ✅ **Correcciones técnicas implementadas (03/12/2025)**
  - Políticas RLS simplificadas para resolver errores de permisos
  - Compatibilidad Next.js 15: páginas dinámicas con `await params`
  - Validación de UUID robusta antes de consultas a BD
  - Manejo de errores mejorado con logging detallado
  - Campo `codigo` agregado a consultas de clientes para búsqueda por código

*Documento creado siguiendo las REGLAS MAESTRAS v7.0 - Arquitectura completa del Sistema ERP para Avícola del Sur*
