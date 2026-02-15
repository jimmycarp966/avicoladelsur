import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearTransferenciaAction } from "@/actions/sucursales-transferencias.actions";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const itemSchema = z.object({
  producto_id: z.string().regex(uuidRegex, "UUID invalido"),
  cantidad: z.number().positive(),
});

const bodySchema = z.object({
  sucursal_origen_id: z.string().regex(uuidRegex, "UUID invalido"),
  sucursal_destino_id: z.string().regex(uuidRegex, "UUID invalido"),
  motivo: z.string().optional(),
  observaciones: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = bodySchema.parse(body);

    const formData = new FormData();
    formData.append("sucursal_origen_id", payload.sucursal_origen_id);
    formData.append("sucursal_destino_id", payload.sucursal_destino_id);
    if (payload.motivo) formData.append("motivo", payload.motivo);
    if (payload.observaciones) formData.append("observaciones", payload.observaciones);
    formData.append("items", JSON.stringify(payload.items));

    const result = await crearTransferenciaAction(formData);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.message || "No se pudo crear la transferencia",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Transferencia creada correctamente",
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
