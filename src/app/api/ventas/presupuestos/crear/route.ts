import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearPresupuestoAction } from "@/actions/presupuestos.actions";

const presupuestoItemSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad_solicitada: z.number().positive(),
  precio_unit_est: z.number().positive(),
  lista_precio_id: z.string().uuid().optional(),
});

const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid(),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  lista_precio_id: z.string().uuid().optional(),
  tipo_venta: z.enum(["reparto", "retira_casa_central"]).optional(),
  items: z.array(presupuestoItemSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = crearPresupuestoSchema.parse(body);

    const formData = new FormData();
    formData.append("cliente_id", payload.cliente_id);
    if (payload.zona_id) formData.append("zona_id", payload.zona_id);
    if (payload.fecha_entrega_estimada) {
      formData.append("fecha_entrega_estimada", payload.fecha_entrega_estimada);
    }
    if (payload.observaciones) formData.append("observaciones", payload.observaciones);
    if (payload.lista_precio_id) formData.append("lista_precio_id", payload.lista_precio_id);
    if (payload.tipo_venta) formData.append("tipo_venta", payload.tipo_venta);
    formData.append("items", JSON.stringify(payload.items));

    const result = await crearPresupuestoAction(formData);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.message || "No se pudo crear el presupuesto",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Presupuesto creado correctamente",
      data: result.data ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos invalidos",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
