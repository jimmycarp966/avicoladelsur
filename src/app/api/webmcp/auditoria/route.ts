import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_LIMIT = 200;

function parseLimit(rawLimit: string | null): number {
  if (!rawLimit) return 50;
  const parsed = Number(rawLimit);
  if (Number.isNaN(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
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

    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios")
      .select("id, rol, activo")
      .eq("id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.activo) {
      return NextResponse.json(
        { success: false, error: "Usuario invalido o inactivo" },
        { status: 403 },
      );
    }

    const params = request.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const toolId = params.get("tool_id");
    const status = params.get("status");
    const requestedUserId = params.get("user_id");
    const isAdmin = usuario.rol === "admin";
    const targetUserId = isAdmin && requestedUserId ? requestedUserId : user.id;

    let query = supabase
      .from("webmcp_audit_logs")
      .select(
        "id, user_id, user_role, tool_id, tool_kind, risk, confirmation_mode, confirmation_provided, status, endpoint, method, http_status, error_message, duration_ms, created_at",
      )
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (toolId) query = query.eq("tool_id", toolId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0,
      filteredBy: {
        user_id: targetUserId,
        tool_id: toolId,
        status,
        limit,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

