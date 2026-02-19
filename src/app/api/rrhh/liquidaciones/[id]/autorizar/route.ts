import { NextResponse } from "next/server"
import { z } from "zod"
import { autorizarPagoLiquidacionAction } from "@/actions/rrhh.actions"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const bodySchema = z.object({
  autorizado: z.boolean(),
  motivo: z.string().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params
    const { id } = paramsSchema.parse(params)
    const body = bodySchema.parse(await request.json())

    const result = await autorizarPagoLiquidacionAction(id, body.autorizado, body.motivo)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "No se pudo guardar autorizacion" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Autorizacion actualizada",
      data: { liquidacionId: id },
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

