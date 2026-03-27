#!/usr/bin/env node

const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ARG_TZ = "America/Argentina/Buenos_Aires";
const MIDDAY_HORA_ARG = Number(process.env.HIK_SPLIT_TURNO_HORA || "14");
const HORA_LIMITE_ENTRADA = process.env.HORA_LIMITE_ENTRADA || "08:00";

function normalizeIdentity(v) {
  return String(v || "").replace(/[^0-9A-Za-z]+/g, "").toUpperCase();
}
function digitsOnly(v) {
  return String(v || "").replace(/\D+/g, "");
}
function buildPlaceholderLegajo(rawCode, attempt = 0) {
  const normalized = normalizeIdentity(rawCode) || `HIK${Date.now()}`
  return attempt <= 0 ? normalized : `${normalized}-${attempt + 1}`
}
function normalizeName(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9A-Za-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
function todayAR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ARG_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function toISO(ts) {
  if (typeof ts === "number" && Number.isFinite(ts)) return ts > 1e10 ? new Date(ts).toISOString() : new Date(ts * 1000).toISOString();
  const t = String(ts || "").trim();
  if (!t) return "";
  if (/^\d{13}$/.test(t)) return new Date(Number(t)).toISOString();
  if (/^\d{10}$/.test(t)) return new Date(Number(t) * 1000).toISOString();
  return t;
}
function hourAR(ts) {
  const d = new Date(toISO(ts));
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", { timeZone: ARG_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
function dateAR(ts) {
  const d = new Date(toISO(ts));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: ARG_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function parseArgs(argv) {
  const out = { from: "", to: "", apply: false, createPlaceholders: true, writeEnvMap: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--apply") out.apply = true;
    else if (a === "--no-create-placeholders") out.createPlaceholders = false;
    else if (a === "--write-env-map") out.writeEnvMap = true;
    else if (a.startsWith("--from=")) out.from = a.slice(7);
    else if (a === "--from" && argv[i + 1]) { out.from = argv[i + 1]; i += 1; }
    else if (a.startsWith("--to=")) out.to = a.slice(5);
    else if (a === "--to" && argv[i + 1]) { out.to = argv[i + 1]; i += 1; }
  }
  return out;
}
function parseMap(raw) {
  const map = new Map();
  for (const entry of String(raw || "").split(",").map((x) => x.trim()).filter(Boolean)) {
    const sep = entry.includes("=") ? "=" : entry.includes(":") ? ":" : "";
    if (!sep) continue;
    const [left, right] = entry.split(sep).map((x) => x.trim());
    if (!left || !right) continue;
    map.set(normalizeIdentity(left), right);
  }
  return map;
}
function getPersonCode(event) {
  const personInfo = event?.personInfo && typeof event.personInfo === "object" ? event.personInfo : {};
  const baseInfo = personInfo?.baseInfo && typeof personInfo.baseInfo === "object" ? personInfo.baseInfo : {};
  const direct =
    event.personCode || event.employeeNo || event.employee_id || personInfo.personCode || personInfo.employeeNo || baseInfo.personCode;
  return normalizeIdentity(direct || "");
}
function getPersonName(event) {
  const personInfo = event?.personInfo && typeof event.personInfo === "object" ? event.personInfo : {};
  const baseInfo = personInfo?.baseInfo && typeof personInfo.baseInfo === "object" ? personInfo.baseInfo : {};
  return String(event.personName || event.employeeName || personInfo.personName || baseInfo.personName || `${baseInfo.firstName || ""} ${baseInfo.lastName || ""}` || "").trim();
}
function parseTimestamp(event) {
  const keys = ["eventTime", "time", "timestamp", "punchTime", "occurTime", "authTime", "verifyTime", "eventDateTime", "captureTime", "localTime", "createdAt"];
  for (const k of keys) {
    const value = event[k];
    if ((typeof value === "string" && value.trim()) || (typeof value === "number" && Number.isFinite(value))) return toISO(value);
  }
  return "";
}
function splitTurnos(times) {
  const manana = [];
  const tarde = [];
  for (const t of times) {
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: ARG_TZ, hour: "numeric", hour12: false }).format(t));
    if (h < MIDDAY_HORA_ARG) manana.push(t); else tarde.push(t);
  }
  return { manana, tarde };
}
function calcEstado(horaEntrada) {
  if (!horaEntrada) return { estado: "presente", retraso_minutos: 0 };
  const [lh, lm] = HORA_LIMITE_ENTRADA.split(":").map(Number);
  const [eh, em] = horaEntrada.split(":").map(Number);
  if ([lh, lm, eh, em].some((v) => Number.isNaN(v))) return { estado: "presente", retraso_minutos: 0 };
  const diff = eh * 60 + em - (lh * 60 + lm);
  return diff > 0 ? { estado: "tarde", retraso_minutos: diff } : { estado: "presente", retraso_minutos: 0 };
}
function calcHoras(a, b) {
  if (!a || !b) return null;
  const s = new Date(a).getTime();
  const e = new Date(b).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.round(((e - s) / 3600000) * 100) / 100;
}

async function fetchHikEvents(date) {
  const base = String(process.env.HIK_CONNECT_BASE_URL || "").trim().replace(/\/$/, "");
  const tokenPath = process.env.HIK_CONNECT_TOKEN_PATH || "/api/hccgw/platform/v1/token/get";
  const eventsPath = process.env.HIK_CONNECT_EVENTS_PATH || "/api/hccgw/acs/v1/event/certificaterecords/search";
  const apiKey = String(process.env.HIK_CONNECT_API_KEY || "").trim();
  const apiSecret = String(process.env.HIK_CONNECT_API_SECRET || "").trim();
  const authMode = String(process.env.HIK_CONNECT_AUTH_MODE || "hcc_token").toLowerCase() === "bearer" ? "bearer" : "hcc_token";
  const maxPages = Math.min(Math.max(Number(process.env.HIK_CONNECT_MAX_PAGES || "50"), 1), 100);
  const pageSize = Math.min(Math.max(Number(process.env.HIK_CONNECT_PAGE_SIZE || "200"), 1), 200);
  const start = `${date}T00:00:00-03:00`;
  const end = `${date}T23:59:59-03:00`;

  const tokenBody = authMode === "hcc_token" ? { appKey: apiKey, secretKey: apiSecret } : { apiKey, apiSecret, grant_type: "client_credentials" };
  const tokenRes = await fetch(`${base}${tokenPath}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(tokenBody) });
  const tokenPayload = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}: ${JSON.stringify(tokenPayload)}`);
  const token = tokenPayload?.token || tokenPayload?.accessToken || tokenPayload?.access_token || tokenPayload?.data?.token || tokenPayload?.data?.accessToken || tokenPayload?.data?.access_token;
  if (!token) throw new Error("respuesta token sin access token");

  const authHeaders = authMode === "hcc_token" ? { token, appKey: apiKey } : { Authorization: `Bearer ${token}`, "x-api-key": apiKey };
  const events = [];
  let page = 1;
  let totalPages = 1;
  let stoppedByDate = false;

  while (page <= totalPages && page <= maxPages) {
    const body = authMode === "hcc_token"
      ? { beginTime: start, endTime: end, startTime: start, occurTimeBegin: start, occurTimeEnd: end, pageIndex: page, pageNo: page, pageSize }
      : { startTime: start, endTime: end, pageNo: page, pageSize };
    const res = await fetch(`${base}${eventsPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`events ${res.status}: ${JSON.stringify(payload)}`);
    const rows = payload?.data?.reportDataList || payload?.data?.recordList || payload?.data?.events || payload?.data?.list || payload?.events || payload?.list || [];
    if (Array.isArray(rows)) events.push(...rows.filter((x) => x && typeof x === "object"));

    let pageMaxDate = "";
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const ts = parseTimestamp(row);
        const d = ts ? dateAR(ts) : "";
        if (d && d > pageMaxDate) pageMaxDate = d;
      }
    }
    if (pageMaxDate && pageMaxDate < date) {
      stoppedByDate = true;
      break;
    }

    const total = Number(payload?.data?.totalNum || payload?.data?.total || payload?.totalNum || payload?.total || 0);
    totalPages = total > 0 ? Math.ceil(total / pageSize) : page;
    page += 1;
  }

  if (!stoppedByDate && page > maxPages) {
    console.warn(`[WARN] RRHH Hik backfill alcanzo el limite de ${maxPages} paginas para ${date}.`);
  }

  return events;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Uso: node scripts/rrhh-hik-backfill.js --from=YYYY-MM-DD [--to=YYYY-MM-DD] [--apply] [--no-create-placeholders] [--write-env-map]");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from || "")) throw new Error("Falta --from=YYYY-MM-DD");
  const to = args.to || todayAR();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Fecha --to invalida");

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "HIK_CONNECT_BASE_URL", "HIK_CONNECT_API_KEY", "HIK_CONNECT_API_SECRET"];
  const missing = required.filter((k) => !String(process.env[k] || "").trim());
  if (missing.length) throw new Error(`Faltan env: ${missing.join(", ")}`);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: empleados, error: empleadosError } = await supabase.from("rrhh_empleados").select("id,dni,cuil,legajo,nombre,apellido").eq("activo", true);
  if (empleadosError) throw new Error(`rrhh_empleados: ${empleadosError.message}`);

  const employeeById = new Map();
  const employeeMap = new Map();
  for (const e of empleados || []) {
    employeeById.set(e.id, e);
    for (const key of [e.dni, e.cuil, e.legajo, e.id].filter(Boolean).map((x) => normalizeIdentity(x))) {
      employeeMap.set(key, e);
      const d = digitsOnly(key);
      if (d) employeeMap.set(d, e);
    }
  }

  let mapHasTable = true;
  const configuredMap = new Map();
  const dbMap = await supabase.from("rrhh_hik_person_map").select("hik_code,empleado_id");
  if (dbMap.error) {
    const full = `${dbMap.error.message || ""} ${dbMap.error.details || ""}`.toLowerCase();
    if (dbMap.error.code === "42P01" || dbMap.error.code === "PGRST205" || full.includes("rrhh_hik_person_map")) mapHasTable = false;
    else throw new Error(`rrhh_hik_person_map: ${dbMap.error.message}`);
  } else {
    for (const row of dbMap.data || []) if (row.hik_code && row.empleado_id) configuredMap.set(normalizeIdentity(row.hik_code), String(row.empleado_id));
  }
  for (const [k, v] of parseMap(process.env.HIK_CONNECT_PERSON_MAP || "").entries()) configuredMap.set(k, v);
  for (const [hikCode, ref] of configuredMap.entries()) {
    const key = normalizeIdentity(ref);
    const d = digitsOnly(ref);
    const e = employeeById.get(ref) || employeeMap.get(key) || (d ? employeeMap.get(d) : undefined);
    if (e) { employeeMap.set(hikCode, e); const hd = digitsOnly(hikCode); if (hd) employeeMap.set(hd, e); }
  }

  const learnedMap = parseMap(process.env.HIK_CONNECT_PERSON_MAP || "");

  const summary = { from: args.from, to, apply: args.apply, processedDays: 0, rawEvents: 0, mappedRows: 0, unresolvedRows: 0, synced: 0, createdEmployees: 0 };
  const dates = [];
  for (let d = new Date(`${args.from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) dates.push(new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(d));

  console.log(`[INFO] RRHH Hik backfill ${args.apply ? "APPLY" : "DRY-RUN"} ${args.from} -> ${to}`);
  for (const date of dates) {
    summary.processedDays += 1;
    const raw = await fetchHikEvents(date);
    summary.rawEvents += raw.length;

    const grouped = new Map();
    for (const event of raw) {
      const code = getPersonCode(event);
      const ts = parseTimestamp(event);
      if (!code || !ts || dateAR(ts) !== date) continue;
      const key = `${code}`;
      const curr = grouped.get(key) || { code, name: getPersonName(event), times: [] };
      curr.times.push(ts);
      if (!curr.name) curr.name = getPersonName(event);
      grouped.set(key, curr);
    }

    const rows = [];
    for (const item of grouped.values()) {
      let employee = employeeMap.get(item.code) || employeeMap.get(digitsOnly(item.code));
      if (!employee && args.createPlaceholders && args.apply) {
        const parts = String(item.name || "").trim().split(/\s+/).filter(Boolean);
        const nombre = parts[0] || "Hik";
        const apellido = parts.slice(1).join(" ") || item.code;
        let legajoAttempt = 0;
        while (!employee) {
          const legajo = buildPlaceholderLegajo(item.code, legajoAttempt);
          legajoAttempt += 1;
          const insert = await supabase.from("rrhh_empleados").insert({ legajo, fecha_ingreso: todayAR(), activo: true, nombre, apellido }).select("id,dni,cuil,legajo,nombre,apellido").single();
          if (insert.error) {
            if (insert.error.code === "23505") continue;
            throw new Error(`No se pudo crear placeholder ${item.code}: ${insert.error.message}`);
          }
          employee = insert.data;
          summary.createdEmployees += 1;
        }
        if (mapHasTable) await supabase.from("rrhh_hik_person_map").upsert({ hik_code: item.code, empleado_id: employee.id, source: "auto_backfill", notes: "Placeholder autogenerado con legajo Hik" }, { onConflict: "hik_code" });
      }
      if (!employee) { summary.unresolvedRows += 1; continue; }
      learnedMap.set(item.code, String(employee.legajo || employee.id));

      employeeMap.set(item.code, employee);
      const d = digitsOnly(item.code);
      if (d) employeeMap.set(d, employee);

      const times = item.times.map((t) => new Date(toISO(t))).filter((x) => !Number.isNaN(x.getTime())).sort((a, b) => a.getTime() - b.getTime());
      if (!times.length) continue;
      const first = times[0];
      const last = times[times.length - 1];
      const { manana, tarde } = splitTurnos(times);
      const hIn = hourAR(first.toISOString());
      const hOut = first.getTime() !== last.getTime() ? hourAR(last.toISOString()) : null;
      const hInM = manana[0] ? hourAR(manana[0].toISOString()) : null;
      const hOutM = manana.length > 1 ? hourAR(manana[manana.length - 1].toISOString()) : null;
      const hInT = tarde[0] ? hourAR(tarde[0].toISOString()) : null;
      const hOutT = tarde.length > 1 ? hourAR(tarde[tarde.length - 1].toISOString()) : null;
      const entradaTs = hIn ? `${date}T${hIn}:00-03:00` : null;
      const salidaTs = hOut ? `${date}T${hOut}:00-03:00` : null;
      const entradaMTs = hInM ? `${date}T${hInM}:00-03:00` : null;
      const salidaMTs = hOutM ? `${date}T${hOutM}:00-03:00` : null;
      const entradaTTs = hInT ? `${date}T${hInT}:00-03:00` : null;
      const salidaTTs = hOutT ? `${date}T${hOutT}:00-03:00` : null;
      const turno = entradaMTs && salidaMTs && entradaTTs && salidaTTs ? "turno_completo" : entradaMTs && salidaMTs ? "medio_turno_manana" : entradaTTs && salidaTTs ? "medio_turno_tarde" : "general";
      const horas = entradaMTs && salidaMTs && entradaTTs && salidaTTs ? Math.round((((calcHoras(entradaMTs, salidaMTs) || 0) + (calcHoras(entradaTTs, salidaTTs) || 0)) * 100)) / 100 : calcHoras(entradaTs, salidaTs);
      const { estado, retraso_minutos } = calcEstado(hIn || "");
      rows.push({ empleado_id: employee.id, fecha: date, hora_entrada: entradaTs, hora_salida: salidaTs, horas_trabajadas: horas, turno, estado, retraso_minutos, observaciones: "Sincronizado desde HikConnect (backfill script)" });
    }

    summary.mappedRows += rows.length;
    if (args.apply && rows.length) {
      const ids = rows.map((r) => r.empleado_id);
      const existentes = await supabase.from("rrhh_asistencia").select("empleado_id,observaciones").in("empleado_id", ids).eq("fecha", date);
      const manuales = new Set((existentes.data || []).filter((x) => { const o = String(x.observaciones || "").toLowerCase(); return o && !o.includes("hikconnect") && !o.includes("hik-connect"); }).map((x) => x.empleado_id));
      for (const row of rows) {
        if (manuales.has(row.empleado_id)) continue;
        const up = await supabase.from("rrhh_asistencia").upsert(row, { onConflict: "empleado_id,fecha" });
        if (!up.error) summary.synced += 1;
      }
    }

    console.log(`[DAY] ${date} raw=${raw.length} grouped=${grouped.size} mapped=${rows.length}`);
  }

  if (!mapHasTable && learnedMap.size > 0) {
    const mapString = Array.from(learnedMap.entries()).map(([k, v]) => `${k}=${v}`).join(",");
    console.log("[WARN] rrhh_hik_person_map no existe. Usa este valor para HIK_CONNECT_PERSON_MAP:");
    console.log(`HIK_CONNECT_PERSON_MAP=${mapString}`);
    if (args.writeEnvMap) {
      const envPath = path.resolve(process.cwd(), ".env.local");
      const line = `HIK_CONNECT_PERSON_MAP=${mapString}`;
      if (require("fs").existsSync(envPath)) {
        const content = require("fs").readFileSync(envPath, "utf8");
        const updated = /(^|\r?\n)HIK_CONNECT_PERSON_MAP=.*/.test(content)
          ? content.replace(/(^|\r?\n)HIK_CONNECT_PERSON_MAP=.*/m, (m, p1) => `${p1}${line}`)
          : `${content.trimEnd()}\n${line}\n`;
        require("fs").writeFileSync(envPath, updated, "utf8");
        console.log("[INFO] .env.local actualizado con HIK_CONNECT_PERSON_MAP.");
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }, null, 2));
  process.exit(1);
});
