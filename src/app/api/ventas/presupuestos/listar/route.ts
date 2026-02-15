import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { obtenerPresupuestosAction } from "@/actions/presupuestos.actions";

const listarPresupuestosQuerySchema = z.object({
  estado: z.string().optional(),
  zona_id: z.string().uuid().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const filters = listarPresupuestosQuerySchema.parse({
      estado: request.nextUrl.searchParams.get("estado") || undefined,
      zona_id: request.nextUrl.searchParams.get("zona_id") || undefined,
      fecha_desde: request.nextUrl.searchParams.get("fecha_desde") || undefined,
      fecha_hasta: request.nextUrl.searchParams.get("fecha_hasta") || undefined,
    });

    const result = await obtenerPresupuestosAction(filters);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.message || "No se pudieron obtener presupuestos",
          data: result.data ?? [],
        },
        { status: 400 },
      );
    }

    const data = Array.isArray(result.data) ? result.data : [];
    return NextResponse.json({
      success: true,
      total: data.length,
      filters,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Parametros invalidos",
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
