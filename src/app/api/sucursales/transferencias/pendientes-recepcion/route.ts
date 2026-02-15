import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { obtenerTransferenciasPendientesRecepcionAction } from "@/actions/sucursales-transferencias.actions";

const querySchema = z.object({
  sucursal_id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const query = querySchema.parse({
      sucursal_id: request.nextUrl.searchParams.get("sucursal_id"),
    });

    const data = await obtenerTransferenciasPendientesRecepcionAction(query.sucursal_id);

    return NextResponse.json({
      success: true,
      total: data.length,
      sucursal_id: query.sucursal_id,
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

