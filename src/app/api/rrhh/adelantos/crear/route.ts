import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearAdelantoAction } from "@/actions/rrhh.actions";

const crearAdelantoSchema = z
  .object({
    empleado_id: z.string().uuid(),
    tipo: z.enum(["dinero", "producto"]),
    monto: z.number().positive().optional(),
    producto_id: z.string().uuid().optional(),
    cantidad: z.number().positive().optional(),
    precio_unitario: z.number().positive().optional(),
    cantidad_cuotas: z.number().int().min(1).max(24).optional(),
    fecha_solicitud: z.string().optional(),
    observaciones: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.tipo === "dinero" && !value.monto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monto"],
        message: "monto es requerido para adelantos en dinero",
      });
    }

    if (value.tipo === "producto") {
      if (!value.producto_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["producto_id"],
          message: "producto_id es requerido para adelantos en producto",
        });
      }
      if (!value.cantidad) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cantidad"],
          message: "cantidad es requerida para adelantos en producto",
        });
      }
      if (!value.precio_unitario) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["precio_unitario"],
          message: "precio_unitario es requerido para adelantos en producto",
        });
      }
    }
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = crearAdelantoSchema.parse(body);

    const result = await crearAdelantoAction({
      empleado_id: payload.empleado_id,
      tipo: payload.tipo,
      monto: payload.monto,
      producto_id: payload.producto_id,
      cantidad: payload.cantidad,
      precio_unitario: payload.precio_unitario,
      cantidad_cuotas: payload.cantidad_cuotas,
      fecha_solicitud: payload.fecha_solicitud,
      observaciones: payload.observaciones,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "No se pudo crear el adelanto",
          data: result.data ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Adelanto creado",
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
