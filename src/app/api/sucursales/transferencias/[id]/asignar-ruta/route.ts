import { NextResponse } from "next/server";
import { z } from "zod";
import { asignarTransferenciaARutaDesdeAlmacen } from "@/actions/reparto.actions";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id } = paramsSchema.parse(params);

    const result = await asignarTransferenciaARutaDesdeAlmacen(id);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.message || "No se pudo asignar la transferencia a ruta",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Transferencia asignada a ruta",
      data: result.data ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Parametro invalido",
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

