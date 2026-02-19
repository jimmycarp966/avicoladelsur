import { NextResponse } from "next/server"
import { z } from "zod"
import { actualizarLiquidacionControlAction } from "@/actions/rrhh.actions"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const controlSchema = z.object({
  puesto_override: z.string().nullable().optional(),
  dias_cajero: z.number().min(0).optional(),
  diferencia_turno_cajero: z.number().min(0).optional(),
  orden_pago: z.number().int().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)
    const body = controlSchema.parse(await request.json())

    const result = await actualizarLiquidacionControlAction(id, body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "No se pudo guardar control" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Control actualizado",
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

