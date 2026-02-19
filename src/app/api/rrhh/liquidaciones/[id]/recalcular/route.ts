import { NextResponse } from "next/server"
import { z } from "zod"
import { recalcularLiquidacionAction } from "@/actions/rrhh.actions"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)

    const result = await recalcularLiquidacionAction(id)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo recalcular la liquidacion",
        },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Liquidacion recalculada",
      data: result.data || null,
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

