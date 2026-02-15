import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calcularLiquidacionMensualAction } from "@/actions/rrhh.actions";

const calcularLiquidacionSchema = z.object({
  empleado_id: z.string().uuid(),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = calcularLiquidacionSchema.parse(body);

    const result = await calcularLiquidacionMensualAction(
      payload.empleado_id,
      payload.mes,
      payload.anio,
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo calcular la liquidacion",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Liquidacion calculada",
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

