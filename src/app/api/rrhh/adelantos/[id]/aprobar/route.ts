import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aprobarAdelantoAction } from "@/actions/rrhh.actions";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const aprobarBodySchema = z.object({
  cantidad_cuotas: z.number().int().min(1).max(24).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id } = paramsSchema.parse(params);
    const body = await request.json().catch(() => ({}));
    const payload = aprobarBodySchema.parse(body);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuario no autenticado",
        },
        { status: 401 },
      );
    }

    const result = await aprobarAdelantoAction(id, user.id, payload.cantidad_cuotas ?? 1);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo aprobar el adelanto",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Adelanto aprobado",
      data: { adelantoId: id },
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
