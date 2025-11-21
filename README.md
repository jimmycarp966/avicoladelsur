# Avícola del Sur ERP

Sistema de Gestión Integral para Avícola del Sur - ERP modular con aplicación web administrativa, PWA para repartidores y Bot Vendedor automatizado.

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase ✅
- Cuenta de Twilio (para el bot de WhatsApp) ✅
- ngrok (para exponer servidor local durante desarrollo)
- Cuenta de Botpress (opcional - solo si necesitas NLU avanzado)

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd avicola-del-sur
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Supabase**
   Sigue la guía completa en `SUPABASE_SETUP.md` para configurar la base de datos.

4. **Configurar variables de entorno**
   ```bash
   cp env.example .env.local
   ```

   Completa `.env.local` con tus credenciales de Supabase.

5. **Ejecutar el proyecto**
   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000)

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico
- **Framework**: Next.js 15 (App Router)
- **Frontend**: React 19 + TypeScript
- **Backend**: Server Actions + Supabase
- **UI**: Tailwind CSS + shadcn/ui
- **Estado**: Zustand
- **Formularios**: React Hook Form + Zod
- **Tablas**: TanStack Table
- **Storage**: Supabase Storage (para adjuntos de gastos)
- **PDF**: pdfkit (para generación de reportes PDF)

### Estructura Modular
- **App Admin**: Dashboard administrativo (`/(admin)`)
- **App Repartidor**: PWA móvil (`/(repartidor)`)
- **Bot Vendedor**: API webhook (`/api/bot`)

### Dominios de Negocio
1. **Almacén (WMS)**: Control de stock, lotes, picking
2. **Ventas (CRM)**: Clientes, pedidos, cotizaciones, reclamos
3. **Reparto (TMS)**: Vehículos, rutas, entregas, GPS
4. **Chatbot**: Toma de pedidos y consultas vía WhatsApp

## 📁 Estructura del Proyecto

```
src/
├── app/                          # Rutas Next.js
│   ├── (admin)/                  # Dashboard Admin
│   ├── (repartidor)/            # PWA Repartidor
│   ├── api/bot/                 # Webhook Botpress
│   └── globals.css              # Sistema de colores y estilos globales
├── actions/                      # Server Actions
├── components/                   # Componentes React
│   ├── ui/
│   │   ├── logo.tsx             # ⭐ Componente Logo
│   │   ├── button.tsx           # Botones con variantes de colores
│   │   ├── card.tsx             # Cards con sombras verdes
│   │   └── ...                  # Otros componentes shadcn/ui
│   ├── layout/
│   │   ├── admin/               # Layouts con diseño verde
│   │   └── repartidor/          # Layouts móviles
│   ├── forms/                   # Formularios con bordes coloridos
│   └── tables/                  # Tablas de datos
├── lib/                          # Utilidades y configuración
├── store/                        # Zustand stores
└── types/                        # TypeScript types

public/
└── images/
    └── logo-avicola.png         # Logo de la empresa
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview de producción
npm run start

# Linting
npm run lint

# Verificar configuración del bot
node scripts/verificar-bot.js
```

## 🎯 Flujo de Presupuestos - COMPLETO

### Estado: ✅ IMPLEMENTADO Y VERIFICADO

Sistema completo de presupuestos que transforma el proceso operativo:

**Flujo**: `Bot → Presupuesto → Reserva Stock → Almacén → Pesaje → Pedido → Reparto → Tesorería`

### Características Principales
- 🤖 **Bot Actualizado**: Crea presupuestos en lugar de pedidos directos
- 📋 **Números Únicos**: PRES-YYYYMMDD-XXXX con links de seguimiento
- 🏭 **Control de Almacén**: Reserva preventiva + pesaje obligatorio para productos de categoría "balanza"
- 🚛 **Reparto Integrado**: PWA completa con registro de entregas, cobros (múltiples métodos) y devoluciones
- 💰 **Tesorería Tiempo Real**: Movimientos automáticos por operaciones, totales por método de pago
- 👥 **Clientes Deudores**: Todos los clientes son deudores hasta confirmar reparto
- 💳 **Múltiples Métodos de Pago**: Soporte para efectivo, transferencia, QR, tarjeta, cuenta corriente con recargos
- 🚚 **Asignación Automática**: Vehículos asignados automáticamente según peso y capacidad

### Cómo Probar la Demo
```bash
# Verificar implementación completa
./scripts/demo-presupuestos.sh

# Endpoints de testing
POST /api/almacen/simular-peso     # Simular balanza
POST /api/reparto/entrega         # Registrar entrega
GET /api/tesoreria/movimientos-tiempo-real  # Ver caja
```

---

## 🤖 Bot de WhatsApp

### Estado: ✅ FUNCIONANDO + ACTUALIZADO

El bot está completamente funcional y ahora incluye el nuevo flujo de presupuestos:

**Comandos disponibles:**
- `hola` / `menu` - Ver menú principal
- `1` - Ver catálogo de productos con stock en tiempo real
- `2` - Crear presupuesto (instrucciones)
- `3` - Consultar pedidos y presupuestos
- `POLLO001 5` - Crear presupuesto (código + cantidad)
- `POLLO001 5, HUEVO001 2` - Presupuesto múltiple
- `SÍ` / `NO` - Confirmar o cancelar presupuesto
- `estado PED-XXXXX` - Ver estado de pedido
- `estado PRES-XXXXX` - Ver estado de presupuesto

**Características implementadas:**
- ✅ Validación de stock en tiempo real desde lotes
- ✅ Descuento automático de stock con FIFO (First In, First Out)
- ✅ Confirmación antes de crear pedido
- ✅ Pedidos simples y múltiples
- ✅ Consulta de estado de pedidos
- ✅ Historial de pedidos del cliente
- ✅ Verificación de horario de atención
- ✅ Menú interactivo numérico
- ✅ Indicadores de stock (🟢🟡🔴)
- ✅ Agrupación de productos por categoría
- ✅ Trazabilidad completa (qué lote se usó en cada pedido)
- ✅ **Referencias de pago** automáticas para pedidos con pago diferido
- ✅ **Instrucciones para repartidores** con monto y referencia de pago

**Configuración:**
1. Crear cuenta en Twilio: https://www.twilio.com
2. Activar WhatsApp Sandbox
3. Autenticar Twilio CLI: `twilio login`
4. Configurar variables de entorno en `.env.local`
5. Configurar webhook en Twilio apuntando a `/api/bot`

**Pruebas:**
- Sandbox permite hasta 5 números de WhatsApp simultáneos
- Para producción, solicitar WhatsApp Business API a Meta
- Uso estimado: ~$0.005 por mensaje

**Flujo técnico:**
```
Cliente (WhatsApp) → Twilio → /api/bot/route.ts →
Server Actions → fn_crear_presupuesto_desde_bot() →
Reserva preventiva de stock → Respuesta con número PRES-XXXXX
```

---

## 🧪 Guía de Pruebas

### 📋 Checklist Completo de Pruebas

**Ver la guía completa de pruebas en [`TESTING.md`](./TESTING.md)** que incluye:

- ✅ Flujo completo Bot → Ventas → Almacén → Reparto → Tesorería
- ✅ Pruebas de cada módulo individual
- ✅ Endpoints de API para testing
- ✅ Funciones RPC de Supabase
- ✅ Validaciones de datos y consistencia
- ✅ Problemas comunes y soluciones

### 🚀 Inicio Rápido de Pruebas

**1. Flujo End-to-End Básico (10 minutos):**

```bash
# 1. Cliente crea presupuesto vía WhatsApp
Enviar: POLLO001 5
Recibir: PRES-YYYYMMDD-XXXX + link

# 2. Vendedor gestiona presupuesto
URL: /ventas/presupuestos/[id]
- Asignar zona y turno
- Enviar a almacén (o facturar directo si no hay pesables)

# 3. Almacén procesa pesaje
URL: /almacen/presupuestos-dia
- Seleccionar presupuesto
- Pesar productos de categoría "balanza"
- Finalizar presupuesto

# 4. Sistema convierte automáticamente
- Presupuesto → Pedido
- Stock descontado
- Pedido disponible para ruta

# 5. Repartidor registra entrega
URL: /repartidor/ruta/[ruta_id]/entrega/[entrega_id]
- Registrar cobro (múltiples métodos de pago)
- Registrar devolución (si aplica)
- Marcar como entregado

# 6. Tesorería verifica
URL: /tesoreria/movimientos
- Ver movimientos en tiempo real
- Verificar totales por método de pago
- Verificar caja central actualizada
```

**2. Endpoints de Testing:**

```bash
# Simular peso de balanza
curl -X POST http://localhost:3000/api/almacen/simular-peso \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_item_id": "uuid-del-item"}'

# Finalizar presupuesto en almacén
curl -X POST http://localhost:3000/api/almacen/presupuesto/finalizar \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_id": "uuid-presupuesto"}'

# Registrar cobro desde reparto
curl -X POST http://localhost:3000/api/reparto/entrega \
  -H "Content-Type: application/json" \
  -d '{
    "pedido_id": "uuid-pedido",
    "metodo_pago": "efectivo",
    "monto_cobrado": 1250.50
  }'

# Registrar devolución
curl -X POST http://localhost:3000/api/reparto/devoluciones \
  -H "Content-Type: application/json" \
  -d '{
    "pedido_id": "uuid-pedido",
    "producto_id": "uuid-producto",
    "cantidad": 2,
    "motivo": "producto_dañado"
  }'

# Ver movimientos de tesorería en tiempo real
curl http://localhost:3000/api/tesoreria/movimientos-tiempo-real

# Facturar presupuesto directo (sin almacén)
curl -X POST http://localhost:3000/api/ventas/presupuestos/facturar \
  -H "Content-Type: application/json" \
  -d '{"presupuesto_id": "uuid-presupuesto"}'
```

**3. Funciones RPC de Supabase:**

En Supabase SQL Editor:
```sql
-- Verificar reserva preventiva de stock
SELECT * FROM fn_reservar_stock_por_presupuesto('uuid-presupuesto');

-- Actualizar peso de item pesable
SELECT * FROM fn_actualizar_peso_item_presupuesto('uuid-item', 5.25);

-- Convertir presupuesto a pedido
SELECT * FROM fn_convertir_presupuesto_a_pedido(
  'uuid-presupuesto',
  'uuid-usuario',
  'uuid-caja'
);

-- Asignar vehículos por peso
SELECT * FROM fn_asignar_vehiculos_por_peso('2025-11-20'::date, 'tarde'::text);

-- Registrar cobro desde reparto
SELECT * FROM fn_registrar_cobro_reparto(
  'uuid-pedido',
  'efectivo'::text,
  1250.50,
  'uuid-repartidor',
  NULL,
  NULL
);
```

### ✅ Checklist de Validación Rápida

**Funcionalidades Core:**
- [ ] Bot crea presupuestos con números únicos (PRES-YYYYMMDD-XXXX)
- [ ] Clientes se crean como deudores por defecto
- [ ] Presupuestos soportan múltiples métodos de pago con recargos
- [ ] Reserva preventiva de stock (no descuenta físicamente)
- [ ] Vendedor puede facturar directo (sin productos pesables)
- [ ] Vendedor puede enviar a almacén
- [ ] Almacén ve totales por zona/turno y asigna vehículos automáticamente
- [ ] Almacén puede pesar productos de categoría "balanza"
- [ ] Almacén puede finalizar presupuesto → convierte a pedido
- [ ] Repartidor ve rutas y puede registrar cobros/devoluciones
- [ ] Tesorería muestra movimientos en tiempo real

**Validaciones de Datos:**
- [ ] Stock se descuenta correctamente después de finalizar
- [ ] Precios se recalculan según peso real
- [ ] Totales son correctos en cada paso
- [ ] Estados se actualizan correctamente
- [ ] Movimientos de caja se registran automáticamente

**Ver la guía completa en [`TESTING.md`](./TESTING.md) para pruebas detalladas de cada módulo.**

## 💰 Tesorería y Gastos (Hito Intermedio)

El hito intermedio incorpora la capa financiera básica:

- ✅ Tesorería con cajas por sucursal y movimientos ligados a pedidos.
- ✅ Registro de gastos con categorías, **adjuntos en Supabase Storage** (imágenes y PDFs) y opción de afectar caja en la misma transacción.
- ✅ Cuentas corrientes de clientes con bloqueo automático cuando superan el límite de crédito.
- ✅ **Validación preventiva** de clientes bloqueados en formularios de pedidos.
- ✅ Reportes de ventas, gastos, movimientos de caja y cuentas corrientes con **export CSV y PDF** server-side.
- ✅ **Referencias de pago** generadas automáticamente para pedidos con pago diferido.
- ✅ **Instrucciones para repartidores** con monto y referencia de pago.

### Endpoints nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET/POST/PUT` | `/api/tesoreria/cajas` | Listar, crear y actualizar cajas. |
| `GET/POST` | `/api/tesoreria/movimientos` | Conciliar ingresos/egresos manuales y generar movimientos vía RPC. |
| `GET/POST` | `/api/gastos` | Listado de gastos y registro con afectación opcional a caja. **Soporta adjuntos en Storage**. |
| `GET/POST` | `/api/cuentas_corrientes` | Consultar cuentas y registrar pagos manuales de pedidos. |
| `POST` | `/api/reportes/export` | Genera **CSV o PDF** para ventas, gastos, movimientos de caja y cuentas corrientes. |

### RPC / Funciones Supabase

- `fn_crear_movimiento_caja`: actualiza saldo y registra movimientos en una sola transacción.
- `fn_registrar_gasto`: inserta gasto y, si aplica, crea egreso de caja.
- `fn_crear_pago_pedido`: vincula cobros con pedidos y reduce cuentas corrientes.
- `fn_procesar_pedido`: flujo atómico de pedidos (web/bot) con descuento FIFO, cuentas corrientes, caja y **generación de referencia de pago**.
- `fn_crear_pedido_bot`: wrapper para pedidos creados desde WhatsApp.
- `fn_consultar_stock_por_lote`: consulta lotes disponibles ordenados por FIFO (fecha de vencimiento y fecha de ingreso).

### Cómo probar en ambiente de prueba

1. **Cajas y movimientos**
   - `POST /api/tesoreria/cajas` con nombre y saldo inicial.
   - `POST /api/tesoreria/movimientos` para registrar ingreso o egreso.
   - Verificar saldo con `GET /api/tesoreria/cajas`.
2. **Pedidos (web y bot)**
   - Crear pedido desde la UI o vía `crearPedido` server action.
   - **Validar bloqueo**: Intentar crear pedido para cliente con `bloqueado_por_deuda=true` - debe mostrar advertencia y bloquear submit.
   - Confirmar que `fn_procesar_pedido` descuente lotes, registre cuenta corriente, pago_estado y **genere referencia de pago**.
3. **Pagos y cuentas corrientes**
   - Usar el formulario en `/ventas/pedidos/[id]` o `POST /api/cuentas_corrientes` (action `registrarPago`).
   - Validar que el saldo pendiente se reduzca y la caja reciba el ingreso.
4. **Gastos con adjuntos**
   - Desde `/tesoreria/gastos`, usar el formulario para registrar un gasto.
   - **Subir archivo**: Seleccionar imagen (JPG/PNG) o PDF como comprobante (máx. 10MB).
   - Verificar que el archivo se suba a Supabase Storage en el bucket `gastos`.
   - Alternativamente, ingresar URL manual del comprobante.
5. **Reportes CSV y PDF**
   - Desde `/reportes`, seleccionar tipo de reporte (ventas, gastos, movimientos_caja, cuentas_corrientes).
   - Seleccionar formato **CSV** o **PDF**.
   - Verificar descarga del archivo generado.
   - PDF incluye título, encabezados, datos tabulados y paginación automática.
6. **Bot con referencias de pago**
   - Enviar "deuda" desde WhatsApp para ver saldo real desde `cuentas_corrientes`.
   - Crear pedido desde WhatsApp y verificar que el mensaje de confirmación incluya **referencia de pago** (formato: `PAY-YYYYMMDD-XXXXXX`).
   - Verificar que el pedido tenga `referencia_pago` y `instruccion_repartidor` en la base de datos.
7. **Consulta de stock por lote**
   - Ejecutar `SELECT * FROM fn_consultar_stock_por_lote(NULL)` para ver todos los lotes.
   - Ejecutar `SELECT * FROM fn_consultar_stock_por_lote('producto-uuid')` para filtrar por producto.
   - Verificar que los lotes estén ordenados por FIFO (vencimiento ASC, ingreso ASC).

Puedes reutilizar los ejemplos de `scripts/test-hito-intermedio.http` para disparar cada endpoint vía `curl` o REST Client.

## 🗄️ Base de Datos

El esquema completo de la base de datos se encuentra en `supabase/database-schema.sql`. Incluye:

- 15+ tablas principales
- Funciones RPC atómicas
- Políticas RLS por rol
- Índices optimizados
- Triggers y constraints

### Funciones RPC Principales

- `fn_crear_pedido_bot()`: Crea pedidos desde WhatsApp con descuento automático de stock por lotes (FIFO)
- `fn_procesar_pedido()`: Procesa pedidos (web/bot) con descuento FIFO, cuentas corrientes, caja y generación de referencia de pago
- `fn_consultar_stock_por_lote()`: Consulta lotes disponibles ordenados por FIFO (vencimiento e ingreso)
- `fn_crear_movimiento_caja()`: Crea movimientos de caja de forma atómica
- `fn_registrar_gasto()`: Registra gastos con opción de afectar caja
- `fn_crear_pago_pedido()`: Registra pagos de pedidos y actualiza cuentas corrientes
- `fn_validar_entrega()`: Valida entregas con firma digital
- `crear_notificacion()`: Crea notificaciones en el sistema para los admins

## 🔐 Autenticación y Roles

Sistema de autenticación basado en Supabase Auth con 4 roles:

- **Admin**: Acceso completo
- **Vendedor**: Gestión de ventas y clientes
- **Repartidor**: Gestión de entregas
- **Almacenista**: Control de inventario

## 📱 Aplicaciones

### App Administrativa
- Dashboard con métricas en tiempo real
- Gestión completa de todos los módulos
- Reportes y estadísticas

### PWA Repartidor
- Hoja de ruta digital
- Tracking GPS en tiempo real
- Firma digital y QR
- Modo offline básico

### Bot Vendedor ✅ (FUNCIONANDO)
- ✅ Toma de pedidos vía WhatsApp con validación de stock en tiempo real
- ✅ Descuento automático de stock por lotes (FIFO)
- ✅ Pedidos simples y múltiples
- ✅ Confirmación antes de crear pedido
- ✅ Consulta de estado de pedidos
- ✅ Menú interactivo numérico
- ✅ Verificación de horario de atención
- ✅ Integración directa con Twilio (Botpress opcional)
- 🚧 Notificaciones en dashboard (en desarrollo)
- 🚧 Registro de reclamos (en desarrollo)

## 🎨 Sistema de Diseño

### Identidad Visual

El sistema está diseñado con una identidad visual moderna y profesional basada en los colores del logo de Avícola del Sur, creando una experiencia cohesiva y distintiva.

### Paleta de Colores

**Colores Principales (del Logo):**
```css
--primary: #1a4d2e;           /* Verde oscuro del logo */
--secondary: #2d6a4f;         /* Verde medio */
--accent: #8b2635;            /* Rojo profundo del logo */
--neutral-warm: #f5e6d3;      /* Beige del logo */
--neutral-gold: #d4a574;      /* Dorado/beige oscuro */
```

**Colores de Estado:**
```css
--success: #2d6a4f;           /* Verde para éxito */
--warning: #d4a574;           /* Dorado para advertencias */
--info: #3b7c8f;              /* Azul verdoso para información */
--destructive: #8b2635;       /* Rojo para errores */
```

**Fondo del Sistema:**
```css
--background: #f0f8f4;        /* Verde menta muy claro */
--card: #ffffff;              /* Cards blancas con contraste */
```

### Componentes Visuales

**Logo:**
- Componente reutilizable: `<Logo />`
- Variantes: `sm`, `md`, `lg`, `xl`
- Modos: `full` (con texto) o `icon` (solo imagen)
- Ubicación: `public/images/logo-avicola.png`

**Cards:**
- Sombras sutiles con color verde
- Bordes verdes delicados (`border-primary/10`)
- Efecto hover: elevación y zoom suave
- Bordes superiores de colores para categorización

**Efectos Visuales:**
- Gradientes sutiles en headers y sidebar
- Transiciones suaves (200-300ms)
- Animaciones de hover con escala
- Iconos coloridos en círculos de fondo

### Convenciones de Diseño

1. **Headers de Página**: Gradiente verde sutil con efectos blur
2. **Cards de Métricas**: Bordes superiores de colores + iconos coloridos
3. **Formularios**: Bordes izquierdos de colores + títulos coloridos
4. **Navegación**: Indicadores verdes para items activos
5. **Botones**: Variantes de colores (primary, success, warning, info, accent)
6. **Badges**: Fondos sutiles con bordes del mismo color

## 📊 Métricas y KPIs

- **Almacén**: Rotación de stock, precisión de inventario
- **Ventas**: Conversión de pedidos, valor promedio
- **Reparto**: Tasa de entregas exitosas, tiempo de ruta
- **Cliente**: Satisfacción, tiempo de respuesta

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conectar repositorio a Vercel
2. Configurar variables de entorno
3. Configurar dominio personalizado
4. Desplegar

### Variables de Entorno en Producción
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key

# Twilio (Bot de WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=+14155238886
BOTPRESS_WEBHOOK_TOKEN=your-random-secure-token

# Botpress (Opcional - solo si usas NLU avanzado)
BOTPRESS_WEBHOOK_URL=https://your-botpress-webhook
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 📞 Soporte

Para soporte técnico contactar al equipo de desarrollo.

---

**Avícola del Sur ERP** - Transformando la gestión avícola con tecnología moderna.
