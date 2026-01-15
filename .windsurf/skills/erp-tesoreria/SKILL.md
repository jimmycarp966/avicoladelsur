---
name: erp-tesoreria
description: Gestión de cajas, conciliación bancaria y precisión financiera. Usar al modificar módulo de Tesorería/Finanzas.
---

# ERP Tesorería

Garantiza que cada centavo sea rastreado y conciliado correctamente.

## Reglas Financieras
1. **Limpieza de Montos**: Siempre usar `limpiarMonto()` antes de operar
2. **Acreditación Atómica**: Solo vía RPC `fn_acreditar_saldo_cliente_v2`
3. **Sesión de Caja**: Todo movimiento vinculado a `cajas_diarias` abierta
4. **Arqueos**: Usar billetes argentinos (100, 200, 500, 1000, 2000, 10000, 20000)

## Tablas Clave
- `tesoreria_cajas`: Cajas físicas
- `movimientos_caja`: Transacciones diarias
- `cuentas_corrientes`: Saldos de clientes
- `conciliacion_bancaria_items`: Matching banco vs sistema

## Conciliación IA
- Parser robusto para locales regionales (puntos/comas)
- Gemini 3.0 Pro para matching difuso
- Estados: pendiente → matched → acreditado

## Validaciones
- No actualizar saldo manualmente (usar RPC)
- Mantener audit log de ajustes

## Debugging Conciliación Bancaria

### Symptom: Extracto no se parsea correctamente

**Check 1: Formato de entrada**
```typescript
// src/lib/tesoreria/conciliacion/parser.ts
function limpiarMonto(monto: string | number): number {
  if (typeof monto === 'number') return monto;

  // Remover símbolos de moneda y espacios
  let limpio = monto.toString()
    .replace(/\$/g, '')
    .replace(/\./g, '') // Remover separadores de miles
    .replace(/,/g, '.') // Reemplazar coma decimal por punto
    .replace(/\s/g, '')
    .trim();

  const numero = parseFloat(limpio);

  if (isNaN(numero)) {
    console.error('[Conciliacion] Monto inválido:', monto);
    throw new Error(`Monto inválido: ${monto}`);
  }

  console.log('[Conciliacion] Monto limpio:', numero);
  return numero;
}

// Ejemplos de uso
console.log(limpiarMonto('$1.500,50')); // 1500.50
console.log(limpiarMonto('1.500,50'));  // 1500.50
console.log(limpiarMonto('1500.50'));   // 1500.50
console.log(limpiarMonto('$ 1500.50')); // 1500.50
```

**Check 2: Gemini parsing**
```typescript
// src/lib/tesoreria/conciliacion/gemini-parser.ts
async function parsearExtractoConGemini(texto: string): Promise<Transaccion[]> {
  const prompt = `
Parsear el siguiente extracto bancario y extraer transacciones de depósitos.

Texto:
${texto}

Reglas:
1. Ignorar transacciones que no sean depósitos
2. Extraer: fecha (DD/MM/YYYY), monto (número), descripcion, referencia
3. Normalizar montos a formato numérico
4. Devolver JSON array

Ejemplo de salida:
[
  {
    "fecha": "15/01/2025",
    "monto": 5000.00,
    "descripcion": "DEPOSITO JUAN PEREZ",
    "referencia": "123456789"
  }
]
`;

  const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const response = result.response.candidates[0].content.parts[0].text;

  console.log('[Gemini] Respuesta:', response);

  try {
    const transacciones = JSON.parse(response);
    console.log('[Gemini] Transacciones parseadas:', transacciones.length);
    return transacciones;
  } catch (error) {
    console.error('[Gemini] Error parseando JSON:', error);
    throw new Error('Gemini devolvió JSON inválido');
  }
}
```

### Symptom: Matching no encuentra coincidencias

**Check 1: Similitud de nombres**
```typescript
// src/lib/tesoreria/conciliacion/matcher.ts
function calcularSimilitudNombres(nombre1: string, nombre2: string): number {
  // Normalizar: minúsculas, sin acentos, sin espacios extra
  const n1 = nombre1.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
  const n2 = nombre2.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();

  console.log('[Match] Comparando:', n1, 'vs', n2);

  // Coincidencia exacta
  if (n1 === n2) return 1.0;

  // Contiene nombre
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  // Distancia de Levenshtein
  const distancia = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similitud = 1 - (distancia / maxLen);

  console.log('[Match] Similitud:', similitud);
  return similitud;
}
```

**Check 2: Matching con Gemini**
```typescript
async function matchearTransaccionConGemini(
  transaccionBanco: TransaccionBanco,
  movimientosCaja: MovimientoCaja[]
): Promise<MatchResult> {
  const prompt = `
Matchear esta transacción bancaria con movimientos de caja:

Transacción Bancaria:
${JSON.stringify(transaccionBanco, null, 2)}

Movimientos de Caja:
${JSON.stringify(movimientosCaja, null, 2)}

Criterios de matching:
1. Monto: Debe coincidir exactamente (o diferencia < $10)
2. Fecha: Mismo día o día anterior
3. Nombre del cliente: Similitud > 0.7

Devolver JSON con:
{
  "matches": [
    {
      "movimiento_id": "uuid",
      "cliente_id": "uuid",
      "cliente_nombre": "Juan Perez",
      "similitud": 0.95,
      "razon": "Coincidencia exacta de nombre y monto"
    }
  ],
  "best_match": {
    "movimiento_id": "uuid",
    "cliente_id": "uuid",
    "cliente_nombre": "Juan Perez",
    "similitud": 0.95
  }
}
`;

  const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const response = JSON.parse(result.response.candidates[0].content.parts[0].text);

  console.log('[Match] Resultado:', response);
  return response;
}
```

## Debugging Acreditación de Saldos

### Symptom: Saldo no se actualiza

**Check 1: RPC se ejecuta correctamente**
```typescript
// src/app/api/tesoreria/conciliar/route.ts
export async function POST(req: Request) {
  const { matchId } = await req.json();

  console.log('[Conciliacion] Acreditando match:', matchId);

  // Obtener match
  const { data: match } = await supabase
    .from('conciliacion_bancaria_items')
    .select(`
      *,
      transaccion_banco,
      movimiento_caja
    `)
    .eq('id', matchId)
    .single();

  if (!match) {
    console.error('[Conciliacion] Match no encontrado');
    return Response.json({ error: 'Match no encontrado' }, { status: 404 });
  }

  console.log('[Conciliacion] Cliente:', match.movimiento_caja.cliente_id);
  console.log('[Conciliacion] Monto:', match.transaccion_banco.monto);

  // Ejecutar RPC
  const { data, error } = await supabase.rpc('fn_acreditar_saldo_cliente_v2', {
    p_cliente_id: match.movimiento_caja.cliente_id,
    p_monto: match.transaccion_banco.monto,
    p_caja_id: match.movimiento_caja.caja_id,
    p_usuario_id: auth.user.id
  });

  if (error) {
    console.error('[Conciliacion] Error RPC:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  console.log('[Conciliacion] RPC exitoso:', data);

  // Actualizar estado del match
  await supabase
    .from('conciliacion_bancaria_items')
    .update({ estado: 'acreditado' })
    .eq('id', matchId);

  return Response.json({ success: true, data });
}
```

**Check 2: Verificar RPC en Supabase**
```sql
-- Verificar que la RPC existe
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'fn_acreditar_saldo_cliente_v2';

-- Probar la RPC manualmente
SELECT * FROM fn_acreditar_saldo_cliente_v2(
  'uuid-cliente',
  5000.00,
  'uuid-caja',
  'uuid-usuario'
);
```

## Optimización de Queries

### Index para conciliación
```sql
-- Índice para búsquedas por fecha y monto
CREATE INDEX idx_movimientos_caja_fecha_monto
ON movimientos_caja(fecha, monto)
WHERE estado = 'pendiente';

-- Índice para búsquedas por cliente
CREATE INDEX idx_movimientos_caja_cliente
ON movimientos_caja(cliente_id, fecha DESC);

-- Índice para conciliación bancaria
CREATE INDEX idx_conciliacion_bancaria_estado
ON conciliacion_bancaria_items(estado, fecha_creacion);
```

### Batch updates
```typescript
// En lugar de actualizar uno por uno
for (const match of matches) {
  await supabase
    .from('conciliacion_bancaria_items')
    .update({ estado: 'acreditado' })
    .eq('id', match.id);
}

// Usar batch update
await supabase
  .from('conciliacion_bancaria_items')
  .update({ estado: 'acreditado' })
  .in('id', matches.map(m => m.id));
```

## Validaciones de Arqueo

### Billetes argentinos
```typescript
const BILLETES_ARGENTINOS = [100, 200, 500, 1000, 2000, 10000, 20000];

function validarArqueo(arqueo: Arqueo): boolean {
  let total = 0;

  for (const [billete, cantidad] of Object.entries(arqueo)) {
    const valor = parseInt(billete);

    if (!BILLETES_ARGENTINOS.includes(valor)) {
      console.error('[Arqueo] Billete inválido:', valor);
      return false;
    }

    if (cantidad < 0) {
      console.error('[Arqueo] Cantidad negativa:', cantidad);
      return false;
    }

    total += valor * cantidad;
  }

  console.log('[Arqueo] Total calculado:', total);
  return true;
}
```

## Related Skills
- **avicola-systematic-debugging** - Debugging conciliación
- **avicola-prompt-engineering** - Prompts para Gemini
- **supabase-rls-audit** - RLS para tesorería
