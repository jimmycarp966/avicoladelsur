# Plan: Mejoras en Presupuestos del Día - Paginación, Buscador, Lista de Preparación y Vehículos

Implementar paginación y buscador en la página de presupuestos del día, corregir el cálculo de cantidades en la lista de preparación para productos no pesables, y ocultar visualmente la sección de asignación automática de vehículos.

## Estado: ✅ COMPLETADO

Todas las mejoras han sido implementadas exitosamente.

## Problemas Identificados

### 1. Paginación más grande en presupuestos del día
- **Estado actual**: NO hay paginación implementada. La página muestra todos los presupuestos sin límite.
- **Solución**: Implementar paginación con tamaño de página configurable (recomendado: 50 items por página).

### 2. Buscador en presupuestos del día
- **Estado actual**: Solo hay filtros por fecha, zona y turno.
- **Solución**: Agregar campo de búsqueda de texto para filtrar por número de presupuesto y nombre de cliente.

### 3. Lista de preparaciones del día - Cálculo incorrecto de cantidades
- **Problema**: Los productos NO pesables muestran cantidades incorrectas (ej: "480 u", "400 u") que no corresponden a unidades reales.
- **Causa raíz**: La función `calcularKgItem()` siempre devuelve un valor numérico, pero para productos no pesables debería devolver unidades, no kg.
- **Solución**: 
  - Crear nueva función `calcularUnidadesItem()` que calcule correctamente las unidades para productos no pesables.
  - Usar esta función en la generación de `listaPreparacion` para productos no pesables.
  - La lógica debe considerar:
    - Si es venta mayorista con `kg_por_unidad_mayor`: mostrar en unidades mayores (cajones)
    - Si es venta normal: mostrar en unidades individuales

### 4. Sugerencia de vehículo - Ocultar visualmente
- **Problema**: El usuario quiere ocultar la sección "Asignación automática sugerida".
- **Solución**: Comentar o eliminar las líneas 263-316 de `presupuestos-dia/page.tsx` que muestran esta sección.

## Cambios a Implementar

### Archivo: `src/lib/utils/pesaje.ts`
- Agregar función `calcularUnidadesItem()` que calcule unidades para productos NO pesables:
  ```typescript
  export function calcularUnidadesItem(presupuesto: any, item: any): number {
    if (!item) return 0
    const esMayorista = esVentaMayorista(presupuesto, item)
    const kgPorUnidadMayor = item.producto?.kg_por_unidad_mayor

    if (esMayorista && kgPorUnidadMayor) {
      const cant = item.cantidad_solicitada || 0
      return cant  // Devolver cantidad en unidades mayores (cajones)
    }

    return item.cantidad_solicitada || 0  // Devolver cantidad en unidades individuales
  }
  ```

### Archivo: `src/actions/presupuestos-dia.actions.ts`
- Importar `calcularUnidadesItem` desde `@/lib/utils/pesaje`
- Modificar la generación de `listaPreparacion` (líneas 170-189):
  ```typescript
  ; (presupuesto.items || []).forEach((item: any) => {
    const productoKey = item.producto?.codigo || `${item.producto?.nombre || 'producto'}-${item.id}`
    const esMayorista = esVentaMayorista(presupuesto, item)
    const esPesable = esItemPesable(item, esMayorista)

    // Usar calcularKgItem para pesables, calcularUnidadesItem para NO pesables
    const cantidad = esPesable ? calcularKgItem(presupuesto, item) : calcularUnidadesItem(presupuesto, item)

    if (esPesable) {
      acc[key].totalKgPesables += cantidad
    }

    if (!acc[key].productos[productoKey]) {
      acc[key].productos[productoKey] = {
        nombre: item.producto?.nombre || 'Producto sin nombre',
        pesable: esPesable,
        totalCantidad: 0,
        presupuestosIds: new Set<string>(),
      }
    }

    acc[key].productos[productoKey].totalCantidad += cantidad
    acc[key].productos[productoKey].presupuestosIds.add(presupuesto.id)
  })
  ```

### Archivo: `src/app/(admin)/(dominios)/almacen/presupuestos-dia/presupuestos-dia-filtros.tsx`
- Agregar campo de búsqueda de texto:
  ```tsx
  <div className="space-y-2">
    <Label htmlFor="buscar">Buscar</Label>
    <Input
      id="buscar"
      type="text"
      placeholder="Número de presupuesto o cliente..."
      defaultValue={searchParams?.buscar}
      onChange={(e) => handleFilterChange('buscar', e.target.value)}
    />
  </div>
  ```

### Archivo: `src/app/(admin)/(dominios)/almacen/presupuestos-dia/page.tsx`
- **Ocultar sección de vehículos**: Comentar o eliminar líneas 263-316 (sección "Sugerencias de asignación automática")
- **Implementar paginación**: Agregar parámetros `page` y `pageSize` a `searchParams` y filtrar presupuestos según página actual
- **Agregar parámetro de búsqueda**: Pasar `searchParams?.buscar` a `obtenerPresupuestosDiaAction`

### Archivo: `src/actions/presupuestos-dia.actions.ts`
- Modificar `obtenerPresupuestosDiaAction` para aceptar parámetros de búsqueda y paginación:
  ```typescript
  export async function obtenerPresupuestosDiaAction(
    fecha: string,
    zonaId?: string,
    turno?: string,
    buscar?: string,
    page: number = 1,
    pageSize: number = 50
  )
  ```
- Implementar filtrado por texto (buscar por número de presupuesto o nombre de cliente)
- Implementar paginación usando `.range()` de Supabase

## Orden de Implementación

1. ✅ Corregir cálculo de cantidades en lista de preparación (más crítico)
2. ✅ Ocultar sección de vehículos (simple)
3. ✅ Implementar paginación
4. ✅ Agregar buscador de texto

## Validación

- Verificar que productos NO pesables muestren cantidades correctas en unidades
- Verificar que productos pesables sigan mostrando kg correctamente
- Verificar que la sección de vehículos ya no se muestre
- Verificar que la paginación funcione correctamente (50 items por página)
- Verificar que el buscador filtre por número de presupuesto y nombre de cliente
