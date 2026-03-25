import Link from "next/link"
import { notFound } from "next/navigation"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { buildDisciplinaDescripcion, getDisciplinaEtapaLabel, parseLegajoDisciplinaMetadata } from "@/lib/utils/rrhh-disciplinario"
import { PrintButton } from "./print-button"

type PageProps = {
  params: Promise<{ id: string; eventoId: string }>
}

async function getDbForCurrentUser() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return supabase
  }

  const { data: userData } = await supabase
    .from("usuarios")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle()

  return !!userData?.activo && userData.rol === "admin" ? adminSupabase : supabase
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  })
}

export const dynamic = "force-dynamic"

export default async function DocumentoIncidenciaPage({ params }: PageProps) {
  const { id, eventoId } = await params
  const db = await getDbForCurrentUser()

  const { data: evento, error } = await db
    .from("rrhh_legajo_eventos")
    .select(`
      id,
      titulo,
      descripcion,
      fecha_evento,
      metadata,
      empleado:rrhh_empleados(
        id,
        legajo,
        dni,
        cuil,
        nombre,
        apellido,
        usuario:usuarios(nombre, apellido)
      )
    `)
    .eq("id", eventoId)
    .eq("empleado_id", id)
    .maybeSingle()

  if (error || !evento) {
    notFound()
  }

  const metadata = parseLegajoDisciplinaMetadata(evento.metadata)
  if (!metadata) {
    notFound()
  }

  const empleadoRaw = Array.isArray(evento.empleado) ? evento.empleado[0] : evento.empleado
  const empleado = empleadoRaw
    ? {
        ...empleadoRaw,
        usuario: Array.isArray(empleadoRaw.usuario) ? empleadoRaw.usuario[0] : empleadoRaw.usuario,
      }
    : null
  const nombreEmpleado =
    `${empleado?.usuario?.nombre || empleado?.nombre || ""} ${empleado?.usuario?.apellido || empleado?.apellido || ""}`.trim() ||
    "Empleado sin nombre"

  const descripcion = buildDisciplinaDescripcion(metadata, evento.descripcion)

  return (
    <>
      <div className="print:hidden flex items-center gap-3 border-b bg-white p-4">
        <Link
          href={`/rrhh/empleados/${id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Volver al legajo
        </Link>
        <PrintButton className="ml-auto rounded-md bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800">
          Imprimir documento
        </PrintButton>
      </div>

      <div className="mx-auto my-8 max-w-3xl print:my-0 print:max-w-full">
        <div className="border-2 border-black bg-white p-8 print:border print:p-5">
          <div className="border-b-2 border-black pb-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em]">Avicola del Sur</p>
            <h1 className="mt-2 text-2xl font-bold uppercase">Documento de Notificacion Disciplinaria</h1>
            <p className="mt-2 text-sm">
              {getDisciplinaEtapaLabel(metadata.etapa)} | Documento {evento.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-semibold">Empleado</p>
              <p>{nombreEmpleado}</p>
            </div>
            <div>
              <p className="font-semibold">Fecha del hecho</p>
              <p>{formatDateTime(evento.fecha_evento)}</p>
            </div>
            <div>
              <p className="font-semibold">Legajo</p>
              <p>{empleado?.legajo || "Sin legajo"}</p>
            </div>
            <div>
              <p className="font-semibold">DNI</p>
              <p>{empleado?.dni || "No informado"}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm">
            <div>
              <p className="font-semibold uppercase">Motivo</p>
              <p className="mt-1">{metadata.motivo}</p>
            </div>

            {metadata.etapa === "suspension" && metadata.suspension?.dias ? (
              <div>
                <p className="font-semibold uppercase">Suspension informada</p>
                <p className="mt-1">{metadata.suspension.dias} dia(s)</p>
              </div>
            ) : null}

            <div>
              <p className="font-semibold uppercase">Detalle</p>
              <p className="mt-1 whitespace-pre-wrap">{descripcion}</p>
            </div>

            <div>
              <p className="font-semibold uppercase">Constancia</p>
              <p className="mt-1 text-justify">
                Se deja constancia de que el empleado recibe notificacion formal de la medida indicada.
                La firma acredita recepcion del documento e implica conformidad con el contenido.
              </p>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-10 text-center text-sm md:grid-cols-2">
            <div>
              <div className="border-t-2 border-black pt-2">Firma del empleado</div>
              <p className="mt-6 text-xs text-muted-foreground">Aclaracion y DNI</p>
            </div>
            <div>
              <div className="border-t-2 border-black pt-2">Firma de la empresa</div>
              <p className="mt-6 text-xs text-muted-foreground">Responsable que notifica</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
