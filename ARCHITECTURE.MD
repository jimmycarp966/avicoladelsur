# Arquitectura del Sistema de Gestión Integral - Avícola del Sur

## 📋 Información General

**Sistema ERP Modular** diseñado para eliminar silos de información entre Almacén, Ventas y Reparto, creando una única fuente de la verdad en Supabase.

### 🎯 Objetivos del Sistema
- **Integración Total**: Unificar Almacén (WMS), Ventas (CRM) y Reparto (TMS)
- **Automatización**: Bot Vendedor para pedidos vía WhatsApp
- **Eficiencia**: PWA móvil para repartidores con GPS y firma digital
- **Trazabilidad**: Control completo desde ingreso hasta entrega

### 📱 Aplicaciones del Sistema
1. **App Admin**: Dashboard web administrativo
2. **App Repartidor**: PWA móvil para gestión de entregas
3. **Bot Vendedor**: Automatización de pedidos vía WhatsApp

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología | Propósito |
|------------|------------|----------|
| **Framework** | Next.js 15 | App Router y Server Components |
| **Frontend** | React 19 + TypeScript | Interfaz de usuario moderna y tipada |
| **Estado Global** | Zustand | Sesión de usuario y notificaciones globales |
| **UI/UX** | Tailwind CSS + shadcn/ui | Diseño profesional y responsive |
| **Formularios** | React Hook Form + Zod | Validación automática y UX mejorada |
| **Tablas/Listas** | TanStack Table | Gestión de datos con paginación y filtros |
| **Backend Web** | Server Actions (Next.js) | Lógica de negocio segura del lado servidor |
| **Base de Datos** | Supabase | Postgres + Auth + Storage + Realtime |
| **Canal de Chat** | Twilio | API de WhatsApp para comunicación con clientes |
| **Motor de Chatbot** | ~~Botpress (Cloud)~~ **Implementación directa** | Procesamiento de comandos en Next.js API Route |
| **Backend Bot** | Next.js API Route | Endpoint `/api/bot/` con lógica de negocio completa |
| **Storage** | Supabase Storage | Almacenamiento de adjuntos (imágenes y PDFs) |
| **Generación PDF** | pdfkit | Librería para generar reportes en formato PDF |

---

## 🔄 Flujos de Datos Principales

### Flujo A: Aplicación Web (Admin y Repartidor)

```
Usuario (Admin/Repartidor) → UI (shadcn/ui)
    ↓
Server Action (/src/actions/) → Validación (Zod)
    ↓
Lógica Servidor → RPC Supabase (operaciones complejas)
    ↓
Respuesta {success: true} → revalidatePath()
    ↓
Notificación → UI actualizada
```

### Flujo B: Bot Vendedor (Cliente Final) ✅ IMPLEMENTADO

```
Cliente (WhatsApp) → Twilio (canal de comunicación)
    ↓
POST /api/bot (Next.js API Route) → Procesa comando
    ↓
Validaciones (cliente registrado, stock disponible)
    ↓
Server Action (crearPedidoBot) → RPC Supabase
    ↓
fn_crear_pedido_bot() → Descuento automático de lotes (FIFO)
    ↓
Registro de movimiento de stock
    ↓
Creación de notificación para admin
    ↓
Respuesta TwiML → Twilio → Cliente (WhatsApp)
```

**Características del flujo:**
- ✅ **Sin Botpress**: Procesamiento directo en Next.js (más rápido y simple)
- ✅ **FIFO Automático**: Descuenta del lote que vence primero
- ✅ **Transaccional**: Si algo falla, rollback completo
- ✅ **Trazabilidad**: Registra qué lote se usó en cada pedido
- ✅ **Confirmación**: Requiere confirmación explícita antes de crear pedido

---

## 🏢 Dominios de Negocio

### 1️⃣ Dominio: Almacén (WMS - Warehouse Management System)

**Funcionalidades:**
- **Trazabilidad**: Control de lotes, fechas de vencimiento y origen
- **Ingreso de Mercadería**: Recepción, etiquetado y ubicación en almacén
- **Control de Stock**: Diferenciación entre stock físico y disponible
- **Gestión de Picking**: Preparación optimizada de pedidos
- **Control de Calidad**: Checklists obligatorios antes de salida

### 2️⃣ Dominio: Ventas (CRM - Customer Relationship Management)

**Funcionalidades:**
- **Gestión de Clientes**: Base de datos con zonas de entrega
- **Toma de Pedidos**: Validación de stock en tiempo real
- **Validación Preventiva**: Bloqueo automático de formularios para clientes con `bloqueado_por_deuda=true`
- **Cotizaciones**: Generación y seguimiento de presupuestos
- **Facturación**: Emisión de comprobantes fiscales
- **Post-venta**: Gestión de reclamos y seguimiento
- **Referencias de Pago**: Generación automática de códigos de referencia para pagos diferidos
- **Instrucciones para Repartidores**: Mensajes automáticos con monto y referencia de pago

### 3️⃣ Dominio: Reparto (TMS - Transportation Management System)

**Funcionalidades:**
- **Gestión de Vehículos**: Flota con mantenimientos y seguros
- **Control de Repartidores**: Usuarios con roles específicos
- **Checklists Vehiculares**: Inspecciones diarias guardadas en Storage
- **Planificación de Rutas**: Optimización por zona y peso
- **PWA Móvil**: Hoja de ruta digital con GPS
- **Tracking**: Seguimiento en tiempo real de entregas
- **Confirmación**: Firma digital y QR de entregas

### 5️⃣ Dominio: Tesorería y Finanzas (Hito Intermedio)

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

### 4️⃣ Dominio: Bot de WhatsApp (Interfaz de Cliente) ✅ FUNCIONANDO

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
- 🚧 **Registro de Reclamos**: En desarrollo
- 🚧 **Notificaciones Push**: En desarrollo

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

### ✅ Completado:
1. **Fase 1**: Configuración base (Supabase, Next.js, dependencias)
2. **Fase 2**: Autenticación y roles de usuario
3. **Fase 3**: Módulo de Almacén (productos, stock, lotes con FIFO)
4. **Fase 4**: Módulo de Ventas (clientes, pedidos, cotizaciones)
5. **Fase 6**: Bot de WhatsApp con Twilio (sin Botpress)
6. **Hito Intermedio**: 
   - ✅ Tesorería (cajas y movimientos)
   - ✅ Gastos con adjuntos en Storage
   - ✅ Cuentas corrientes con bloqueo automático
   - ✅ Validación preventiva de clientes bloqueados
   - ✅ Reportes CSV y PDF
   - ✅ Referencias de pago automáticas
   - ✅ Instrucciones para repartidores
   - ✅ RPC fn_consultar_stock_por_lote

### 🚧 En Desarrollo:
6. **Fase 5**: Módulo de Reparto (vehículos básico, rutas pendientes)
7. **Fase 7**: Sistema de notificaciones en dashboard
8. **Fase 8**: Testing y optimización

### 📋 Pendiente:
9. **Fase 9**: PWA para repartidores con GPS
10. **Fase 10**: Despliegue en producción
11. **Fase 11**: WhatsApp Business API (número dedicado)
12. **Fase 12**: Capacitación de usuarios

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

*Documento creado siguiendo las REGLAS MAESTRAS v7.0 - Arquitectura completa del Sistema ERP para Avícola del Sur*
