import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Edit } from "lucide-react"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import type { Empleado } from "@/types/domain.types"

interface PageProps {
  params: Promise<{ id: string }>
}

type LegajoEvento = {
  id: string
  tipo: string
  categoria: string
  titulo: string
  descripcion?: string | null
  fecha_evento?: string | null
  metadata?: Record<string, unknown> | null
}

type AdelantoLegajo = {
  id: string
  tipo?: string | null
  monto?: number | null
  cantidad?: number | null
  precio_unitario?: number | null
  fecha_solicitud?: string | null
  fecha_aprobacion?: string | null
  aprobado?: boolean | null
  observaciones?: string | null
  plan?: { cantidad_cuotas?: number | null; estado?: string | null } | null
  producto?: { codigo?: string | null; nombre?: string | null } | null
}

type LicenciaLegajo = {
  id: string
  tipo?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  fecha_presentacion_certificado?: string | null
  estado_revision?: string | null
  aprobado?: boolean | null
  dias_total?: number | null
}

type EvaluacionLegajo = {
  id: string
  periodo_mes?: number | null
  periodo_anio?: number | null
  promedio?: number | null
  estado?: string | null
  fecha_evaluacion?: string | null
  evaluador?: { nombre?: string | null; apellido?: string | null } | null
}

type LiquidacionLegajo = {
  id: string
  periodo_mes?: number | null
  periodo_anio?: number | null
  total_neto?: number | null
  estado?: string | null
  pago_autorizado?: boolean | null
  pagado?: boolean | null
}

type TimelineItem = {
  key: string
  fecha: string
  categoria: "legajo" | "adelanto" | "licencia" | "evaluacion"
  titulo: string
  descripcion?: string
}

function formatMoney(value?: number | null) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function parseCuotasFromObservaciones(observaciones?: string | null): number | null {
  if (!observaciones) return null
  const match = observaciones.match(/cuotas solicitadas:\s*(\d+)/i)
  return match?.[1] ? Number(match[1]) : null
}

async function getDbForCurrentUser() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { db: supabase, isAdmin: false }
  }

  const { data: userData } = await supabase
    .from("usuarios")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === "admin"
  return { db: isAdmin ? adminSupabase : supabase, isAdmin }
}

async function getEmpleadoLegajoData(empleadoId: string) {
  const { db } = await getDbForCurrentUser()

  const { data: empleado, error: empleadoError } = await db
    .from("rrhh_empleados")
    .select(`
      *,
      usuario:usuarios(id, nombre, apellido, email),
      sucursal:sucursales(id, nombre),
      categoria:rrhh_categorias(id, nombre, sueldo_basico)
    `)
    .eq("id", empleadoId)
    .maybeSingle()

  if (empleadoError || !empleado) {
    return null
  }

  const [
    eventosResult,
    adelantosResult,
    licenciasResult,
    evaluacionesResult,
    liquidacionesResult,
  ] = await Promise.all([
    db
      .from("rrhh_legajo_eventos")
      .select("id, tipo, categoria, titulo, descripcion, fecha_evento, metadata")
      .eq("empleado_id", empleadoId)
      .order("fecha_evento", { ascending: false })
      .limit(200),
    db
      .from("rrhh_adelantos")
      .select(`
        id,
        tipo,
        monto,
        cantidad,
        precio_unitario,
        fecha_solicitud,
        fecha_aprobacion,
        aprobado,
        observaciones,
        producto:productos(codigo, nombre),
        plan:rrhh_adelanto_planes(cantidad_cuotas, estado)
      `)
      .eq("empleado_id", empleadoId)
      .order("fecha_solicitud", { ascending: false })
      .limit(50),
    db
      .from("rrhh_licencias")
      .select(
        "id, tipo, fecha_inicio, fecha_fin, fecha_presentacion_certificado, estado_revision, aprobado, dias_total",
      )
      .eq("empleado_id", empleadoId)
      .order("fecha_inicio", { ascending: false })
      .limit(50),
    db
      .from("rrhh_evaluaciones")
      .select(
        "id, periodo_mes, periodo_anio, promedio, estado, fecha_evaluacion, evaluador:usuarios(nombre, apellido)",
      )
      .eq("empleado_id", empleadoId)
      .order("fecha_evaluacion", { ascending: false })
      .limit(50),
    db
      .from("rrhh_liquidaciones")
      .select("id, periodo_mes, periodo_anio, total_neto, estado, pago_autorizado, pagado")
      .eq("empleado_id", empleadoId)
      .order("periodo_anio", { ascending: false })
      .order("periodo_mes", { ascending: false })
      .limit(24),
  ])

  const eventosError = eventosResult.error
  if (eventosError && eventosError.code !== "42P01") {
    console.error("Error loading rrhh_legajo_eventos:", eventosError)
  }

  const eventos = eventosError?.code === "42P01" ? [] : (eventosResult.data || [])

  return {
    empleado: empleado as Empleado,
    eventos: (eventos || []) as LegajoEvento[],
    adelantos: (adelantosResult.data || []) as AdelantoLegajo[],
    licencias: (licenciasResult.data || []) as LicenciaLegajo[],
    evaluaciones: (evaluacionesResult.data || []) as EvaluacionLegajo[],
    liquidaciones: (liquidacionesResult.data || []) as LiquidacionLegajo[],
  }
}

export default async function EmpleadoLegajoPage({ params }: PageProps) {
  const { id } = await params
  const data = await getEmpleadoLegajoData(id)

  if (!data) {
    notFound()
  }

  const { empleado, eventos, adelantos, licencias, evaluaciones, liquidaciones } = data
  const nombreCompleto =
    `${empleado.usuario?.nombre || empleado.nombre || ""} ${empleado.usuario?.apellido || empleado.apellido || ""}`.trim() ||
    "Sin nombre"

  const timeline: TimelineItem[] = [
    ...eventos.map((evento) => ({
      key: `evento-${evento.id}`,
      fecha: evento.fecha_evento || "",
      categoria: "legajo" as const,
      titulo: evento.titulo || "Evento RRHH",
      descripcion: evento.descripcion || `${evento.tipo} (${evento.categoria})`,
    })),
    ...adelantos.map((adelanto) => ({
      key: `adelanto-${adelanto.id}`,
      fecha: adelanto.fecha_aprobacion || adelanto.fecha_solicitud || "",
      categoria: "adelanto" as const,
      titulo: adelanto.aprobado ? "Adelanto aprobado" : "Adelanto solicitado",
      descripcion:
        adelanto.tipo === "dinero"
          ? `${formatMoney(adelanto.monto)}`
          : `${adelanto.producto?.nombre || "Producto"} (${Number(adelanto.cantidad || 0)} u.)`,
    })),
    ...licencias.map((licencia) => ({
      key: `licencia-${licencia.id}`,
      fecha: licencia.fecha_presentacion_certificado || licencia.fecha_inicio || "",
      categoria: "licencia" as const,
      titulo: licencia.aprobado ? "Licencia aprobada" : "Licencia registrada",
      descripcion: `${licencia.tipo || "licencia"} (${licencia.fecha_inicio || "-"} a ${licencia.fecha_fin || "-"})`,
    })),
    ...evaluaciones.map((evaluacion) => ({
      key: `evaluacion-${evaluacion.id}`,
      fecha: evaluacion.fecha_evaluacion || "",
      categoria: "evaluacion" as const,
      titulo: "Evaluacion de desempeno",
      descripcion: `Periodo ${evaluacion.periodo_mes || "-"} / ${evaluacion.periodo_anio || "-"}`,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rrhh/empleados">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Legajo de {nombreCompleto}</h1>
            <p className="text-gray-600 mt-1">
              {empleado.legajo ? `Legajo ${empleado.legajo}` : "Sin legajo"}
              {empleado.usuario?.email ? ` • ${empleado.usuario.email}` : ""}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/rrhh/empleados/${id}/editar`}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sucursal</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {empleado.sucursal?.nombre || "Sin asignar"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {empleado.categoria?.nombre || "Sin asignar"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sueldo actual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-green-700">{formatMoney(empleado.sueldo_actual)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial RRHH (Legajo)</CardTitle>
          <CardDescription>Timeline unificado de eventos, licencias, adelantos y evaluaciones</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos para este legajo.</p>
          ) : (
            <div className="space-y-3">
              {timeline.slice(0, 120).map((item) => (
                <div key={item.key} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {item.categoria}
                      </Badge>
                      <p className="font-medium">{item.titulo}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.fecha)}</p>
                  </div>
                  {item.descripcion && <p className="text-sm text-muted-foreground mt-1">{item.descripcion}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Adelantos</CardTitle>
          </CardHeader>
          <CardContent>
            {adelantos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin adelantos registrados.</p>
            ) : (
              <div className="space-y-2">
                {adelantos.map((adelanto) => {
                  const cuotas = adelanto.plan?.cantidad_cuotas || parseCuotasFromObservaciones(adelanto.observaciones) || 1
                  const valor =
                    adelanto.tipo === "dinero"
                      ? formatMoney(adelanto.monto)
                      : `${formatMoney((adelanto.cantidad || 0) * (adelanto.precio_unitario || 0))} (${adelanto.producto?.nombre || "Producto"})`
                  return (
                    <div key={adelanto.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{adelanto.aprobado ? "Aprobado" : "Pendiente"}</p>
                        <Badge variant={adelanto.aprobado ? "default" : "secondary"}>
                          {adelanto.aprobado ? "Aprobado" : "Pendiente"}
                        </Badge>
                      </div>
                      <p className="text-sm">{valor}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(adelanto.fecha_aprobacion || adelanto.fecha_solicitud)} • {cuotas} cuota(s)
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Licencias</CardTitle>
          </CardHeader>
          <CardContent>
            {licencias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin licencias registradas.</p>
            ) : (
              <div className="space-y-2">
                {licencias.map((licencia) => (
                  <div key={licencia.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium capitalize">{licencia.tipo || "Licencia"}</p>
                      <Badge variant={licencia.aprobado ? "default" : "secondary"}>
                        {licencia.aprobado ? "Aprobada" : licencia.estado_revision || "Pendiente"}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      {formatDate(licencia.fecha_inicio || "")} a {formatDate(licencia.fecha_fin || "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Presentacion: {licencia.tipo === "vacaciones" ? "No aplica" : formatDateTime(licencia.fecha_presentacion_certificado)} • {licencia.dias_total || 0} dia(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {evaluaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin evaluaciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {evaluaciones.map((evaluacion) => (
                  <div key={evaluacion.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        Periodo {evaluacion.periodo_mes || "-"} / {evaluacion.periodo_anio || "-"}
                      </p>
                      <Badge variant="outline">{evaluacion.estado || "borrador"}</Badge>
                    </div>
                    <p className="text-sm">Promedio: {Number(evaluacion.promedio || 0).toFixed(1)} / 5</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(evaluacion.fecha_evaluacion || "")} • Evaluador:{" "}
                      {`${evaluacion.evaluador?.nombre || ""} ${evaluacion.evaluador?.apellido || ""}`.trim() || "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liquidaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {liquidaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin liquidaciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {liquidaciones.map((liq) => (
                  <div key={liq.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {liq.periodo_mes}/{liq.periodo_anio}
                      </p>
                      <Badge variant="outline">{liq.estado || "borrador"}</Badge>
                    </div>
                    <p className="text-sm">Neto: {formatMoney(liq.total_neto)}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {liq.pago_autorizado ? "Pago autorizado" : "Pago pendiente de autorizacion"}
                      </p>
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <Link href={`/rrhh/liquidaciones/${liq.id}`}>Ver detalle</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const dynamic = "force-dynamic"
