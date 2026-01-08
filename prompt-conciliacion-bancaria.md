# PROMPT PARA IA - SISTEMA DE CONCILIACIÓN BANCARIA

## CONTEXTO DEL PROYECTO

Necesito implementar un módulo de **conciliación bancaria automática** en una webapp existente de gestión empresarial (distribuidora de alimentos).

### Stack Tecnológico Actual
- **Framework**: Next.js 15 (App Router, Server Components)
- **Frontend**: React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Server Actions + Supabase (Postgres + Auth + Storage + Realtime)
- **Estado**: Zustand (solo estado global)
- **Formularios**: React Hook Form + Zod
- **Tablas**: TanStack Table
- **IA**: Google Gemini AI (ya integrado)
- **Ubicación**: `/app/tesoreria/conciliacion/` (nuevo módulo)

---

## OBJETIVO

Crear un sistema completo de conciliación bancaria que permita:

1. **Importar movimientos bancarios** desde Excel/CSV/PDF
2. **Matchear automáticamente** con pagos esperados del sistema usando reglas + IA
3. **Interfaz de revisión manual** para casos no auto-conciliados
4. **Dashboard con métricas** de conciliación

---

## REQUISITOS FUNCIONALES

### 1. MODELO DE DATOS (Supabase)

Crear 3 tablas principales:

```sql
-- Movimientos bancarios importados
CREATE TABLE movimientos_bancarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cuenta_bancaria_id UUID REFERENCES cuentas_bancarias(id),
  fecha DATE NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  referencia TEXT,
  dni_cuit TEXT,
  descripcion TEXT,
  archivo_origen TEXT,
  estado_conciliacion VARCHAR(20) DEFAULT 'pendiente', -- pendiente, conciliado, revisado, descartado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos esperados del sistema
CREATE TABLE pagos_esperados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID REFERENCES pedidos(id),
  cliente_id UUID REFERENCES clientes(id),
  monto_esperado DECIMAL(12,2) NOT NULL,
  fecha_esperada DATE,
  referencia TEXT,
  dni_cuit TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación muchos a muchos
CREATE TABLE conciliaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movimiento_bancario_id UUID REFERENCES movimientos_bancarios(id),
  pago_esperado_id UUID REFERENCES pagos_esperados(id),
  monto_conciliado DECIMAL(12,2) NOT NULL,
  diferencia DECIMAL(12,2),
  tipo_match VARCHAR(20), -- exacto, automatico, manual
  confianza_score DECIMAL(3,2), -- 0.00 a 1.00
  conciliado_por UUID REFERENCES usuarios(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_mov_bancarios_fecha ON movimientos_bancarios(fecha);
CREATE INDEX idx_mov_bancarios_estado ON movimientos_bancarios(estado_conciliacion);
CREATE INDEX idx_mov_bancarios_dni ON movimientos_bancarios(dni_cuit);
CREATE INDEX idx_pagos_esperados_estado ON pagos_esperados(estado);
```

### 2. MOTOR DE CONCILIACIÓN AUTOMÁTICA

**Archivo**: `/lib/conciliacion/motor-conciliacion.ts`

Implementar sistema de scoring con 5 reglas:

| Regla | Peso | Descripción |
|-------|------|-------------|
| `monto_exacto` | 40 pts | Monto idéntico (diferencia < $0.01) |
| `monto_aproximado` | 25 pts | Diferencia < 5% = 25pts, < 15% = 15pts |
| `dni_cuit_exacto` | 30 pts | DNI/CUIT coincide (normalizado sin guiones) |
| `fecha_proxima` | 10 pts | Mismo día = 10pts, ±3 días = 5pts |
| `referencia_similar` | 20 pts | Similitud de texto > 70% = 20pts, > 50% = 10pts |

**Lógica**:
- Score >= 70: Auto-conciliar
- Score 40-69: Sugerir para revisión manual
- Score < 40: No sugerir

**Funciones clave**:
```typescript
conciliarAutomaticamente(movimientoId: string, umbralConfianza?: number)
calcularScore(movimiento: MovimientoBancario, pago: PagoEsperado)
calcularSimilitudTexto(texto1: string, texto2: string) // Levenshtein distance
```

### 3. IMPORTACIÓN DE ARCHIVOS

**Endpoint**: `/app/api/tesoreria/conciliacion/importar/route.ts`

Soportar:
- **CSV**: Usar `csv-parse`
- **Excel**: Usar `xlsx` (XLSX.read + sheet_to_json)
- **PDF**: Opcional con Document AI o extracción básica

**Mapeo de columnas flexible**:
```typescript
{
  fecha: ['Fecha', 'fecha', 'Date', 'F. Operación'],
  monto: ['Monto', 'monto', 'Importe', 'Amount'],
  referencia: ['Referencia', 'Ref', 'Concepto'],
  dni_cuit: ['DNI', 'CUIT', 'Documento']
}
```

**Flow**:
1. Usuario sube archivo
2. Sistema detecta formato y parsea
3. Normaliza datos (fechas, montos, DNI sin guiones)
4. Inserta en `movimientos_bancarios`
5. Ejecuta `conciliarAutomaticamente()` para cada movimiento
6. Retorna resumen: X conciliados, Y requieren revisión

### 4. INTEGRACIÓN CON GEMINI AI

**Archivo**: `/lib/conciliacion/gemini-matcher.ts`

**Caso de uso**: Cuando el motor de reglas no encuentra match > 40pts

**Prompt template**:
```
Eres experto en conciliación bancaria. Analiza este movimiento y determina cuál pago esperado corresponde.

MOVIMIENTO BANCARIO:
- Fecha: {fecha}
- Monto: ${monto}
- DNI/CUIT: {dni_cuit}
- Referencia: {referencia}

CANDIDATOS (pagos esperados en ±7 días):
1. Cliente: {nombre} | Monto: ${monto} | DNI: {dni} | Pedido: #{numero}
2. ...

Responde SOLO JSON:
{
  "match_id": <1-N o null>,
  "confianza": <0.0-1.0>,
  "razon": "<explicación>"
}
```

### 5. INTERFAZ DE USUARIO

**Estructura de rutas**:
```
/app/tesoreria/conciliacion/
  ├─ page.tsx              (Dashboard principal)
  ├─ importar/page.tsx     (Subir archivo)
  ├─ revisar/page.tsx      (Cola de revisión manual)
  └─ historial/page.tsx    (Conciliaciones completadas)
```

#### **Dashboard Principal** (`page.tsx`)

**Layout de 3 columnas**:

```
┌──────────────────────────────────────────────────────────────┐
│  🏦 CONCILIACIÓN BANCARIA                    [📤 Importar]   │
├─────────────┬────────────────────┬──────────────────────────┤
│  BANCARIOS  │   SUGERENCIAS AI   │   PAGOS PENDIENTES       │
│ (pendientes)│                    │   (sin conciliar)        │
├─────────────┼────────────────────┼──────────────────────────┤
│ 📅 05/01/26 │ ✅ Match 95%       │ 📋 Pedido #1234          │
│ 💵 $15,000  │ Pedido #1234       │ 💰 $15,000               │
│ 👤 12345678 │ • Monto exacto ✓   │ 🏢 ACME SA               │
│ 📝 TRF001   │ • DNI coincide ✓   │ 👤 DNI: 12345678         │
│             │ • Fecha: mismo día │                          │
│ [Ver más▼] │ [✓ Confirmar]      │ [Detalles]               │
├─────────────┼────────────────────┼──────────────────────────┤
│ 📅 05/01/26 │ ⚠️ Match 68%       │ 📋 Pedido #1236          │
│ 💵 $8,500   │ Pedido #1236       │ 💰 $10,000               │
│ 👤 87654321 │ • Monto 85% ⚠️     │ 🏢 Distribuidora XYZ     │
│ 📝 -        │ • DNI coincide ✓   │ 👤 DNI: 87654321         │
│             │ • Cliente mayorista│                          │
│ [Ver más▼] │ [👁️ Revisar]       │ [Detalles]               │
└─────────────┴────────────────────┴──────────────────────────┘

ESTADÍSTICAS (cards superiores):
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Auto-concil. │ Pendientes   │ Diferencias  │ Tasa éxito   │
│ 42 / 50      │ 8            │ -$1,250      │ 84%          │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Componentes**:
- `MovimientoBancarioCard`: Card de movimiento bancario (draggable)
- `SugerenciaMatchCard`: Card con score visual (progress bar) + detalles
- `PagoEsperadoCard`: Card de pago pendiente
- `StatsCards`: 4 cards con métricas

**Interacciones**:
- Click en "Confirmar" → Crear conciliación + actualizar estados
- Click en "Revisar" → Modal con detalles + botones [Conciliar] [Descartar]
- Drag & drop: Arrastrar movimiento bancario a pago esperado = conciliación manual

#### **Página de Importación** (`importar/page.tsx`)

**Componentes**:
1. Selector de cuenta bancaria (dropdown)
2. Dropzone para archivo (React Dropzone)
3. Preview de columnas detectadas con mapeo manual
4. Botón "Procesar e Importar"
5. Progress bar durante procesamiento
6. Resultado: "X movimientos importados, Y auto-conciliados"

#### **Página de Revisión** (`revisar/page.tsx`)

**TanStack Table** con:
- Columnas: Fecha | Monto | DNI | Referencia | Sugerencia | Confianza | Acciones
- Filtros: Por fecha, por monto, solo sin sugerencias
- Acciones por fila: [Conciliar con...] [Buscar manualmente] [Descartar]

### 6. SERVER ACTIONS

**Archivo**: `/app/actions/conciliacion-actions.ts`

```typescript
'use server'

// Crear conciliación manual
async function crearConciliacionManual(data: {
  movimientoBancarioId: string,
  pagoEsperadoId: string,
  notas?: string
})

// Rechazar sugerencia automática
async function rechazarSugerencia(movimientoBancarioId: string, razon: string)

// Descartar movimiento bancario (no corresponde)
async function descartarMovimiento(movimientoBancarioId: string, motivo: string)

// Obtener sugerencias para un movimiento
async function obtenerSugerencias(movimientoBancarioId: string)

// Re-procesar movimientos sin match
async function reprocesarMovimientos(fechaDesde?: Date)
```

### 7. VALIDACIONES Y EDGE CASES

**Zod schemas**:
```typescript
const MovimientoBancarioSchema = z.object({
  fecha: z.coerce.date(),
  monto: z.number().positive(),
  referencia: z.string().optional(),
  dni_cuit: z.string().regex(/^\d{8,11}$/).optional()
})
```

**Edge cases a manejar**:
- ❌ Movimiento duplicado (mismo monto + fecha + DNI)
- ⚠️ Monto negativo (débito en vez de crédito)
- ⚠️ Pago esperado ya conciliado (mostrar advertencia)
- ⚠️ Diferencia > 20% (requiere aprobación de supervisor)
- ✅ Un movimiento puede conciliar múltiples pagos (split manual)

### 8. NOTIFICACIONES

**Triggers de Supabase** para enviar notificaciones en tiempo real:
- 🔔 Nuevo movimiento sin match automático
- 🔔 Diferencia de monto > 10%
- 🔔 Pago esperado vencido (fecha_esperada + 7 días)

---

## ESTRUCTURA DE ARCHIVOS ESPERADA

```
/app/tesoreria/conciliacion/
  ├─ page.tsx                          (Dashboard 3 columnas)
  ├─ importar/page.tsx                 (Subir archivo)
  ├─ revisar/page.tsx                  (Tabla de revisión)
  ├─ historial/page.tsx                (Log de conciliaciones)
  └─ components/
      ├─ movimiento-bancario-card.tsx
      ├─ sugerencia-match-card.tsx
      ├─ pago-esperado-card.tsx
      ├─ stats-cards.tsx
      ├─ import-wizard.tsx
      └─ conciliar-manual-dialog.tsx

/app/api/tesoreria/conciliacion/
  ├─ importar/route.ts                 (POST: subir archivo)
  ├─ procesar/route.ts                 (POST: ejecutar motor)
  └─ stats/route.ts                    (GET: métricas dashboard)

/app/actions/
  └─ conciliacion-actions.ts           (Server Actions)

/lib/conciliacion/
  ├─ motor-conciliacion.ts             (Motor de reglas)
  ├─ gemini-matcher.ts                 (IA matching)
  ├─ parsers.ts                        (CSV/Excel/PDF)
  └─ utils.ts                          (Similitud texto, normalización)

/types/
  └─ conciliacion.ts                   (TypeScript interfaces)
```

---

## CRITERIOS DE ÉXITO

✅ **Funcionalidad core**: Motor de conciliación con score >= 70 auto-aprueba  
✅ **UX**: Drag & drop para conciliación manual  
✅ **Performance**: Procesar 50 movimientos en < 10 segundos  
✅ **IA**: Gemini mejora en 15-20% los casos no matcheados por reglas  
✅ **Responsive**: Funciona en tablet/móvil (3 columnas → 1 columna con tabs)  
✅ **Accesibilidad**: Componentes shadcn/ui con aria-labels  
✅ **Testing**: Al menos 5 casos de prueba con datos mock  

---

## DATOS DE PRUEBA (Mock)

Generar 20 movimientos bancarios y 25 pagos esperados con:
- 70% matches exactos (100 pts)
- 20% matches parciales (60-80 pts)
- 10% sin match obvio (< 40 pts)

**Incluir casos especiales**:
- Cliente mayorista pagando menos (monto 85%)
- DNI con/sin guiones
- Referencias similares pero no idénticas
- Fechas ±3 días

---

## ENTREGABLES

1. **Código completo** de todos los archivos listados
2. **Migraciones SQL** para crear las 3 tablas
3. **Seed data** para testing (archivo `seed-conciliacion.sql`)
4. **README.md** con instrucciones de instalación y uso
5. **Demo video** o screenshots del flujo completo

---

## NOTAS ADICIONALES

- Usar **Server Components** por defecto, Client Components solo cuando necesario (useState, onClick)
- Seguir convenciones del proyecto existente (nombres en español, estructura de carpetas)
- Integrar con sistema de permisos existente (solo rol "tesorero" y "admin")
- Logs detallados en Supabase para auditoría

---

## PRIORIDAD DE IMPLEMENTACIÓN

### Fase 1 (Crítico)
- Modelo de datos (SQL migrations)
- Motor de reglas básico
- Importación CSV/Excel

### Fase 2 (Importante)
- Dashboard 3 columnas
- Server Actions
- Conciliación manual

### Fase 3 (Nice-to-have)
- Integración Gemini AI
- Drag & drop
- Importación PDF

---

## INSTRUCCIONES PARA LA IA

Por favor genera el código completo priorizando **Fase 1 y 2**. 

**Requisitos técnicos**:
- TypeScript estricto (no usar `any`)
- Componentes shadcn/ui para toda la UI
- Server Actions para mutaciones
- React Hook Form + Zod para formularios
- TanStack Table para tablas con paginación
- Comentarios en español
- Manejo de errores con try-catch
- Loading states en todos los async operations

**Formato de entrega**:
1. Primero: Migraciones SQL completas
2. Segundo: Tipos TypeScript (`/types/conciliacion.ts`)
3. Tercero: Utilidades y motor de conciliación (`/lib/conciliacion/`)
4. Cuarto: Server Actions (`/app/actions/conciliacion-actions.ts`)
5. Quinto: API Routes (`/app/api/tesoreria/conciliacion/`)
6. Sexto: Componentes UI (`/app/tesoreria/conciliacion/components/`)
7. Séptimo: Páginas principales (`/app/tesoreria/conciliacion/*.tsx`)

---

## CASOS DE USO PRINCIPALES

### Caso 1: Importación exitosa con auto-conciliación
```
Usuario → Sube CSV con 50 movimientos
Sistema → Parsea y normaliza datos
Sistema → Ejecuta motor de conciliación
Resultado → 42 auto-conciliados, 8 requieren revisión
Usuario → Ve dashboard con resultados
```

### Caso 2: Revisión manual de match parcial
```
Usuario → Ve movimiento de $8,500 con sugerencia 68%
Usuario → Click en "Revisar"
Sistema → Muestra modal con detalles + razones del score
Usuario → Confirma o descarta
Sistema → Actualiza estados
```

### Caso 3: Conciliación manual sin sugerencia
```
Usuario → Ve movimiento sin sugerencias (<40 pts)
Usuario → Arrastra movimiento a pago esperado
Sistema → Crea conciliación manual
Sistema → Pide confirmación si diferencia > 10%
```

### Caso 4: Uso de Gemini AI
```
Sistema → Detecta movimiento sin match de reglas
Sistema → Envía a Gemini con contexto
Gemini → Retorna {match_id: 3, confianza: 0.75, razon: "..."}
Sistema → Muestra como sugerencia al usuario
```

---

## EJEMPLO DE DATOS MOCK

```sql
-- Movimiento bancario
INSERT INTO movimientos_bancarios (fecha, monto, dni_cuit, referencia, descripcion) 
VALUES ('2026-01-05', 15000.00, '12345678', 'TRF001', 'Transferencia ACME SA');

-- Pago esperado
INSERT INTO pagos_esperados (pedido_id, cliente_id, monto_esperado, fecha_esperada, dni_cuit)
VALUES ('uuid-pedido-1234', 'uuid-cliente-acme', 15000.00, '2026-01-05', '12345678');

-- Conciliación automática (score 95)
INSERT INTO conciliaciones (movimiento_bancario_id, pago_esperado_id, monto_conciliado, diferencia, tipo_match, confianza_score)
VALUES ('uuid-mov-1', 'uuid-pago-1', 15000.00, 0, 'automatico', 0.95);
```

---

## REFERENCIAS DE DISEÑO

Inspirarse en:
- **Stripe Dashboard**: Claridad en tablas financieras
- **QuickBooks**: UX de conciliación bancaria
- **Linear**: Interacciones fluidas (drag & drop)

---

¿Estás listo? Comienza generando el código siguiendo el orden de entrega especificado arriba.
