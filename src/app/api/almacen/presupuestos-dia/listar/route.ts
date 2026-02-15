import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTodayArgentina } from "@/lib/utils";
import { obtenerPresupuestosDiaAction } from "@/actions/presupuestos-dia.actions";

const listarPresupuestosDiaQuerySchema = z.object({
  fecha: z.string().optional(),
  zona_id: z.string().uuid().optional(),
  turno: z.string().optional(),
  buscar: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const params = listarPresupuestosDiaQuerySchema.parse({
      fecha: request.nextUrl.searchParams.get("fecha") || undefined,
      zona_id: request.nextUrl.searchParams.get("zona_id") || undefined,
      turno: request.nextUrl.searchParams.get("turno") || undefined,
      buscar: request.nextUrl.searchParams.get("buscar") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") || undefined,
    });

    const fecha = params.fecha || getTodayArgentina();
    const result = await obtenerPresupuestosDiaAction(
      fecha,
      params.zona_id,
      params.turno,
      params.buscar,
      params.page || 1,
      params.pageSize || 50,
    );

    const presupuestos = (result.presupuestos || []).map((presupuesto: any) => ({
      id: presupuesto.id,
      numero_presupuesto: presupuesto.numero_presupuesto,
      estado: presupuesto.estado,
      turno: presupuesto.turno,
      fecha_entrega_estimada: presupuesto.fecha_entrega_estimada,
      zona_id: presupuesto.zona_id,
      cliente_id: presupuesto.cliente_id,
      cliente_nombre: presupuesto.cliente?.nombre || null,
      zona_nombre: presupuesto.zona?.nombre || null,
      items_count: Array.isArray(presupuesto.items) ? presupuesto.items.length : 0,
    }));

    return NextResponse.json({
      success: true,
      fecha,
      filters: params,
      total: result.totalCount || 0,
      estadisticas: result.estadisticas,
      resumenDia: result.resumenDia,
      data: presupuestos,
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
