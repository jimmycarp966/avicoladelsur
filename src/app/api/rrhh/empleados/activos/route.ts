import { NextResponse } from "next/server";
import { obtenerEmpleadosActivosAction } from "@/actions/rrhh.actions";

export async function GET() {
  try {
    const result = await obtenerEmpleadosActivosAction();
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudieron obtener los empleados activos",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      total: result.data?.length || 0,
      data: result.data ?? [],
    });
  } catch (error) {
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

