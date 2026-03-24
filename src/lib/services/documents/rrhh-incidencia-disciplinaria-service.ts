import PDFDocument from 'pdfkit'
import { uploadFileToPrivateStorageServer } from '@/lib/supabase/storage-server'
import {
  getDisciplinaEtapaLabel,
  getDisciplinaEtapaShortLabel,
  type DisciplinaEtapa,
} from '@/lib/utils/rrhh-disciplinario'

export const RRHH_DISCIPLINA_BUCKET = 'rrhh-legajo-documentos'

type IncidenciaDocumentoInput = {
  eventoId: string
  empleado: {
    id: string
    legajo?: string | null
    dni?: string | null
    cuil?: string | null
    nombreCompleto: string
  }
  fechaEventoIso: string
  etapa: DisciplinaEtapa
  motivo: string
  descripcion?: string | null
  suspensionDias?: number | null
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}

function sanitizeForPath(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function buildDocumentPath(input: IncidenciaDocumentoInput) {
  const etapa = sanitizeForPath(getDisciplinaEtapaShortLabel(input.etapa).toLowerCase())
  return `disciplinarias/${input.empleado.id}/${input.eventoId}-${etapa}.pdf`
}

async function buildPdfBuffer(input: IncidenciaDocumentoInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' })
    const buffers: Buffer[] = []

    doc.on('data', (chunk) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    const companyName = 'Avicola del Sur'
    const stageLabel = getDisciplinaEtapaLabel(input.etapa)

    doc.font('Helvetica-Bold').fontSize(18).text(companyName, { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(14).text('Documento de Notificacion Disciplinaria', { align: 'center' })
    doc.moveDown(1)

    doc.fontSize(10).font('Helvetica')
    doc.text(`Documento: ${input.eventoId.slice(0, 8).toUpperCase()}`, { align: 'right' })
    doc.text(`Fecha del hecho: ${formatDateTime(input.fechaEventoIso)}`, { align: 'right' })
    doc.moveDown(1.2)

    doc.font('Helvetica-Bold').fontSize(12).text('Datos del empleado')
    doc.moveDown(0.4)
    doc.font('Helvetica').fontSize(11)
    doc.text(`Nombre: ${input.empleado.nombreCompleto}`)
    doc.text(`Legajo: ${input.empleado.legajo || 'Sin legajo'}`)
    doc.text(`DNI: ${input.empleado.dni || 'No informado'}`)
    if (input.empleado.cuil) {
      doc.text(`CUIL: ${input.empleado.cuil}`)
    }

    doc.moveDown(1)
    doc.font('Helvetica-Bold').text('Medida aplicada')
    doc.moveDown(0.4)
    doc.font('Helvetica').text(`Tipo: ${stageLabel}`)
    doc.text(`Motivo: ${input.motivo}`)

    if (input.etapa === 'suspension' && input.suspensionDias) {
      doc.text(`Duracion informada: ${input.suspensionDias} dia(s)`)
    }

    if (input.descripcion?.trim()) {
      doc.moveDown(0.6)
      doc.font('Helvetica-Bold').text('Detalle')
      doc.moveDown(0.3)
      doc.font('Helvetica').text(input.descripcion.trim(), {
        align: 'left',
      })
    }

    doc.moveDown(1)
    doc.font('Helvetica-Bold').text('Constancia')
    doc.moveDown(0.3)
    doc.font('Helvetica').text(
      'Se deja constancia de que el empleado recibe notificacion formal de la medida disciplinaria indicada. La firma acredita recepcion del documento y no implica conformidad con su contenido.',
      { align: 'justify' },
    )

    doc.moveDown(2)
    const currentY = doc.y

    doc.moveTo(60, currentY + 60).lineTo(250, currentY + 60).stroke()
    doc.moveTo(330, currentY + 60).lineTo(520, currentY + 60).stroke()

    doc.fontSize(10)
    doc.text('Firma del empleado', 60, currentY + 68, {
      width: 190,
      align: 'center',
    })
    doc.text('Firma de la empresa', 330, currentY + 68, {
      width: 190,
      align: 'center',
    })

    doc.moveDown(7)
    doc.fontSize(9).fillColor('#555')
    doc.text(
      `Legajo ${input.empleado.legajo || 's/n'} | ${getDisciplinaEtapaShortLabel(input.etapa)} | ${companyName}`,
      48,
      doc.page.height - 50,
      { align: 'center', width: doc.page.width - 96 },
    )

    doc.end()
  })
}

export async function generarDocumentoIncidenciaDisciplinaria(input: IncidenciaDocumentoInput) {
  const pdfBuffer = await buildPdfBuffer(input)
  const path = buildDocumentPath(input)

  await uploadFileToPrivateStorageServer(
    RRHH_DISCIPLINA_BUCKET,
    pdfBuffer,
    path,
    'application/pdf',
  )

  return {
    bucket: RRHH_DISCIPLINA_BUCKET,
    path,
  }
}
