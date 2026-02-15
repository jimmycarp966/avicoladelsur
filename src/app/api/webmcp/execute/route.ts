import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getWebMcpConfirmationMode,
  getWebMcpToolById,
  type WebMcpApiTool,
  type WebMcpMethod,
} from "@/lib/webmcp/tool-catalog";

interface ExecuteRequestBody {
  tool?: string;
  input?: Record<string, unknown>;
}

type AuditStatus = "success" | "error" | "blocked";

interface AuditPayload {
  user_id: string;
  user_role: string;
  tool_id: string;
  tool_kind: "api" | "navigation";
  risk: "low" | "medium" | "high";
  confirmation_mode: "none" | "soft" | "hard";
  confirmation_provided: boolean;
  status: AuditStatus;
  endpoint?: string;
  method?: string;
  request_input?: Record<string, unknown>;
  response_payload?: unknown;
  http_status?: number;
  error_message?: string;
  duration_ms?: number;
}

const REDACTED_FIELDS = new Set([
  "password",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "auth",
  "secret",
  "refreshToken",
  "accessToken",
  "cookie",
  "cbu",
]);

function extractPath(pathTemplate: string, input: Record<string, unknown>) {
  let path = pathTemplate;
  const pathParams = (input.pathParams ?? {}) as Record<string, unknown>;
  const placeholders = [...pathTemplate.matchAll(/:([a-zA-Z0-9_]+)/g)];

  for (const match of placeholders) {
    const key = match[1];
    const value = pathParams[key] ?? input[key];
    if (!value) {
      throw new Error(`Falta path param requerido: ${key}`);
    }
    path = path.replace(`:${key}`, encodeURIComponent(String(value)));
  }

  return path;
}

function buildRequestInit(method: WebMcpMethod, input: Record<string, unknown>): RequestInit {
  if (method === "GET") {
    return { method };
  }

  const body = input.body ?? input;
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function applyGetQuery(url: URL, input: Record<string, unknown>) {
  const query = (input.query ?? {}) as Record<string, string | number | boolean | undefined>;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(source)) {
      if (REDACTED_FIELDS.has(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = sanitizeValue(inner);
      }
    }
    return result;
  }

  return value;
}

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: AuditPayload,
) {
  const { error } = await supabase.from("webmcp_audit_logs").insert({
    ...payload,
    request_input: payload.request_input ? sanitizeValue(payload.request_input) : null,
    response_payload: payload.response_payload ? sanitizeValue(payload.response_payload) : null,
  });

  if (error) {
    console.warn("[WebMCP] No se pudo registrar auditoria:", error.message);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const payload = (await request.json()) as ExecuteRequestBody;
    const toolId = payload.tool;
    const input = payload.input ?? {};

    if (!toolId) {
      return NextResponse.json(
        { success: false, error: "Campo tool es requerido" },
        { status: 400 },
      );
    }

    const tool = getWebMcpToolById(toolId);
    if (!tool || tool.kind !== "api") {
      return NextResponse.json(
        { success: false, error: "Tool no encontrada o no ejecutable por API" },
        { status: 404 },
      );
    }

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
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    if (usuarioError || !usuario || !usuario.activo) {
      return NextResponse.json(
        { success: false, error: "Usuario invalido o inactivo" },
        { status: 403 },
      );
    }

    if (!tool.roles.includes(usuario.rol)) {
      await writeAuditLog(supabase, {
        user_id: user.id,
        user_role: usuario.rol,
        tool_id: tool.id,
        tool_kind: tool.kind,
        risk: tool.risk,
        confirmation_mode: getWebMcpConfirmationMode(tool),
        confirmation_provided: (input.confirmed as boolean) === true,
        status: "blocked",
        endpoint: tool.endpoint,
        method: tool.method,
        request_input: input,
        http_status: 403,
        error_message: "Rol sin permisos para esta tool",
        duration_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { success: false, error: "Rol sin permisos para esta tool" },
        { status: 403 },
      );
    }

    const confirmationMode = getWebMcpConfirmationMode(tool);
    const confirmed = input.confirmed === true;
    const confirmationCode = typeof input.confirmationCode === "string" ? input.confirmationCode : "";
    const expectedCode = tool.confirmationCode || "CONFIRMAR";

    if (confirmationMode === "soft" && !confirmed) {
      await writeAuditLog(supabase, {
        user_id: user.id,
        user_role: usuario.rol,
        tool_id: tool.id,
        tool_kind: tool.kind,
        risk: tool.risk,
        confirmation_mode: confirmationMode,
        confirmation_provided: false,
        status: "blocked",
        endpoint: tool.endpoint,
        method: tool.method,
        request_input: input,
        http_status: 409,
        error_message: "Falta confirmacion soft",
        duration_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Esta accion requiere confirmacion explicita",
          requiresConfirmation: true,
          confirmationMode,
          challenge: "Establece `confirmed: true` para continuar.",
        },
        { status: 409 },
      );
    }

    if (confirmationMode === "hard" && (!confirmed || confirmationCode !== expectedCode)) {
      await writeAuditLog(supabase, {
        user_id: user.id,
        user_role: usuario.rol,
        tool_id: tool.id,
        tool_kind: tool.kind,
        risk: tool.risk,
        confirmation_mode: confirmationMode,
        confirmation_provided: confirmed,
        status: "blocked",
        endpoint: tool.endpoint,
        method: tool.method,
        request_input: input,
        http_status: 409,
        error_message: "Falta confirmacion hard o codigo invalido",
        duration_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Esta accion requiere confirmacion reforzada",
          requiresConfirmation: true,
          confirmationMode,
          challenge: `Establece \`confirmed: true\` y \`confirmationCode: "${expectedCode}"\`.`,
        },
        { status: 409 },
      );
    }

    const apiTool = tool as WebMcpApiTool;
    const path = extractPath(apiTool.endpoint, input);
    const url = new URL(path, request.nextUrl.origin);

    if (apiTool.method === "GET") {
      applyGetQuery(url, input);
    }

    const init = buildRequestInit(apiTool.method, input);
    const upstreamResponse = await fetch(url.toString(), {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    const upstreamJson = await upstreamResponse.json().catch(() => ({}));

    if (!upstreamResponse.ok) {
      await writeAuditLog(supabase, {
        user_id: user.id,
        user_role: usuario.rol,
        tool_id: tool.id,
        tool_kind: tool.kind,
        risk: tool.risk,
        confirmation_mode: confirmationMode,
        confirmation_provided: confirmed,
        status: "error",
        endpoint: apiTool.endpoint,
        method: apiTool.method,
        request_input: input,
        response_payload: upstreamJson,
        http_status: upstreamResponse.status,
        error_message: upstreamJson?.error || "Error ejecutando endpoint",
        duration_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          success: false,
          tool: tool.id,
          error: upstreamJson?.error || "Error ejecutando endpoint",
          upstreamStatus: upstreamResponse.status,
          upstream: upstreamJson,
        },
        { status: upstreamResponse.status },
      );
    }

    await writeAuditLog(supabase, {
      user_id: user.id,
      user_role: usuario.rol,
      tool_id: tool.id,
      tool_kind: tool.kind,
      risk: tool.risk,
      confirmation_mode: confirmationMode,
      confirmation_provided: confirmed,
      status: "success",
      endpoint: apiTool.endpoint,
      method: apiTool.method,
      request_input: input,
      response_payload: upstreamJson,
      http_status: upstreamResponse.status,
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      tool: tool.id,
      data: upstreamJson,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
