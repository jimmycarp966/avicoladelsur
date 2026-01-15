---
name: erp-rrhh-liquidaciones
description: Liquidaciones de sueldos, control de asistencia, penalizaciones y gestión de adelantos (límite 30%). Usar al modificar módulo de RRHH.
---

# ERP RRHH - Liquidaciones

Gestiona liquidaciones de sueldos, asistencia, penalizaciones y adelantos.

## Cálculo de Sueldos

### Componentes del Sueldo

**1. Sueldo Base**
- Monto fijo mensual según categoría
- Se paga completo si asistencia >= 80%
- Se prorratea si asistencia < 80%

**2. Horas Extra**
- 50% adicional para horas extra diurnas
- 100% adicional para horas extra nocturnas
- 100% adicional para horas extra feriados

**3. Bonificaciones**
- Bonificación por antigüedad
- Bonificación por productividad
- Bonificación por presentismo

**4. Descuentos**
- Ausentismo sin justificación
- Retrasos (más de 3 veces por mes)
- Adelantos de sueldo

### Server Action: Calcular Liquidación
```typescript
'use server';

export async function calcularLiquidacionAction(args: {
  empleado_id: string;
  periodo_inicio: string;
  periodo_fin: string;
}) {
  console.log('[RRHH] Calculando liquidación:', args);

  const { empleado_id, periodo_inicio, periodo_fin } = args;

  // Obtener empleado
  const { data: empleado } = await supabase
    .from('empleados')
    .select('*')
    .eq('id', empleado_id)
    .single();

  if (!empleado) {
    throw new Error('Empleado no encontrado');
  }

  console.log('[RRHH] Empleado:', empleado);

  // Obtener asistencia del periodo
  const { data: asistencia } = await supabase
    .from('asistencia')
    .select('*')
    .eq('empleado_id', empleado_id)
    .gte('fecha', periodo_inicio)
    .lte('fecha', periodo_fin);

  console.log('[RRHH] Registros de asistencia:', asistencia?.length);

  // Calcular días trabajados
  const diasTrabajados = asistencia?.filter(a => a.estado === 'presente').length || 0;
  const diasTotales = calcularDiasLaborales(periodo_inicio, periodo_fin);
  const porcentajeAsistencia = (diasTrabajados / diasTotales) * 100;

  console.log('[RRHH] Días trabajados:', diasTrabajados);
  console.log('[RRHH] Días totales:', diasTotales);
  console.log('[RRHH] Porcentaje asistencia:', porcentajeAsistencia);

  // Calcular sueldo base (prorrateado si asistencia < 80%)
  let sueldoBase = empleado.sueldo_base;
  if (porcentajeAsistencia < 80) {
    sueldoBase = (empleado.sueldo_base * diasTrabajados) / diasTotales;
    console.log('[RRHH] Sueldo prorrateado:', sueldoBase);
  }

  // Calcular horas extra
  const horasExtra = calcularHorasExtra(asistencia);
  console.log('[RRHH] Horas extra:', horasExtra);

  // Calcular bonificaciones
  const bonificaciones = await calcularBonificaciones(empleado_id, periodo_inicio, periodo_fin);
  console.log('[RRHH] Bonificaciones:', bonificaciones);

  // Calcular descuentos
  const descuentos = await calcularDescuentos(empleado_id, periodo_inicio, periodo_fin);
  console.log('[RRHH] Descuentos:', descuentos);

  // Calcular adelantos del periodo
  const { data: adelantos } = await supabase
    .from('adelantos')
    .select('monto')
    .eq('empleado_id', empleado_id)
    .eq('periodo', periodo_inicio.substring(0, 7)) // YYYY-MM
    .eq('estado', 'aprobado');

  const totalAdelantos = adelantos?.reduce((sum, a) => sum + a.monto, 0) || 0;
  console.log('[RRHH] Total adelantos:', totalAdelantos);

  // Calcular sueldo neto
  const sueldoBruto = sueldoBase + horasExtra.total + bonificaciones.total;
  const sueldoNeto = sueldoBruto - descuentos.total - totalAdelantos;

  console.log('[RRHH] Sueldo bruto:', sueldoBruto);
  console.log('[RRHH] Sueldo neto:', sueldoNeto);

  // Generar liquidación
  const liquidacion = {
    empleado_id,
    periodo_inicio,
    periodo_fin,
    sueldo_base: sueldoBase,
    horas_extra: horasExtra,
    bonificaciones,
    descuentos,
    adelantos: totalAdelantos,
    sueldo_bruto: sueldoBruto,
    sueldo_neto: sueldoNeto,
    fecha_calculo: new Date().toISOString()
  };

  // Guardar liquidación
  const { data, error } = await supabase.from('liquidaciones').insert(liquidacion).select().single();

  if (error) {
    console.error('[RRHH] Error guardando liquidación:', error);
    throw new Error(error.message);
  }

  console.log('[RRHH] Liquidación guardada:', data);
  return data;
}

function calcularDiasLaborales(inicio: string, fin: string): number {
  const start = new Date(inicio);
  const end = new Date(fin);
  let dias = 0;

  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // No contar sábados (6) ni domingos (0)
      dias++;
    }
    current.setDate(current.getDate() + 1);
  }

  return dias;
}

function calcularHorasExtra(asistencia: any[]): {
  diurnas: number;
  nocturnas: number;
  feriados: number;
  total: number;
} {
  let diurnas = 0;
  let nocturnas = 0;
  let feriados = 0;

  asistencia?.forEach(a => {
    if (a.horas_extra_diurnas) diurnas += a.horas_extra_diurnas;
    if (a.horas_extra_nocturnas) nocturnas += a.horas_extra_nocturnas;
    if (a.horas_extra_feriados) feriados += a.horas_extra_feriados;
  });

  // Calcular monto de horas extra
  const montoDiurnas = diurnas * 1.5; // 50% adicional
  const montoNocturnas = nocturnas * 2.0; // 100% adicional
  const montoFeriados = feriados * 2.0; // 100% adicional

  return {
    diurnas: montoDiurnas,
    nocturnas: montoNocturnas,
    feriados: montoFeriados,
    total: montoDiurnas + montoNocturnas + montoFeriados
  };
}

async function calcularBonificaciones(empleado_id: string, inicio: string, fin: string): {
  antiguedad: number;
  productividad: number;
  presentismo: number;
  total: number;
} {
  // Bonificación por antigüedad (1% por año, máximo 10%)
  const { data: empleado } = await supabase
    .from('empleados')
    .select('fecha_ingreso, sueldo_base')
    .eq('id', empleado_id)
    .single();

  const añosAntiguedad = Math.floor(
    (Date.now() - new Date(empleado.fecha_ingreso).getTime()) / (365 * 24 * 60 * 60 * 1000)
  );

  const bonoAntiguedad = Math.min(añosAntiguedad * 0.01, 0.10) * empleado.sueldo_base;

  // Bonificación por productividad (según métricas)
  const bonoProductividad = 0; // Implementar según métricas específicas

  // Bonificación por presentismo (5% si asistencia >= 95%)
  const { data: asistencia } = await supabase
    .from('asistencia')
    .select('estado')
    .eq('empleado_id', empleado_id)
    .gte('fecha', inicio)
    .lte('fecha', fin);

  const diasPresentes = asistencia?.filter(a => a.estado === 'presente').length || 0;
  const diasTotales = calcularDiasLaborales(inicio, fin);
  const porcentajeAsistencia = (diasPresentes / diasTotales) * 100;

  const bonoPresentismo = porcentajeAsistencia >= 95 ? 0.05 * empleado.sueldo_base : 0;

  return {
    antiguedad: bonoAntiguedad,
    productividad: bonoProductividad,
    presentismo: bonoPresentismo,
    total: bonoAntiguedad + bonoProductividad + bonoPresentismo
  };
}

async function calcularDescuentos(empleado_id: string, inicio: string, fin: string): {
  ausentismo: number;
  retrasos: number;
  total: number;
} {
  // Descuento por ausentismo sin justificación
  const { data: ausencias } = await supabase
    .from('asistencia')
    .select('estado')
    .eq('empleado_id', empleado_id)
    .eq('estado', 'ausente_sin_justificar')
    .gte('fecha', inicio)
    .lte('fecha', fin);

  const descuentoAusentismo = (ausencias?.length || 0) * 500; // $500 por ausencia

  // Descuento por retrasos (más de 3 por mes)
  const { data: retrasos } = await supabase
    .from('asistencia')
    .select('estado')
    .eq('empleado_id', empleado_id)
    .eq('estado', 'retraso')
    .gte('fecha', inicio)
    .lte('fecha', fin);

  const descuentoRetrasos = Math.max(0, (retrasos?.length || 0) - 3) * 200; // $200 por retraso extra

  return {
    ausentismo: descuentoAusentismo,
    retrasos: descuentoRetrasos,
    total: descuentoAusentismo + descuentoRetrasos
  };
}
```

## Control de Asistencia

### Server Action: Registrar Asistencia
```typescript
'use server';

export async function registrarAsistenciaAction(args: {
  empleado_id: string;
  fecha: string;
  estado: 'presente' | 'ausente' | 'ausente_sin_justificar' | 'retraso' | 'licencia';
  horas_extra_diurnas?: number;
  horas_extra_nocturnas?: number;
  horas_extra_feriados?: number;
  observaciones?: string;
}) {
  console.log('[RRHH] Registrando asistencia:', args);

  const { empleado_id, fecha, estado, ...resto } = args;

  // Verificar que no exista registro previo
  const { data: existente } = await supabase
    .from('asistencia')
    .select('id')
    .eq('empleado_id', empleado_id)
    .eq('fecha', fecha)
    .single();

  if (existente) {
    throw new Error('Ya existe un registro de asistencia para esta fecha');
  }

  // Registrar asistencia
  const { data, error } = await supabase.from('asistencia').insert({
    empleado_id,
    fecha,
    estado,
    ...resto
  }).select().single();

  if (error) {
    console.error('[RRHH] Error registrando asistencia:', error);
    throw new Error(error.message);
  }

  console.log('[RRHH] Asistencia registrada:', data);
  return data;
}
```

## Gestión de Adelantos

### Reglas de Adelantos

**1. Límite del 30% del sueldo base**
- El adelanto máximo es el 30% del sueldo base
- Se calcula sobre el sueldo base del empleado

**2. Solo un adelanto por mes**
- No se pueden solicitar múltiples adelantos en el mismo mes
- El mes se considera como YYYY-MM

**3. Aprobación requerida**
- Los adelantos requieren aprobación de RRHH o administración
- El estado pasa de 'pendiente' a 'aprobado' o 'rechazado'

### Server Action: Solicitar Adelanto
```typescript
'use server';

export async function solicitarAdelantoAction(args: {
  empleado_id: string;
  monto: number;
  motivo: string;
  periodo: string; // YYYY-MM
}) {
  console.log('[RRHH] Solicitando adelanto:', args);

  const { empleado_id, monto, motivo, periodo } = args;

  // Obtener empleado
  const { data: empleado } = await supabase
    .from('empleados')
    .select('sueldo_base')
    .eq('id', empleado_id)
    .single();

  if (!empleado) {
    throw new Error('Empleado no encontrado');
  }

  // Verificar límite del 30%
  const limiteAdelanto = empleado.sueldo_base * 0.30;

  if (monto > limiteAdelanto) {
    throw new Error(`El monto solicitado ($${monto}) excede el límite del 30% ($${limiteAdelanto})`);
  }

  console.log('[RRHH] Límite adelanto:', limiteAdelanto);
  console.log('[RRHH] Monto solicitado:', monto);

  // Verificar que no exista otro adelanto en el mismo mes
  const { data: adelantoExistente } = await supabase
    .from('adelantos')
    .select('id')
    .eq('empleado_id', empleado_id)
    .eq('periodo', periodo)
    .in('estado', ['pendiente', 'aprobado'])
    .single();

  if (adelantoExistente) {
    throw new Error('Ya existe un adelanto pendiente o aprobado para este periodo');
  }

  // Solicitar adelanto
  const { data, error } = await supabase.from('adelantos').insert({
    empleado_id,
    monto,
    motivo,
    periodo,
    estado: 'pendiente',
    fecha_solicitud: new Date().toISOString()
  }).select().single();

  if (error) {
    console.error('[RRHH] Error solicitando adelanto:', error);
    throw new Error(error.message);
  }

  console.log('[RRHH] Adelanto solicitado:', data);
  return data;
}
```

### Server Action: Aprobar Adelanto
```typescript
'use server';

export async function aprobarAdelantoAction(args: {
  adelanto_id: string;
  aprobado: boolean;
  observaciones?: string;
  usuario_id: string;
}) {
  console.log('[RRHH] Aprobando adelanto:', args);

  const { adelanto_id, aprobado, observaciones, usuario_id } = args;

  // Obtener adelanto
  const { data: adelanto } = await supabase
    .from('adelantos')
    .select('*')
    .eq('id', adelanto_id)
    .single();

  if (!adelanto) {
    throw new Error('Adelanto no encontrado');
  }

  if (adelanto.estado !== 'pendiente') {
    throw new Error('El adelanto no está en estado pendiente');
  }

  // Actualizar estado
  const { data, error } = await supabase
    .from('adelantos')
    .update({
      estado: aprobado ? 'aprobado' : 'rechazado',
      observaciones,
      fecha_aprobacion: new Date().toISOString(),
      aprobado_por: usuario_id
    })
    .eq('id', adelanto_id)
    .select()
    .single();

  if (error) {
    console.error('[RRHH] Error aprobando adelanto:', error);
    throw new Error(error.message);
  }

  console.log('[RRHH] Adelanto actualizado:', data);
  return data;
}
```

## Debugging Liquidaciones

### Symptom: Sueldo neto incorrecto

**Check 1: Sueldo base se calcula correctamente**
```typescript
console.log('[RRHH] Sueldo base empleado:', empleado.sueldo_base);
console.log('[RRHH] Porcentaje asistencia:', porcentajeAsistencia);
console.log('[RRHH] Sueldo base calculado:', sueldoBase);

if (porcentajeAsistencia < 80) {
  const sueldoEsperado = (empleado.sueldo_base * diasTrabajados) / diasTotales;
  console.log('[RRHH] Sueldo esperado (prorrateado):', sueldoEsperado);
}
```

**Check 2: Horas extra se calculan correctamente**
```typescript
console.log('[RRHH] Horas extra diurnas:', horasExtra.diurnas);
console.log('[RRHH] Horas extra nocturnas:', horasExtra.nocturnas);
console.log('[RRHH] Horas extra feriados:', horasExtra.feriados);
console.log('[RRHH] Total horas extra:', horasExtra.total);
```

**Check 3: Adelantos se descuentan correctamente**
```typescript
console.log('[RRHH] Total adelantos:', totalAdelantos);
console.log('[RRHH] Sueldo bruto:', sueldoBruto);
console.log('[RRHH] Sueldo neto:', sueldoNeto);

const sueldoNetoEsperado = sueldoBruto - descuentos.total - totalAdelantos;
console.log('[RRHH] Sueldo neto esperado:', sueldoNetoEsperado);
```

## Optimización de Queries

### Index para RRHH
```sql
-- Índice para asistencia por empleado y fecha
CREATE INDEX idx_asistencia_empleado_fecha
ON asistencia(empleado_id, fecha DESC);

-- Índice para liquidaciones por empleado y periodo
CREATE INDEX idx_liquidaciones_empleado_periodo
ON liquidaciones(empleado_id, periodo_inicio DESC);

-- Índice para adelantos por empleado y periodo
CREATE INDEX idx_adelantos_empleado_periodo
ON adelantos(empleado_id, periodo DESC, estado);

-- Índice para bonificaciones por empleado y periodo
CREATE INDEX idx_bonificaciones_empleado_periodo
ON bonificaciones(empleado_id, periodo_inicio DESC);
```

## Related Skills
- **avicola-systematic-debugging** - Debugging liquidaciones
- **supabase-rls-audit** - RLS para RRHH
