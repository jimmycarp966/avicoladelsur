import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { confirmarRecepcionTransferenciaAction } from "@/actions/sucursales-transferencias.actions";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const bodySchema = z.object({
  items_recibidos: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        cantidad_recibida: z.number().nonnegative(),
      }),
    )
    .optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id } = paramsSchema.parse(params);

    const rawBody = await request.json().catch(() => ({}));
    const body = bodySchema.parse(rawBody);

    const result = await confirmarRecepcionTransferenciaAction(id, body.items_recibidos);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.message || "No se pudo confirmar la recepcion",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Recepcion confirmada",
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

