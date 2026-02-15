import { NextResponse } from "next/server";
import { obtenerSolicitudesAutomaticasAction } from "@/actions/sucursales-transferencias.actions";

export async function GET() {
  try {
    const data = await obtenerSolicitudesAutomaticasAction();
    return NextResponse.json({
      success: true,
      total: data.length,
      data,
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

