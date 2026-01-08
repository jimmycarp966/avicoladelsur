# 🏦 Sistema de Conciliación Bancaria con IA

## Introducción

El **Sistema de Conciliación Bancaria con IA** es un módulo avanzado del ERP de Avícola del Sur que automatiza el proceso de verificación y acreditación de pagos de clientes.

Este documento explica cómo funciona el sistema, qué puede hacer, y cómo beneficia a la operación diaria.

---

## 🎯 ¿Qué Problema Resuelve?

Antes de este sistema, el proceso de conciliación era:

1. ❌ Recibir comprobantes de pago por WhatsApp
2. ❌ Revisar manualmente el extracto bancario
3. ❌ Buscar cada transferencia en la "sábana"
4. ❌ Identificar a qué cliente corresponde
5. ❌ Registrar manualmente el pago en la cuenta corriente

**Ahora, con el nuevo sistema:**

1. ✅ Subir el PDF del extracto bancario
2. ✅ Subir todas las imágenes de comprobantes
3. ✅ El sistema hace todo automáticamente
4. ✅ Genera un reporte PDF con el resultado

---

## 📊 Diagrama del Flujo de Conciliación

```mermaid
flowchart TD
    subgraph ENTRADA["📥 Entrada"]
        A[PDF Sábana Bancaria]
        B[Imágenes de Comprobantes]
    end
    
    subgraph IA["🤖 Procesamiento IA"]
        C["Gemini extrae movimientos del PDF"]
        D["Gemini extrae datos de cada imagen"]
    end
    
    subgraph VALIDACION["✅ Validación"]
        E["Motor de Matching\n(Score 0-100)"]
        F{{"¿Score >= 70%?"}}
    end
    
    subgraph CLIENTE["👤 Búsqueda Cliente"]
        G["Buscar cliente por DNI/CUIT"]
        H{{"¿Cliente encontrado?"}}
    end
    
    subgraph ACREDITACION["💰 Acreditación"]
        I["Acreditar saldo\nen Cuenta Corriente"]
        J["Registrar ingreso en Caja"]
    end
    
    subgraph SALIDA["📤 Salida"]
        K["Reporte PDF"]
        L["Historial de Sesión"]
    end
    
    A --> C
    B --> D
    C --> E
    D --> E
    E --> F
    
    F -->|✅ SI| G
    F -->|❌ NO| N["No Encontrado"]
    
    G --> H
    H -->|✅ SI| I
    H -->|❌ NO| O["Sin Cliente\n(Revisión Manual)"]
    
    I --> J
    J --> K
    N --> K
    O --> K
    K --> L
```

---

## 🏗️ Arquitectura del Sistema

```mermaid
graph TB
    subgraph FRONTEND["🖥️ Frontend (Next.js)"]
        P1["Dashboard\n/tesoreria/conciliacion"]
        P2["Importar\n/conciliacion/importar"]
        P3["Revisar\n/conciliacion/revisar"]
        P4["Historial\n/conciliacion/historial"]
    end
    
    subgraph ACTIONS["⚡ Server Actions"]
        A1["procesarConciliacionCompletaAction"]
        A2["obtenerHistorialSesionesAction"]
        A3["asignarClienteComprobanteAction"]
    end
    
    subgraph BACKEND["📦 Backend (TypeScript)"]
        B1["parsers.ts\n(Parsear PDF e imágenes)"]
        B2["motor-conciliacion.ts\n(Calcular scores)"]
        B3["cliente-lookup.ts\n(Buscar clientes)"]
        B4["acreditacion.ts\n(Acreditar saldos)"]
        B5["reporte-conciliacion.ts\n(Generar PDF)"]
    end
    
    subgraph EXTERNAL["☁️ Servicios Externos"]
        E1["Gemini AI\n(Vision API)"]
        E2["Supabase\n(Base de Datos)"]
        E3["Storage\n(Reportes PDF)"]
    end
    
    P1 & P2 --> A1
    P3 --> A3
    P4 --> A2
    
    A1 --> B1
    B1 --> E1
    A1 --> B2
    A1 --> B3 --> E2
    A1 --> B4 --> E2
    A1 --> B5 --> E3
```

---

## ⚙️ Características Principales

### 1. 📄 Procesamiento de Sábana Bancaria

- **Formato soportado**: PDF
- **IA utilizada**: Gemini 1.5 Flash
- **Datos extraídos**:
  - Fecha de operación
  - Monto
  - Referencia/número de operación
  - DNI/CUIT del ordenante
  - Descripción

### 2. 🖼️ Procesamiento de Comprobantes

- **Formatos soportados**: PNG, JPG, JPEG, WEBP
- **Procesamiento por lotes**: 5 imágenes en paralelo
- **Datos extraídos**:
  - Monto de la transferencia
  - DNI/CUIT del pagador
  - Número de referencia
  - Fecha de operación

### 3. 🎯 Motor de Matching Inteligente

El sistema calcula un **score de coincidencia** (0-100) basado en:

| Criterio | Puntos |
|----------|--------|
| Monto exacto (diferencia < $1) | 50 |
| Monto aproximado (≤ 2%) | 40 |
| DNI/CUIT coincide | 35 |
| Misma fecha | 15 |
| Referencia muy similar | 15 |

**Umbral de auto-validación**: 70 puntos

### 4. 👤 Búsqueda Automática de Clientes

- Busca por **DNI o CUIT** en la base de datos de clientes
- Soporta formatos: `20123456789`, `20-12345678-9`
- Si no encuentra cliente, marca como **"Sin Cliente"** para revisión manual

### 5. 💰 Acreditación Automática

Cuando se valida un comprobante con cliente:
- Crea un movimiento de tipo **"Abono"** en la cuenta corriente
- Actualiza el saldo del cliente
- Registra el ingreso en la caja central

### 6. 📊 Generación de Reportes

Cada sesión genera un **PDF** con:
- Resumen de la conciliación
- Total de comprobantes procesados
- Cantidad validados / no encontrados / sin cliente
- Monto total acreditado
- Detalle de cada comprobante

---

## 🖥️ Pantallas del Sistema

### Dashboard Principal
**Ruta**: `/tesoreria/conciliacion`

- Estadísticas generales
- Tasa de éxito histórica
- Monto total acreditado
- Historial reciente
- Botón "Nueva Conciliación"

### Importar Conciliación
**Ruta**: `/tesoreria/conciliacion/importar`

- Dropzone para PDF de sábana
- Dropzone para múltiples imágenes
- Vista previa de archivos seleccionados
- Barra de progreso durante el procesamiento
- Resultado con cards de resumen

### Revisar Comprobantes
**Ruta**: `/tesoreria/conciliacion/revisar?sesion=ID`

- Resumen de la sesión
- Tabla de comprobantes con filtros
- Botones de acción:
  - "Asignar Cliente" (para sin cliente)
  - "Descartar" (para errores)
- Score de confianza por comprobante

### Historial de Sesiones
**Ruta**: `/tesoreria/conciliacion/historial`

- Lista agrupada por mes
- Estadísticas por sesión
- Descarga de reportes PDF

---

## 📁 Estructura de Archivos

```
src/
├── actions/
│   └── conciliacion.actions.ts      # Server actions
├── app/tesoreria/conciliacion/
│   ├── page.tsx                      # Dashboard
│   ├── importar/page.tsx             # Importación
│   ├── revisar/page.tsx              # Revisión
│   └── historial/page.tsx            # Historial
├── lib/conciliacion/
│   ├── parsers.ts                    # Parseo PDF + imágenes
│   ├── motor-conciliacion.ts         # Match scoring
│   ├── cliente-lookup.ts             # Búsqueda clientes
│   ├── acreditacion.ts               # Acreditación saldos
│   ├── reporte-conciliacion.ts       # Generación PDF
│   └── utils.ts                      # Utilidades
└── types/
    └── conciliacion.ts               # Tipos TypeScript
```

---

## 🗄️ Base de Datos

### Tabla: `sesiones_conciliacion`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| fecha | timestamp | Fecha de la sesión |
| sabana_archivo | text | Nombre del PDF |
| total_comprobantes | int | Cantidad de imágenes |
| validados | int | Comprobantes exitosos |
| no_encontrados | int | No encontrados en sábana |
| monto_total_acreditado | decimal | Suma acreditada |
| usuario_id | UUID | Quién ejecutó |
| reporte_url | text | URL del PDF |
| estado | enum | en_proceso / completada / con_errores |

### Tabla: `comprobantes_conciliacion`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| sesion_id | UUID | Sesión a la que pertenece |
| monto | decimal | Monto del comprobante |
| dni_cuit | text | DNI/CUIT extraído |
| estado_validacion | enum | validado / no_encontrado / sin_cliente / error |
| cliente_id | UUID | Cliente vinculado |
| confianza_score | decimal | Score de matching (0-1) |
| acreditado | boolean | Si ya se acreditó |
| origen | enum | manual / sucursal / whatsapp |

---

## 🚀 Preparado para el Futuro

El sistema está diseñado para integrarse con:

1. **📍 Sucursales**: Las sucursales podrán subir comprobantes directamente
2. **📱 Bot de WhatsApp**: Los clientes podrán enviar comprobantes por WhatsApp y el sistema los procesará automáticamente

Los campos `origen` y `sucursal_origen_id` ya están preparados en la base de datos.

---

## 📈 Beneficios

| Antes | Después |
|-------|---------|
| 2-3 horas de trabajo manual | 5 minutos con el sistema |
| Errores humanos frecuentes | Validación automática precisa |
| Sin registro histórico | Historial completo con reportes |
| Proceso tedioso | Proceso simple y guiado |
| Sin visibilidad de estado | Dashboard con estadísticas |

---

## 📞 Soporte

Para consultas sobre el sistema de conciliación bancaria, contactar al equipo de desarrollo.

---

*Documento generado automáticamente - Avícola del Sur ERP v2.0*
