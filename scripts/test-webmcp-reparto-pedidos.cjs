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

function extractData(result) {
  return result?.json?.data?.data || result?.json?.data || {};
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

  if (!supabaseUrl || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para pruebas reparto");
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
    "crear_presupuesto",
    "facturar_presupuesto",
    "asignar_pedido_a_ruta_almacen",
    "consultar_rutas_activas",
    "generar_ruta_optimizada",
  ];
  const missingTools = requiredTools.filter(
    (toolId) => !toolsData.some((tool) => tool?.id === toolId),
  );

  const { data: cliente } = await adminClient
    .from("clientes")
    .select("id,zona_id")
    .limit(1)
    .maybeSingle();
  if (!cliente?.id) throw new Error("No se encontro cliente para prueba reparto");

  const { data: producto } = await adminClient
    .from("productos")
    .select("id,precio_venta")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();
  if (!producto?.id) throw new Error("No se encontro producto activo para prueba reparto");

  const createPresupuesto = await callWebMcp(appUrl, cookieHeader, "crear_presupuesto", {
    confirmed: true,
    body: {
      cliente_id: cliente.id,
      zona_id: cliente.zona_id || undefined,
      fecha_entrega_estimada: today,
      observaciones: `WebMCP reparto pedidos ${startedAtIso}`,
      tipo_venta: "reparto",
      items: [
        {
          producto_id: producto.id,
          cantidad_solicitada: 1,
          precio_unit_est: Number(producto.precio_venta || 1000),
        },
      ],
    },
  });

  const createData = extractData(createPresupuesto);
  const presupuestoId = createData?.presupuesto_id || createData?.id || null;

  const facturar = presupuestoId
    ? await callWebMcp(appUrl, cookieHeader, "facturar_presupuesto", {
        confirmed: true,
        confirmationCode: "CONFIRMAR",
        body: { presupuesto_id: presupuestoId },
      })
    : { ok: false, status: 0, json: { error: "No se pudo obtener presupuesto_id" } };

  const facturarData = extractData(facturar);
  const pedidoId = facturarData?.pedido_id || null;
  let rutaId = facturarData?.ruta_id || null;

  const asignarRuta = !rutaId && pedidoId
    ? await callWebMcp(appUrl, cookieHeader, "asignar_pedido_a_ruta_almacen", {
        confirmed: true,
        pathParams: { pedidoId },
      })
    : { ok: true, status: 200, json: { skipped: true } };

  if (!rutaId && pedidoId) {
    const asignarData = extractData(asignarRuta);
    rutaId = asignarData?.rutaId || asignarData?.ruta_id || null;
  }

  if (!rutaId && pedidoId) {
    const { data: detalleRuta } = await adminClient
      .from("detalles_ruta")
      .select("ruta_id")
      .eq("pedido_id", pedidoId)
      .limit(1)
      .maybeSingle();
    rutaId = detalleRuta?.ruta_id || null;
  }

  const consultarRutas = await callWebMcp(appUrl, cookieHeader, "consultar_rutas_activas", {
    query: { fecha: today },
  });
  const rutas = Array.isArray(consultarRutas?.json?.data?.data)
    ? consultarRutas.json.data.data
    : [];
  const rutaEncontrada = rutaId ? rutas.some((ruta) => ruta?.id === rutaId) : false;

  const optimizarRuta = rutaId
    ? await callWebMcp(appUrl, cookieHeader, "generar_ruta_optimizada", {
        confirmed: true,
        body: { rutaId, usarGoogle: true },
      })
    : { ok: false, status: 0, json: { error: "No hay rutaId para optimizar" } };

  const summary = {
    timestamp: startedAtIso,
    appUrl,
    missingTools,
    fixtures: {
      cliente_id: cliente.id,
      producto_id: producto.id,
      fecha_prueba: today,
    },
    presupuesto: {
      ok: createPresupuesto.ok,
      status: createPresupuesto.status,
      presupuesto_id: presupuestoId,
    },
    facturacion: {
      ok: facturar.ok,
      status: facturar.status,
      pedido_id: pedidoId,
      ruta_id: rutaId,
      response: facturar.json,
    },
    asignacion_pedido_ruta: {
      ok: asignarRuta.ok,
      status: asignarRuta.status,
      response: asignarRuta.json,
    },
    rutas_activas: {
      ok: consultarRutas.ok,
      status: consultarRutas.status,
      total: rutas.length,
      ruta_del_pedido_encontrada: rutaEncontrada,
    },
    optimizacion_ruta: {
      ok: optimizarRuta.ok,
      status: optimizarRuta.status,
      response: optimizarRuta.json,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const failed =
    missingTools.length > 0 ||
    !createPresupuesto.ok ||
    !presupuestoId ||
    !facturar.ok ||
    !pedidoId ||
    !rutaId ||
    !consultarRutas.ok ||
    !rutaEncontrada;

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
