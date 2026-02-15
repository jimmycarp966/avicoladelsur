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

function getArgentinaDateISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function extractPresupuestoId(payload) {
  return (
    payload?.data?.data?.presupuesto_id ||
    payload?.data?.presupuesto_id ||
    payload?.presupuesto_id ||
    null
  );
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

async function getFirstRow(client, table, columns, configure) {
  let query = client.from(table).select(columns).limit(1);
  if (configure) query = configure(query);
  const { data, error } = await query;
  if (error) throw new Error(`Error consultando ${table}: ${error.message}`);
  return data?.[0] || null;
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
  const today = getArgentinaDateISO();
  const nowTag = new Date().toISOString();

  if (!supabaseUrl || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const login = await authClient.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) {
    throw new Error(`No se pudo autenticar usuario de prueba: ${login.error?.message || "sin sesion"}`);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const sessionRaw = JSON.stringify(login.data.session);
  const sessionCookieValue = `base64-${base64UrlEncode(sessionRaw)}`;
  const cookieHeader = `${storageKey}=${sessionCookieValue}`;

  const fixtureClient =
    serviceRoleKey && serviceRoleKey.length > 20
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : authClient;

  const [cliente, producto] = await Promise.all([
    getFirstRow(fixtureClient, "clientes", "id,nombre"),
    getFirstRow(
      fixtureClient,
      "productos",
      "id,nombre,precio_venta,activo",
      (q) => q.eq("activo", true).order("nombre", { ascending: true }),
    ),
  ]);

  if (!cliente?.id) throw new Error("No se encontro cliente para prueba");
  if (!producto?.id) throw new Error("No se encontro producto activo para prueba");

  let zona = null;
  let listaPrecio = null;
  try {
    zona = await getFirstRow(fixtureClient, "zonas", "id,nombre");
  } catch (_error) {
    zona = null;
  }
  try {
    listaPrecio = await getFirstRow(
      fixtureClient,
      "listas_precios",
      "id,nombre,activo",
      (q) => q.eq("activo", true).order("nombre", { ascending: true }),
    );
  } catch (_error) {
    listaPrecio = null;
  }

  const toolsResponse = await fetch(`${appUrl}/api/webmcp/tools`, {
    headers: { cookie: cookieHeader },
  });
  const toolsJson = await toolsResponse.json().catch(() => ({}));
  const toolsData = Array.isArray(toolsJson?.data) ? toolsJson.data : [];
  const requiredTools = [
    "crear_presupuesto",
    "listar_presupuestos",
    "obtener_presupuesto",
    "enviar_presupuesto_a_almacen",
    "listar_presupuestos_dia",
  ];
  const missingTools = requiredTools.filter(
    (toolId) => !toolsData.some((tool) => tool?.id === toolId),
  );

  const createInput = {
    confirmed: true,
    body: {
      cliente_id: cliente.id,
      fecha_entrega_estimada: today,
      observaciones: `WebMCP test ${nowTag}`,
      tipo_venta: "reparto",
      ...(zona?.id ? { zona_id: zona.id } : {}),
      ...(listaPrecio?.id ? { lista_precio_id: listaPrecio.id } : {}),
      items: [
        {
          producto_id: producto.id,
          cantidad_solicitada: 1,
          precio_unit_est: Number(producto.precio_venta) > 0 ? Number(producto.precio_venta) : 1000,
          ...(listaPrecio?.id ? { lista_precio_id: listaPrecio.id } : {}),
        },
      ],
    },
  };

  const createResult = await callWebMcp(appUrl, cookieHeader, "crear_presupuesto", createInput);
  const presupuestoId = extractPresupuestoId(createResult.json);

  const detailResult = presupuestoId
    ? await callWebMcp(appUrl, cookieHeader, "obtener_presupuesto", {
        pathParams: { id: presupuestoId },
      })
    : { ok: false, status: 0, json: { error: "Sin presupuesto_id" } };

  const createdEstado =
    detailResult.json?.data?.data?.estado ||
    detailResult.json?.data?.estado ||
    null;

  const listResult = await callWebMcp(appUrl, cookieHeader, "listar_presupuestos", {
    query: { fecha_desde: today, fecha_hasta: today },
  });
  const listItems = Array.isArray(listResult.json?.data?.data) ? listResult.json.data.data : [];
  const appearsInList = presupuestoId
    ? listItems.some((item) => item?.id === presupuestoId)
    : false;

  const sendResult = presupuestoId
    ? await callWebMcp(appUrl, cookieHeader, "enviar_presupuesto_a_almacen", {
        confirmed: true,
        body: { presupuesto_id: presupuestoId },
      })
    : { ok: false, status: 0, json: { error: "Sin presupuesto_id" } };

  const sendErrorMessage =
    sendResult.json?.error ||
    sendResult.json?.upstream?.error ||
    sendResult.json?.upstream?.message ||
    sendResult.json?.data?.error ||
    sendResult.json?.data?.message ||
    null;
  const sendBlockedBecauseAlreadyInAlmacen =
    createdEstado === "en_almacen" &&
    !sendResult.ok &&
    /pendiente/i.test(String(sendErrorMessage || ""));
  const sendValidationPassed =
    createdEstado === "pendiente"
      ? sendResult.ok
      : createdEstado === "en_almacen"
        ? sendBlockedBecauseAlreadyInAlmacen
        : sendResult.ok;

  const dayResult = await callWebMcp(appUrl, cookieHeader, "listar_presupuestos_dia", {
    query: { fecha: today },
  });
  const dayItems = Array.isArray(dayResult.json?.data?.data) ? dayResult.json.data.data : [];
  const appearsInDay = presupuestoId
    ? dayItems.some((item) => item?.id === presupuestoId)
    : false;

  const summary = {
    timestamp: nowTag,
    appUrl,
    role: toolsJson?.role || null,
    toolsEndpointOk: toolsResponse.ok,
    toolsTotal: toolsJson?.total || toolsData.length || 0,
    missingTools,
    fixtures: {
      cliente_id: cliente.id,
      producto_id: producto.id,
      zona_id: zona?.id || null,
      lista_precio_id: listaPrecio?.id || null,
      fecha_prueba: today,
    },
    create_presupuesto: {
      ok: createResult.ok,
      status: createResult.status,
      presupuesto_id: presupuestoId,
      error: createResult.json?.error || createResult.json?.data?.error || null,
    },
    obtener_presupuesto: {
      ok: detailResult.ok,
      status: detailResult.status,
      estado: createdEstado,
    },
    listar_presupuestos: {
      ok: listResult.ok,
      status: listResult.status,
      found_created_presupuesto: appearsInList,
      total: listItems.length,
    },
    enviar_presupuesto_a_almacen: {
      ok: sendResult.ok,
      status: sendResult.status,
      validation_passed: sendValidationPassed,
      blocked_because_already_in_almacen: sendBlockedBecauseAlreadyInAlmacen,
      error: sendErrorMessage,
    },
    listar_presupuestos_dia: {
      ok: dayResult.ok,
      status: dayResult.status,
      found_created_presupuesto: appearsInDay,
      total: dayItems.length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const failed =
    missingTools.length > 0 ||
    !createResult.ok ||
    !presupuestoId ||
    !listResult.ok ||
    !appearsInList ||
    !sendValidationPassed ||
    !dayResult.ok ||
    !appearsInDay;

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
