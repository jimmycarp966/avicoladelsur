import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { upsertLiquidacionJornadaAction } from "@/actions/rrhh.actions"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const jornadaSchema = z.object({
  id: z.string().uuid().optional(),
  fecha: z.string().min(8),
  turno: z.string().optional(),
  tarea: z.string().optional(),
  horas_mensuales: z.number().min(0).optional(),
  horas_adicionales: z.number().min(0).optional(),
  horas_extra_aprobadas: z.boolean().optional(),
  turno_especial_unidades: z.number().min(0).optional(),
  tarifa_hora_base: z.number().min(0).optional(),
  tarifa_hora_extra: z.number().min(0).optional(),
  tarifa_turno_especial: z.number().min(0).optional(),
  origen: z.enum(["auto_hik", "auto_asistencia", "auto_licencia_descanso", "auto_suspension", "manual"]).optional(),
  observaciones: z.string().optional(),
})

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)

    const supabase = await createClient()

    const { data: liquidacion, error: liquidacionError } = await supabase
      .from("rrhh_liquidaciones")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (liquidacionError || !liquidacion?.id) {
      return NextResponse.json(
        { success: false, error: "Liquidacion no encontrada" },
        { status: 404 },
      )
    }

    const { data: jornadas, error: jornadasError } = await supabase
      .from("rrhh_liquidacion_jornadas")
      .select("*")
      .eq("liquidacion_id", id)
      .order("fecha", { ascending: true })
      .order("created_at", { ascending: true })

    if (jornadasError) {
      return NextResponse.json(
        { success: false, error: jornadasError.message },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        liquidacion,
        jornadas: jornadas || [],
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Parametro invalido", details: error.issues },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    )
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)
    const body = await request.json()
    const payload = jornadaSchema.parse(body)

    const result = await upsertLiquidacionJornadaAction(id, payload)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo guardar la jornada",
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Jornada guardada",
      data: result.data || null,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Datos invalidos", details: error.issues },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    )
  }
}


