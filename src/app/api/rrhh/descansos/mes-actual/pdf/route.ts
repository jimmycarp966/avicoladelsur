import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
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

function formatTurnoLabel(turno: string | null | undefined): string {
  const normalized = turno?.trim().toLowerCase() || ''

  if (!normalized) return 'Sin definir'
  if (normalized.includes('manana') || normalized.includes('mañana')) return 'Mañana'
  if (normalized.includes('tarde')) return 'Tarde'
  if (normalized.includes('noche')) return 'Noche'

  const cleaned = normalized
    .replace(/_/g, ' ')
    .replace(/\bmedio turno\b/g, '')
    .replace(/\bturno\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return 'Sin definir'

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function normalizeDescansoRows(rows: DescansoRow[]): DescansoPdfItem[] {
  return rows.map((row) => {
    const empleado = row.empleado
    const sucursal = pickSingle(empleado?.sucursal)
    const categoria = pickSingle(empleado?.categoria)

    return {
      sucursal: sucursal?.nombre?.trim() || 'Sin sucursal',
      fecha: row.fecha,
      turno: formatTurnoLabel(row.turno),
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

function buildSucursalHeading(sucursal: string, anio: number, mes: number) {
  const mesNombre = format(new Date(anio, mes - 1, 1), 'MMMM', { locale: es })
  return `Sucursal ${sucursal} - Descanso mes ${mesNombre}`
}

function drawPageHeader(doc: InstanceType<typeof PDFDocument>, periodoLabel: string, total: number) {
  const x = doc.page.margins.left
  const y = doc.y
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

  doc.roundedRect(x, y, width, 72, 14).fill('#0f172a')
  doc
    .fillColor('#f8fafc')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('Descansos del mes', x + 18, y + 16, { width: width - 36 })
  doc
    .fillColor('#cbd5e1')
    .font('Helvetica')
    .fontSize(10)
    .text(`${periodoLabel}  |  ${total} descanso${total === 1 ? '' : 's'} registrados`, x + 18, y + 44, {
      width: width - 36,
    })

  doc.y = y + 90
}

function drawSucursalHeader(
  doc: InstanceType<typeof PDFDocument>,
  heading: string,
  cantidad: number,
) {
  const x = doc.page.margins.left
  const y = doc.y
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

  doc.roundedRect(x, y, width, 34, 10).fill('#e2e8f0')
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(heading, x + 12, y + 10, { width: width - 120 })
  doc
    .fillColor('#334155')
    .font('Helvetica')
    .fontSize(9)
    .text(`${cantidad} empleado${cantidad === 1 ? '' : 's'}`, x + width - 96, y + 11, {
      width: 84,
      align: 'right',
    })

  doc.y = y + 46
}

function drawTableHeader(doc: InstanceType<typeof PDFDocument>) {
  const y = doc.y

  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('FECHA', 42, y, { width: 72 })
  doc.text('TURNO', 118, y, { width: 72 })
  doc.text('LEGAJO', 194, y, { width: 78 })
  doc.text('PUESTO', 276, y, { width: 136 })
  doc.text('EMPLEADO', 416, y, { width: 138 })

  doc
    .strokeColor('#cbd5e1')
    .moveTo(doc.page.margins.left, y + 16)
    .lineTo(doc.page.width - doc.page.margins.right, y + 16)
    .stroke()

  doc.y = y + 24
}

function drawDescansoRow(
  doc: InstanceType<typeof PDFDocument>,
  descanso: DescansoPdfItem,
  index: number,
) {
  const x = doc.page.margins.left
  const y = doc.y
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const rowHeight = 24

  if (index % 2 === 0) {
    doc.roundedRect(x, y - 3, width, rowHeight, 6).fill('#f8fafc')
  }

  doc
    .fillColor('#0f172a')
    .font('Helvetica')
    .fontSize(10)
    .text(formatDate(descanso.fecha), 42, y + 3, { width: 72 })
  doc.text(descanso.turno, 118, y + 3, { width: 72 })
  doc.text(descanso.legajo, 194, y + 3, { width: 78 })
  doc.text(descanso.puesto, 276, y + 3, { width: 136 })
  doc.font('Helvetica-Bold').text(descanso.nombreCompleto, 416, y + 3, { width: 138 })

  doc.y = y + rowHeight
}

async function buildPdfBuffer(
  items: DescansoPdfItem[],
  periodoLabel: string,
  anio: number,
  mes: number,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 42, size: 'A4' })
  const buffers: Buffer[] = []

  return await new Promise((resolve) => {
    doc.on('data', (chunk) => buffers.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(buffers)))

    drawPageHeader(doc, periodoLabel, items.length)

    if (items.length === 0) {
      doc
        .font('Helvetica')
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

      ensureSpace(doc, 88)
      doc.moveDown(0.2)
      drawSucursalHeader(doc, buildSucursalHeading(sucursal, anio, mes), descansos.length)
      drawTableHeader(doc)

      for (const [index, descanso] of descansos.entries()) {
        ensureSpace(doc, 28)
        if (doc.y + 28 > doc.page.height - doc.page.margins.bottom) {
          doc.addPage()
          drawSucursalHeader(doc, buildSucursalHeading(sucursal, anio, mes), descansos.length)
          drawTableHeader(doc)
        }

        drawDescansoRow(doc, descanso, index)
      }

      doc.moveDown(1)
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
    const pdfBuffer = await buildPdfBuffer(descansos, periodoLabel, anio, mes)
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
