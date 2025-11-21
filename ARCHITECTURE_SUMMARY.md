# 🏗️ Arquitectura del Sistema - Avícola del Sur ERP

## 📋 TL;DR (Resumen Ejecutivo)

Sistema ERP modular para Avícola del Sur que unifica Almacén (WMS), Ventas (CRM), Reparto (TMS) y Tesorería en una única fuente de verdad con Supabase. Incluye bot de WhatsApp automatizado para pedidos, PWA móvil para repartidores con GPS, y arquitectura server-side con Next.js 15, React 19, TypeScript y Server Actions. Implementa FIFO automático, RLS completo, validaciones atómicas y trazabilidad total desde ingreso hasta entrega.

**Estado actual**: ✅ Flujo completo implementado - Presupuestos → Almacén → Reparto → Tesorería funcionando end-to-end. Sistema listo para pruebas de integración.

## 🛠️ Tecnologías Principales

- **Framework**: Next.js 15 (App Router, Server Components)
- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Server Actions + Supabase (Postgres + Auth + Storage + Realtime)
- **Estado**: Zustand (solo estado global: sesión, notificaciones)
- **Formularios**: React Hook Form + Zod validation
- **Tablas**: TanStack Table (paginación, filtros, sorting)
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

1. **Cliente contacta** → Bot WhatsApp recibe pedido
2. **Validación stock** → Consulta lotes disponibles (FIFO)
3. **Creación pedido** → fn_crear_pedido_bot() (atómica)
4. **Descuento stock** → Actualiza lotes con FIFO
5. **Generación referencia** → PAY-YYYYMMDD-XXXXXX para pagos diferidos
6. **Notificación admin** → Dashboard recibe alerta
7. **Preparación almacén** → Vendedor revisa y envía a picking
8. **Reparto asignación** → Optimización de rutas por zona/peso
9. **Entrega** → Firma digital + QR verificación
10. **Cobro** → Actualización cuentas corrientes + caja
11. **Conciliación** → Reportes CSV/PDF de movimientos

## 🔑 10 Puntos Clave del Diseño y Comportamiento

1. **Single Source of Truth**: Todo gira alrededor de Supabase como BD central
2. **Server-Side First**: Server Actions manejan toda lógica crítica, validaciones y operaciones atómicas
3. **FIFO Automático**: Sistema de lotes con descuento automático del más antiguo primero
4. **RLS Estricto**: Cada tabla tiene Row Level Security por roles (admin, vendedor, repartidor, almacenista)
5. **Validación Preventiva**: Clientes bloqueados por deuda no pueden crear pedidos
6. **Operaciones Atómicas**: Todas las transacciones críticas usan RPCs de Postgres
7. **Trazabilidad Completa**: Desde lote específico usado hasta firma digital de entrega
8. **Referencias de Pago**: Generación automática con formato PAY-YYYYMMDD-XXXXXX
9. **Adjuntos en Storage**: Gastos, firmas, checklists guardados en Supabase Storage
10. **PWA Mobile-First**: Repartidores tienen app nativa-like con GPS y offline básico

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
- **Clientes**: Con zonas entrega, límites crédito, bloqueo automático
- **Pedidos**: Desde web/bot, con estados completos y referencias pago
- **Cotizaciones**: Conversión automática a pedidos aprobados
- **Reclamos**: Seguimiento con estados y asignación

### 🚛 **Reparto (TMS)**: Logística y Entregas
- **Vehículos**: Flota con mantenimientos y seguros
- **Rutas**: Optimización por zona, peso y tiempo
- **PWA Móvil**: Hoja ruta digital con GPS tracking
- **Firma Digital**: Verificación con QR y subida a Storage

### 💵 **Tesorería**: Control Financiero
- **Cajas**: Por sucursal con saldos iniciales/actuales
- **Movimientos**: Ingresos/egresos ligados a pedidos/gastos
- **Cuentas Corrientes**: Control saldos y límites por cliente
- **Reportes**: CSV/PDF export con pdfkit

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
- **Módulos**: Ventas, gastos, movimientos caja, cuentas corrientes
- **Server-side**: Generación con pdfkit, descarga directa

---

## 🎯 Flujo de Presupuestos Implementado

**Estado**: ✅ Completo y verificado

**Flujo**: `Bot WhatsApp → Presupuesto (Pendiente) → Almacén (Pesaje) → Pedido (Facturado) → Reparto (Entrega/Cobro) → Tesorería (Tiempo Real)`

**Características clave:**
- Clientes son deudores por defecto hasta confirmar reparto
- Presupuestos con múltiples métodos de pago y recargos
- Reserva preventiva de stock (no descuenta físicamente)
- Pesaje obligatorio solo para productos categoría "balanza"
- Facturación directa disponible para presupuestos sin pesables
- Asignación automática de vehículos por peso y capacidad
- Cobros del reparto se registran automáticamente en tesorería
- Devoluciones con motivo y observaciones

**Ver [`TESTING.md`](../TESTING.md) para guía completa de pruebas.**

---

*Resumen actualizado el 20/11/2025 - Flujo completo implementado y listo para pruebas*
