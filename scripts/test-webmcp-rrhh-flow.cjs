#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getTodayArgentinaISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getArgentinaMonthYear() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value || new Date().getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || new Date().getMonth() + 1);
  return { year, month };
}

async function callWebMcp(appUrl, cookieHeader, tool, input) {
  const response = await fetch(`${appUrl}/api/webmcp/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({ tool, input }),
  });

  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

function extractArray(result) {
  return Array.isArray(result?.json?.data?.data)
    ? result.json.data.data
    : Array.isArray(result?.json?.data)
      ? result.json.data
      : [];
}

function extractId(result, candidateKeys = []) {
  const stack = [result?.json];
  const visited = new Set();
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const key of candidateKeys) {
      const value = node[key];
      if (typeof value === "string" && value.length > 10) return value;
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return null;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const appUrl = process.env.WEBMCP_APP_URL || "http://localhost:3000";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.WEBMCP_TEST_EMAIL || "admin@avicoladelsur.com";
  const password = process.env.WEBMCP_TEST_PASSWORD || "123456";
  const startedAtIso = new Date().toISOString();
  const today = getTodayArgentinaISO();
  const { month, year } = getArgentinaMonthYear();

  if (!supabaseUrl || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para pruebas RRHH");
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const login = await authClient.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) {
    throw new Error(`No se pudo autenticar usuario de prueba: ${login.error?.message || "sin sesion"}`);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieHeader = `sb-${projectRef}-auth-token=base64-${base64UrlEncode(
    JSON.stringify(login.data.session),
  )}`;

  const toolsResponse = await fetch(`${appUrl}/api/webmcp/tools`, {
    headers: { cookie: cookieHeader },
  });
  const toolsJson = await toolsResponse.json().catch(() => ({}));
  const toolsData = Array.isArray(toolsJson?.data) ? toolsJson.data : [];
  const requiredTools = [
    "listar_empleados_rrhh_activos",
    "marcar_asistencia_rrhh",
    "crear_adelanto_rrhh",
    "aprobar_adelanto_rrhh",
    "rechazar_adelanto_rrhh",
    "calcular_liquidacion_rrhh",
    "aprobar_liquidacion_rrhh",
    "pagar_liquidacion_rrhh",
  ];
  const missingTools = requiredTools.filter(
    (toolId) => !toolsData.some((tool) => tool?.id === toolId),
  );

  const empleadosRes = await callWebMcp(appUrl, cookieHeader, "listar_empleados_rrhh_activos", {});
  const empleados = extractArray(empleadosRes);
  const empleado = empleados[0];
  if (!empleado?.id) throw new Error("No se encontro empleado activo para pruebas RRHH");

  const asistenciaRes = await callWebMcp(appUrl, cookieHeader, "marcar_asistencia_rrhh", {
    confirmed: true,
    body: {
      empleado_id: empleado.id,
      fecha: today,
      hora_entrada: `${today}T08:00:00-03:00`,
      turno: "mañana",
      estado: "presente",
      observaciones: `WebMCP RRHH ${startedAtIso}`,
    },
  });
  const asistenciaId = extractId(asistenciaRes, ["asistenciaId", "id"]);

  const adelantoCrearA = await callWebMcp(appUrl, cookieHeader, "crear_adelanto_rrhh", {
    confirmed: true,
    body: {
      empleado_id: empleado.id,
      tipo: "dinero",
      monto: 1,
      observaciones: `Adelanto aprobado WebMCP ${startedAtIso}`,
    },
  });
  const adelantoAId = extractId(adelantoCrearA, ["adelantoId", "id"]);

  const adelantoAprobar = adelantoAId
    ? await callWebMcp(appUrl, cookieHeader, "aprobar_adelanto_rrhh", {
        confirmed: true,
        pathParams: { id: adelantoAId },
      })
    : { ok: false, status: 0, json: { error: "No se pudo extraer adelanto A id" } };

  const adelantoCrearB = await callWebMcp(appUrl, cookieHeader, "crear_adelanto_rrhh", {
    confirmed: true,
    body: {
      empleado_id: empleado.id,
      tipo: "dinero",
      monto: 1,
      observaciones: `Adelanto rechazado WebMCP ${startedAtIso}`,
    },
  });
  const adelantoBId = extractId(adelantoCrearB, ["adelantoId", "id"]);

  const adelantoRechazar = adelantoBId
    ? await callWebMcp(appUrl, cookieHeader, "rechazar_adelanto_rrhh", {
        confirmed: true,
        pathParams: { id: adelantoBId },
      })
    : { ok: false, status: 0, json: { error: "No se pudo extraer adelanto B id" } };

  const liquidacionCalcular = await callWebMcp(appUrl, cookieHeader, "calcular_liquidacion_rrhh", {
    confirmed: true,
    confirmationCode: "CONFIRMAR",
    body: {
      empleado_id: empleado.id,
      mes: month,
      anio: year,
    },
  });

  let liquidacionId = extractId(liquidacionCalcular, ["liquidacionId", "id"]);
  if (!liquidacionId) {
    const { data: liquiExistente } = await adminClient
      .from("rrhh_liquidaciones")
      .select("id")
      .eq("empleado_id", empleado.id)
      .eq("periodo_mes", month)
      .eq("periodo_anio", year)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    liquidacionId = liquiExistente?.id || null;
  }

  const liquidacionAprobar = liquidacionId
    ? await callWebMcp(appUrl, cookieHeader, "aprobar_liquidacion_rrhh", {
        confirmed: true,
        confirmationCode: "CONFIRMAR",
        pathParams: { id: liquidacionId },
      })
    : { ok: false, status: 0, json: { error: "No se encontro liquidacion para aprobar" } };

  const liquidacionPagar = liquidacionId
    ? await callWebMcp(appUrl, cookieHeader, "pagar_liquidacion_rrhh", {
        confirmed: true,
        confirmationCode: "CONFIRMAR",
        pathParams: { id: liquidacionId },
      })
    : { ok: false, status: 0, json: { error: "No se encontro liquidacion para pagar" } };

  const { data: liquidacionFinal } = liquidacionId
    ? await adminClient
        .from("rrhh_liquidaciones")
        .select("id,estado,pagado,fecha_pago,periodo_mes,periodo_anio")
        .eq("id", liquidacionId)
        .maybeSingle()
    : { data: null };

  const summary = {
    timestamp: startedAtIso,
    appUrl,
    missingTools,
    fixture: {
      empleado_id: empleado.id,
      empleado_nombre: `${empleado.nombre || ""} ${empleado.apellido || ""}`.trim() || null,
      fecha_prueba: today,
      periodo: { mes: month, anio: year },
    },
    asistencia: {
      ok: asistenciaRes.ok,
      status: asistenciaRes.status,
      asistencia_id: asistenciaId,
      response: asistenciaRes.json,
    },
    adelantos: {
      crear_aprobar_ok: adelantoCrearA.ok,
      adelanto_aprobar_id: adelantoAId,
      aprobar_ok: adelantoAprobar.ok,
      response_aprobar: adelantoAprobar.json,
      crear_rechazar_ok: adelantoCrearB.ok,
      adelanto_rechazar_id: adelantoBId,
      rechazar_ok: adelantoRechazar.ok,
      response_rechazar: adelantoRechazar.json,
      response_crear_aprobar: adelantoCrearA.json,
      response_crear_rechazar: adelantoCrearB.json,
    },
    liquidacion: {
      calcular_ok: liquidacionCalcular.ok,
      liquidacion_id: liquidacionId,
      aprobar_ok: liquidacionAprobar.ok,
      pagar_ok: liquidacionPagar.ok,
      response_calcular: liquidacionCalcular.json,
      response_aprobar: liquidacionAprobar.json,
      response_pagar: liquidacionPagar.json,
      estado_final: liquidacionFinal?.estado || null,
      pagado_final: liquidacionFinal?.pagado || false,
      fecha_pago: liquidacionFinal?.fecha_pago || null,
    },
  };

  const liquidacionCalculoAceptable = liquidacionCalcular.ok || Boolean(liquidacionId);

  console.log(JSON.stringify(summary, null, 2));

  const failed =
    missingTools.length > 0 ||
    !empleado?.id ||
    !asistenciaRes.ok ||
    !adelantoCrearA.ok ||
    !adelantoAprobar.ok ||
    !adelantoCrearB.ok ||
    !adelantoRechazar.ok ||
    !liquidacionCalculoAceptable ||
    !liquidacionId ||
    !liquidacionAprobar.ok ||
    !liquidacionPagar.ok ||
    String(liquidacionFinal?.estado || "").toLowerCase() !== "pagada";

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error?.message || String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
