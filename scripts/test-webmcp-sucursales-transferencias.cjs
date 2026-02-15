#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const CENTRAL_ID = "00000000-0000-0000-0000-000000000001";

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

function getDataArray(result) {
  return Array.isArray(result?.json?.data?.data)
    ? result.json.data.data
    : Array.isArray(result?.json?.data)
      ? result.json.data
      : [];
}

function getTransferEstado(result) {
  return (
    result?.json?.data?.data?.estado ||
    result?.json?.data?.estado ||
    result?.json?.estado ||
    null
  );
}

function getTransferItems(result) {
  const data = result?.json?.data?.data || result?.json?.data || {};
  return Array.isArray(data?.items) ? data.items : [];
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

  if (!supabaseUrl || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para pruebas E2E completas");
  }

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
    "ejecutar_stock_bajo_sucursales",
    "listar_solicitudes_automaticas_transferencia",
    "aprobar_solicitud_automatica_transferencia",
    "obtener_transferencia_stock",
    "preparar_transferencia_stock",
    "asignar_transferencia_ruta",
    "marcar_transferencia_entregada",
    "confirmar_recepcion_transferencia",
    "listar_transferencias_stock",
  ];
  const missingTools = requiredTools.filter(
    (toolId) => !toolsData.some((tool) => tool?.id === toolId),
  );

  const { data: sucursales, error: sucursalesError } = await adminClient
    .from("sucursales")
    .select("id,nombre")
    .eq("active", true)
    .neq("id", CENTRAL_ID)
    .limit(1);
  if (sucursalesError || !sucursales?.[0]) {
    throw new Error(`No se encontro sucursal destino activa: ${sucursalesError?.message || ""}`);
  }
  const sucursalDestino = sucursales[0];

  const { data: candidateLotes, error: lotesError } = await adminClient
    .from("lotes")
    .select("id,producto_id,sucursal_id,cantidad_disponible,estado")
    .eq("sucursal_id", sucursalDestino.id)
    .eq("estado", "disponible")
    .gt("cantidad_disponible", 0)
    .limit(30);
  if (lotesError) {
    throw new Error(`Error consultando lotes destino: ${lotesError.message}`);
  }

  let productoId = null;
  let loteDestino = null;

  for (const lote of candidateLotes || []) {
    const { data: lotesCentral } = await adminClient
      .from("lotes")
      .select("id,cantidad_disponible")
      .eq("sucursal_id", CENTRAL_ID)
      .eq("producto_id", lote.producto_id)
      .eq("estado", "disponible")
      .gt("cantidad_disponible", 0)
      .limit(1);
    if (lotesCentral?.[0]) {
      productoId = lote.producto_id;
      loteDestino = lote;
      break;
    }
  }

  if (!productoId) {
    const { data: centralLote } = await adminClient
      .from("lotes")
      .select("producto_id")
      .eq("sucursal_id", CENTRAL_ID)
      .eq("estado", "disponible")
      .gt("cantidad_disponible", 0)
      .limit(1)
      .maybeSingle();
    if (!centralLote?.producto_id) {
      throw new Error("No se encontro producto con stock en central para pruebas");
    }
    productoId = centralLote.producto_id;
  }

  const { data: stockDestinoRows } = await adminClient
    .from("lotes")
    .select("cantidad_disponible")
    .eq("sucursal_id", sucursalDestino.id)
    .eq("producto_id", productoId)
    .eq("estado", "disponible");
  const stockDestinoInicial = (stockDestinoRows || []).reduce(
    (sum, row) => sum + Number(row.cantidad_disponible || 0),
    0,
  );
  const umbralObjetivo = Math.max(stockDestinoInicial + 2, 2);

  const { error: upsertMinimoError } = await adminClient
    .from("producto_sucursal_minimos")
    .upsert(
      {
        sucursal_id: sucursalDestino.id,
        producto_id: productoId,
        stock_minimo: umbralObjetivo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sucursal_id,producto_id" },
    );
  if (upsertMinimoError) {
    throw new Error(`No se pudo configurar umbral por sucursal: ${upsertMinimoError.message}`);
  }

  const lowStockRun1 = await callWebMcp(appUrl, cookieHeader, "ejecutar_stock_bajo_sucursales", {
    confirmed: true,
    body: {
      sucursal_id: sucursalDestino.id,
      producto_id: productoId,
    },
  });

  const solicitudes1 = await callWebMcp(
    appUrl,
    cookieHeader,
    "listar_solicitudes_automaticas_transferencia",
    {},
  );
  const solicitudesData1 = getDataArray(solicitudes1);
  const solicitudObjetivo1 = solicitudesData1.find((solicitud) => {
    if (solicitud?.sucursal_destino_id !== sucursalDestino.id) return false;
    const items = Array.isArray(solicitud?.items) ? solicitud.items : [];
    return items.some((item) => item?.producto?.id === productoId || item?.producto_id === productoId);
  });

  const transferenciaId = solicitudObjetivo1?.id || null;
  const itemObjetivo1 = Array.isArray(solicitudObjetivo1?.items)
    ? solicitudObjetivo1.items.find(
        (item) => item?.producto?.id === productoId || item?.producto_id === productoId,
      )
    : null;
  const cantidadAntes = Number(itemObjetivo1?.cantidad_solicitada || 0);

  let ventaSimuladaAplicada = false;
  if (loteDestino?.id && Number(loteDestino.cantidad_disponible || 0) > 0) {
    const nuevoStockLote = Math.max(0, Number(loteDestino.cantidad_disponible) - 1);
    const { error: updateLoteError } = await adminClient
      .from("lotes")
      .update({
        cantidad_disponible: nuevoStockLote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loteDestino.id);
    if (!updateLoteError) {
      ventaSimuladaAplicada = true;
    }
  }

  const lowStockRun2 = await callWebMcp(appUrl, cookieHeader, "ejecutar_stock_bajo_sucursales", {
    confirmed: true,
    body: {
      sucursal_id: sucursalDestino.id,
      producto_id: productoId,
    },
  });

  const solicitudes2 = await callWebMcp(
    appUrl,
    cookieHeader,
    "listar_solicitudes_automaticas_transferencia",
    {},
  );
  const solicitudesData2 = getDataArray(solicitudes2);
  const solicitudObjetivo2 = solicitudesData2.find((solicitud) => solicitud?.id === transferenciaId);
  const itemObjetivo2 = Array.isArray(solicitudObjetivo2?.items)
    ? solicitudObjetivo2.items.find(
        (item) => item?.producto?.id === productoId || item?.producto_id === productoId,
      )
    : null;
  const cantidadDespues = Number(itemObjetivo2?.cantidad_solicitada || 0);

  const aprobarSolicitud = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "aprobar_solicitud_automatica_transferencia", {
        confirmed: true,
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: { error: "No se encontro transferencia automatica" } };

  const detallePostAprobacion = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "obtener_transferencia_stock", {
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const preparar = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "preparar_transferencia_stock", {
        confirmed: true,
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const asignarRuta = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "asignar_transferencia_ruta", {
        confirmed: true,
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const detalleEnRuta = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "obtener_transferencia_stock", {
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const marcarEntregada = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "marcar_transferencia_entregada", {
        confirmed: true,
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const confirmarRecepcion = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "confirmar_recepcion_transferencia", {
        confirmed: true,
        confirmationCode: "CONFIRMAR",
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const detalleFinal = transferenciaId
    ? await callWebMcp(appUrl, cookieHeader, "obtener_transferencia_stock", {
        pathParams: { transferenciaId },
      })
    : { ok: false, status: 0, json: {} };

  const estadoFinal = getTransferEstado(detalleFinal);
  const estadoAprobacion = getTransferEstado(detallePostAprobacion);
  const estadoEnRuta = getTransferEstado(detalleEnRuta);

  const listaEnAlmacen = await callWebMcp(appUrl, cookieHeader, "listar_transferencias_stock", {
    query: { estado: "en_almacen" },
  });

  const resumen = {
    timestamp: startedAtIso,
    appUrl,
    missingTools,
    fixtures: {
      sucursal_destino_id: sucursalDestino.id,
      sucursal_destino_nombre: sucursalDestino.nombre,
      producto_id: productoId,
      stock_destino_inicial: stockDestinoInicial,
      umbral_configurado: umbralObjetivo,
      venta_simulada_aplicada: ventaSimuladaAplicada,
    },
    stock_bajo_run_1: {
      ok: lowStockRun1.ok,
      status: lowStockRun1.status,
      data: lowStockRun1.json?.data || null,
    },
    solicitud_automatica: {
      transferencia_id: transferenciaId,
      cantidad_inicial: cantidadAntes,
      cantidad_despues_reevaluacion: cantidadDespues,
      cantidad_actualizada: cantidadDespues > 0 && cantidadDespues !== cantidadAntes,
      total_solicitudes_automaticas: solicitudesData2.length,
    },
    flujo_transferencia: {
      aprobar_ok: aprobarSolicitud.ok,
      estado_post_aprobacion: estadoAprobacion,
      preparar_ok: preparar.ok,
      asignar_ruta_ok: asignarRuta.ok,
      estado_en_ruta: estadoEnRuta,
      marcar_entregada_ok: marcarEntregada.ok,
      confirmar_recepcion_ok: confirmarRecepcion.ok,
      estado_final: estadoFinal,
    },
    lista_transferencias_en_almacen: {
      ok: listaEnAlmacen.ok,
      status: listaEnAlmacen.status,
      total: getDataArray(listaEnAlmacen).length,
    },
    responses: {
      aprobar: aprobarSolicitud.json,
      preparar: preparar.json,
      asignar_ruta: asignarRuta.json,
      marcar_entregada: marcarEntregada.json,
      confirmar_recepcion: confirmarRecepcion.json,
      detalle_final_items: getTransferItems(detalleFinal),
      low_stock_run_2: lowStockRun2.json,
    },
  };

  console.log(JSON.stringify(resumen, null, 2));

  const finalEstadoValido = ["recibido", "recibida"].includes(String(estadoFinal || "").toLowerCase());

  const failed =
    missingTools.length > 0 ||
    !transferenciaId ||
    !aprobarSolicitud.ok ||
    String(estadoAprobacion || "").toLowerCase() !== "en_almacen" ||
    !preparar.ok ||
    !asignarRuta.ok ||
    !marcarEntregada.ok ||
    !confirmarRecepcion.ok ||
    !finalEstadoValido;

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
