import { z } from 'zod'

// Schema para crear presupuesto
export const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid(),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  turno: z.enum(['mañana', 'tarde']).optional(),
  metodos_pago: z.array(z.object({
    metodo: z.string(),
    recargo: z.number().min(0),
  })).optional(),
  items: z.array(z.object({
    producto_id: z.string().uuid(),
    cantidad_solicitada: z.number().positive(),
    precio_unit_est: z.number().positive(),
  })),
})

// Schema para asignar turno y zona
export const asignarTurnoZonaSchema = z.object({
  presupuesto_id: z.string().uuid(),
  turno: z.enum(['mañana', 'tarde']),
  zona_id: z.string().uuid(),
  metodos_pago: z.array(z.object({
    metodo: z.string(),
    recargo: z.number().min(0),
  })).optional(),
  recargo_total: z.number().min(0).default(0),
})

// Schema para actualizar peso de item
export const actualizarPesoItemSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso_final: z.number().positive(),
})

// Schema para confirmar presupuesto
export const confirmarPresupuestoSchema = z.object({
  presupuesto_id: z.string().uuid(),
  caja_id: z.string().uuid().optional(),
})

// Schema para convertir a cotización
export const convertirACotizacionSchema = z.object({
  presupuesto_id: z.string().uuid(),
})

// Schema para filtrar presupuestos
export const filtrarPresupuestosSchema = z.object({
  estado: z.enum(['pendiente', 'cotizacion', 'en_almacen', 'facturado', 'anulado']).optional(),
  zona_id: z.string().uuid().optional(),
  turno: z.enum(['mañana', 'tarde']).optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
})

