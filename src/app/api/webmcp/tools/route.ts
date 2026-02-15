import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWebMcpConfirmationMode, getWebMcpToolsForRole } from "@/lib/webmcp/tool-catalog";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 },
      );
    }

    const { data: usuario, error } = await supabase
      .from("usuarios")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    if (error || !usuario || !usuario.activo) {
      return NextResponse.json(
        { success: false, error: "Usuario invalido o inactivo" },
        { status: 403 },
      );
    }

    const tools = getWebMcpToolsForRole(usuario.rol).map((tool) => ({
      id: tool.id,
      title: tool.title,
      description: tool.description,
      kind: tool.kind,
      risk: tool.risk,
      confirmationRequired: tool.confirmationRequired,
      confirmationMode: getWebMcpConfirmationMode(tool),
      confirmationCodeRequired: getWebMcpConfirmationMode(tool) === "hard",
      inputSchema: tool.inputSchema,
    }));

    return NextResponse.json({
      success: true,
      role: usuario.rol,
      total: tools.length,
      data: tools,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
