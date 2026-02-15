import { NextResponse } from "next/server";
import { z } from "zod";
import { obtenerPresupuestoAction } from "@/actions/presupuestos.actions";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id } = paramsSchema.parse(params);

    const result = await obtenerPresupuestoAction(id);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.message || "Presupuesto no encontrado",
          data: result.data ?? null,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Parametro de presupuesto invalido",
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
