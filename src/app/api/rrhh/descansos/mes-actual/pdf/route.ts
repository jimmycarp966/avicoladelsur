import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { formatDate, getTodayArgentina } from '@/lib/utils'

type DescansoRow = {
  fecha: string
  turno: string | null
  empleado: {
    legajo: string | null
    nombre: string | null
    apellido: string | null
    usuario:
      | {
          nombre: string | null
          apellido: string | null
        }
      | {
          nombre: string | null
          apellido: string | null
        }[]
      | null
    sucursal:
      | {
          nombre: string | null
        }
      | {
          nombre: string | null
        }[]
      | null
    categoria:
      | {
          nombre: string | null
        }
      | {
          nombre: string | null
        }[]
      | null
  } | null
}

type DescansoPdfItem = {
  sucursal: string
  fecha: string
  turno: string
  legajo: string
  puesto: string
  nombreCompleto: string
}

async function getDbForCurrentUser() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { db: supabase }
  }

  const { data: userRow } = await adminSupabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = !!userRow?.activo && userRow.rol === 'admin'

  return { db: isAdmin ? adminSupabase : supabase }
}

function pickSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function buildNombreCompleto(row: DescansoRow['empleado']): string {
  if (!row) return 'Empleado sin datos'

  const usuario = pickSingle(row.usuario)
  const nombre = usuario?.nombre?.trim() || row.nombre?.trim() || ''
  const apellido = usuario?.apellido?.trim() || row.apellido?.trim() || ''
  const nombreCompleto = `${apellido} ${nombre}`.trim()

  return nombreCompleto || 'Empleado sin nombre'
}

function normalizeDescansoRows(rows: DescansoRow[]): DescansoPdfItem[] {
  return rows.map((row) => {
    const empleado = row.empleado
    const sucursal = pickSingle(empleado?.sucursal)
    const categoria = pickSingle(empleado?.categoria)

    return {
      sucursal: sucursal?.nombre?.trim() || 'Sin sucursal',
      fecha: row.fecha,
      turno: row.turno?.trim() || 'Sin turno',
      legajo: empleado?.legajo?.trim() || '-',
      puesto: categoria?.nombre?.trim() || 'Sin puesto',
      nombreCompleto: buildNombreCompleto(empleado),
    }
  })
}

function ensureSpace(doc: InstanceType<typeof PDFDocument>, neededHeight: number) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage()
  }
}

async function buildPdfBuffer(items: DescansoPdfItem[], periodoLabel: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 42, size: 'A4' })
  const buffers: Buffer[] = []

  return await new Promise((resolve) => {
    doc.on('data', (chunk) => buffers.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(buffers)))

    doc.fontSize(18).fillColor('#0f172a').text('Descansos del mes', { align: 'center' })
    doc.moveDown(0.25)
    doc.fontSize(10).fillColor('#475569').text(periodoLabel, { align: 'center' })
    doc.moveDown(1.2)

    if (items.length === 0) {
      doc
        .fontSize(12)
        .fillColor('#334155')
        .text('No hay descansos registrados para el mes actual.', {
          align: 'center',
        })
      doc.end()
      return
    }

    const grupos = items.reduce<Record<string, DescansoPdfItem[]>>((acc, item) => {
      if (!acc[item.sucursal]) {
        acc[item.sucursal] = []
      }
      acc[item.sucursal].push(item)
      return acc
    }, {})

    for (const sucursal of Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es'))) {
      const descansos = grupos[sucursal].sort((a, b) => {
        const byFecha = a.fecha.localeCompare(b.fecha)
        if (byFecha !== 0) return byFecha
        return a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')
      })

      ensureSpace(doc, 72)
      doc.moveDown(0.2)
      doc.fontSize(13).fillColor('#0f172a').text(sucursal)
      doc.moveDown(0.15)
      doc
        .strokeColor('#cbd5e1')
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke()
      doc.moveDown(0.4)

      doc.fontSize(9).fillColor('#64748b')
      const headerY = doc.y
      doc.text('Fecha', 42, headerY, { width: 70 })
      doc.text('Turno', 114, headerY, { width: 70 })
      doc.text('Legajo', 186, headerY, { width: 70 })
      doc.text('Puesto', 258, headerY, { width: 120 })
      doc.text('Empleado', 382, headerY, { width: 170 })
      doc.moveDown(0.6)

      for (const descanso of descansos) {
        ensureSpace(doc, 24)
        const rowY = doc.y

        doc.fontSize(10).fillColor('#0f172a')
        doc.text(formatDate(descanso.fecha), 42, rowY, { width: 70 })
        doc.text(descanso.turno, 114, rowY, { width: 70 })
        doc.text(descanso.legajo, 186, rowY, { width: 70 })
        doc.text(descanso.puesto, 258, rowY, { width: 120 })
        doc.text(descanso.nombreCompleto, 382, rowY, { width: 170 })
        doc.moveDown(0.55)
      }

      doc.moveDown(0.8)
    }

    doc.end()
  })
}

export async function GET() {
  try {
    const { db: supabase } = await getDbForCurrentUser()
    const today = getTodayArgentina()
    const [anio, mes] = today.split('-').map(Number)

    const { data, error } = await supabase
      .from('rrhh_descansos_mensuales')
      .select(`
        fecha,
        turno,
        empleado:rrhh_empleados(
          legajo,
          nombre,
          apellido,
          usuario:usuarios(nombre, apellido),
          sucursal:sucursales(nombre),
          categoria:rrhh_categorias(nombre)
        )
      `)
      .eq('periodo_anio', anio)
      .eq('periodo_mes', mes)
      .neq('estado', 'cancelado')
      .order('fecha', { ascending: true })

    if (error) {
      throw error
    }

    const descansos = normalizeDescansoRows((data || []) as DescansoRow[])
    const periodoLabel = `Mes actual: ${String(mes).padStart(2, '0')}/${anio}`
    const pdfBuffer = await buildPdfBuffer(descansos, periodoLabel)
    const filename = `descansos-${anio}-${String(mes).padStart(2, '0')}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generando PDF de descansos mensuales:', error)
    return NextResponse.json(
      {
        error: 'No se pudo generar el PDF de descansos del mes actual',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 },
    )
  }
}
