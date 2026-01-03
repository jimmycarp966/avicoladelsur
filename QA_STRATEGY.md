# 🧪 Estrategia de QA Integral - Avícola del Sur ERP

Este documento define el plan maestro de aseguramiento de la calidad (QA) generado por TestSprite y el equipo de ingeniería. El objetivo es validar exhaustivamente tanto la interfaz de usuario (Frontend) como la lógica de negocio crítica (Backend) del sistema.

## 📋 Resumen Ejecutivo
El sistema se probará en dos capas principales:
1.  **Capa Frontend & E2E**: Validada mediante el plan automatizado de TestSprite, cubriendo flujos de usuario completos.
2.  **Capa Backend & Seguridad**: Validaciones de arquitectura, Server Actions, RPCs y políticas de seguridad (RLS).

---

## 🖥️ Fase 1: Frontend & E2E (Plan TestSprite)
Este plan cubre la interacción del usuario y la integración de sistemas.

### 🔐 Autenticación y Seguridad
*   **TC001 - Login Válido**: Verificar autenticación exitosa y emisión de JWT para admin.
*   **TC002 - Login Inválido**: Verificar manejo de errores con credenciales incorrectas.
*   **TC003 - Control de Acceso (RLS)**: Validar que vendedores solo vean sus ventas y repartidores solo sus rutas. Intento de acceso no autorizado debe fallar.

### 🤖 Automatización e IA
*   **TC004 - Bot WhatsApp**:
    *   Interpretación de lenguaje natural.
    *   Validación de stock FIFO en tiempo real.
    *   Reserva de stock atómica.
*   **TC013 - IA Gemini Integation**:
    *   Detección de peso anómalo en balanza.
    *   Predicción de riesgo de clientes.
    *   Clasificación automática de gastos.

### 📦 Almacén y Gestión de Pedidos
*   **TC005 - Conversión Presupuesto -> Pedido**: Transacción atómica (stock, turno, fecha).
*   **TC006 - FIFO y Lotes**: Descuento correcto del lote más antiguo. Trazabilidad.

### 🚚 Logística y Reparto (TMS)
*   **TC007 - Optimización de Rutas**:
    *   Generación con Google Directions API.
    *   Fallback local automático ante fallos de API.
    *   Respeto de capacidades de vehículos.
*   **TC008 - PWA Móvil**:
    *   Tracking GPS cada 5s.
    *   Navegación por voz en español.
*   **TC009 - Entrega y Cobro**:
    *   Firma digital y escaneo QR.
    *   Registro de estados de pago (Parcial, Cta. Cte.).
*   **TC010 - Monitor GPS**:
    *   Alertas en tiempo real por desvíos.
    *   Visualización correcta de la flota.

### 💰 Tesorería y Sucursales
*   **TC011 - Validación de Caja**: Movimientos, cierres y moras. Reportes PDF/CSV.
*   **TC012 - Multi-Sucursal**: Inventario distribuido, transferencias atómicas, alertas de stock.

### 📱 Experiencia de Usuario
*   **TC014 - Notificaciones**: Sistema centralizado, filtros y Push.
*   **TC015 - Responsividad**: Layout desktop vs PWA móvil.

---

## ⚙️ Fase 2: Backend Deep-Dive (Validación Estructural)
Esta fase se enfoca en la robustez interna, seguridad y rendimiento, complementando las pruebas E2E.

### 🛡️ Pruebas de Bases de Datos y RLS
*   **Validación de Políticas RLS**:
    *   Intentar `INSERT/UPDATE` directo en tablas sensibles (`cajas`, `movimientos`) sin permisos de rol.
    *   Verificar que `fn_auditar_cobros_automatico` detecte inconsistencias inyectadas manualmente.
*   **Funciones RPC Críticas**:
    *   Stress test a `fn_asignar_pedido_a_ruta()`: ¿Qué pasa si 100 pedidos se asignan simultáneamente?
    *   Validar `fn_calcular_saldo_factura` ante pagos concurrentes.

### ⚡ Server Actions (Next.js)
*   **Manejo de Errores**:
    *   Verificar que `createSafeActionClient` capture excepciones no controladas y no exponga stack traces.
*   **Validación Zod**:
    *   Enviar payloads mal formados a `crearPedidoAction` y verificar rechazo antes de tocar la BD.

### 🌐 Integraciones Externas (Resiliencia)
*   **Google Maps Quota**: Simular error de cuota excedida en `GoogleDirections` y verificar switch a `LocalOptimizer`.
*   **Twilio Webhook**: Validar firma de seguridad `X-Twilio-Signature` para evitar spoofing de mensajes.

## 🚀 Ejecución
Para ejecutar el plan de pruebas automatizado generado por TestSprite:

```bash
# Ejecutar pruebas frontend/E2E
npx testsprite run --plan testsprite_frontend_test_plan.json
```
