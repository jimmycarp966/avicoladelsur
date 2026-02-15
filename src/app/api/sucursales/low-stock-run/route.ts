import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sincronizarSolicitudesAutomaticasStockBajo } from "@/lib/services/sucursales-stock-sync";

// POST /api/sucursales/low-stock-run
// Ejecuta evaluacion de stock bajo y sincroniza solicitudes automaticas
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const sucursalIdObjetivo =
      typeof body?.sucursal_id === "string" && body.sucursal_id.length > 0
        ? body.sucursal_id
        : null;
    const productoIdObjetivo =
      typeof body?.producto_id === "string" && body.producto_id.length > 0
        ? body.producto_id
        : null;

    let sucursalesQuery = supabase
      .from("sucursales")
      .select("id, nombre")
      .eq("active", true);
    if (sucursalIdObjetivo) {
      sucursalesQuery = sucursalesQuery.eq("id", sucursalIdObjetivo);
    }
    const { data: sucursales, error: sucursalesError } = await sucursalesQuery;

    if (sucursalesError) {
      return NextResponse.json(
        { success: false, error: `Error al obtener sucursales: ${sucursalesError.message}` },
        { status: 500 },
      );
    }

    let totalAlertas = 0;
    let totalSolicitudes = 0;
    let totalSolicitudesActualizadas = 0;
    const resultados = [];

    for (const sucursal of sucursales || []) {
      try {
        const syncResult = await sincronizarSolicitudesAutomaticasStockBajo(
          supabase as any,
          sucursal.id,
          productoIdObjetivo || undefined,
        );

        totalAlertas += syncResult.total_alertas || 0;
        totalSolicitudes += syncResult.total_solicitudes || 0;
        totalSolicitudesActualizadas += syncResult.total_solicitudes_actualizadas || 0;

        resultados.push({
          sucursal: sucursal.nombre,
          exito: true,
          alertas: syncResult.total_alertas || 0,
          solicitudes_creadas: syncResult.total_solicitudes || 0,
          solicitudes_actualizadas: syncResult.total_solicitudes_actualizadas || 0,
          sin_cambios: syncResult.total_sin_cambios || 0,
          detalle: syncResult.resultados || [],
        });
      } catch (error: any) {
        console.error(`Error en sucursal ${sucursal.nombre}:`, error);
        resultados.push({
          sucursal: sucursal.nombre,
          exito: false,
          error: error?.message || "Error desconocido",
          alertas: 0,
          solicitudes_creadas: 0,
          solicitudes_actualizadas: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        scope: {
          sucursal_id: sucursalIdObjetivo,
          producto_id: productoIdObjetivo,
        },
        totalAlertas,
        totalSolicitudes,
        totalSolicitudesActualizadas,
        resultados,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en low-stock-run:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    );
  }
}
