import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { marcarAsistenciaAction } from "@/actions/rrhh.actions";

const marcarAsistenciaSchema = z.object({
  empleado_id: z.string().uuid(),
  fecha: z.string().min(1),
  hora_entrada: z.string().optional(),
  hora_salida: z.string().optional(),
  turno: z.enum(["mañana", "tarde", "noche"]).optional(),
  estado: z.enum(["presente", "ausente", "tarde", "licencia"]).optional(),
  observaciones: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = marcarAsistenciaSchema.parse(body);

    const result = await marcarAsistenciaAction({
      empleado_id: payload.empleado_id,
      fecha: payload.fecha,
      hora_entrada: payload.hora_entrada,
      hora_salida: payload.hora_salida,
      turno: payload.turno,
      estado: payload.estado,
      observaciones: payload.observaciones,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo registrar la asistencia",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Asistencia registrada",
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

