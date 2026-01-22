import PDFDocument from 'pdfkit'
import { uploadFileToStorageServer } from '@/lib/supabase/storage-server'
import path from 'path'
import fs from 'fs'

export interface RemitoItem {
    nombre: string
    cantidad: number
    peso?: number
    unidad: string
    precio?: number
    subtotal?: number
}

export interface RemitoData {
    tipo: 'externo' | 'interno_traslado' | 'interno_produccion'
    titulo: string
    numero: string
    fecha: string
    emisor: {
        nombre: string
        cuit?: string
        direccion?: string
        telefono?: string
    }
    receptor: {
        nombre: string
        cuit?: string
        direccion?: string
    }
    items: RemitoItem[]
    total?: number
    notas?: string
    firmaUrl?: string
}

/**
 * Servicio para la generación de remitos en PDF
 */
export class RemitoService {
    /**
     * Genera un PDF de remito y lo sube a Supabase Storage
     */
    static async generarYSubir(data: RemitoData): Promise<{ url: string; path: string }> {
        const pdfBuffer = await this.generarPdfBuffer(data)

        const fileName = `remitos/${data.tipo}/${data.numero}-${Date.now()}.pdf`

        return await uploadFileToStorageServer(
            'documentos',
            pdfBuffer,
            fileName,
            'application/pdf'
        )
    }

    /**
     * Genera el buffer del PDF usando pdfkit
     */
    private static async generarPdfBuffer(data: RemitoData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' })
            const buffers: Buffer[] = []

            doc.on('data', buffers.push.bind(buffers))
            doc.on('end', () => resolve(Buffer.concat(buffers)))
            doc.on('error', reject)

            // --- HEADER ---
            this.drawHeader(doc, data)

            // --- EMISOR / RECEPTOR ---
            this.drawInfo(doc, data)

            // --- TABLA DE ITEMS ---
            this.drawItemsTable(doc, data)

            // --- FOOTER / FIRMA ---
            this.drawFooter(doc, data)

            doc.end()
        })
    }

    private static drawHeader(doc: PDFKit.PDFDocument, data: RemitoData) {
        // Logo
        const logoRelPath = 'public/images/logo-avicola.png'
        const logoPath = path.join(process.cwd(), logoRelPath)

        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { width: 100 })
        }

        // Título y Tipo
        doc.fontSize(20).font('Helvetica-Bold').text(data.titulo, 200, 50, { align: 'right' })
        doc.fontSize(10).font('Helvetica').text(`Nº: ${data.numero}`, 200, 75, { align: 'right' })
        doc.text(`Fecha: ${data.fecha}`, 200, 90, { align: 'right' })

        doc.moveDown(2)
        doc.moveTo(50, 110).lineTo(545, 110).stroke()
    }

    private static drawInfo(doc: PDFKit.PDFDocument, data: RemitoData) {
        const top = 125

        // Emisor (Lado Izquierdo)
        doc.fontSize(12).font('Helvetica-Bold').text('De:', 50, top)
        doc.fontSize(10).font('Helvetica')
        doc.text(data.emisor.nombre, 50, top + 15)
        if (data.emisor.cuit) doc.text(`CUIT: ${data.emisor.cuit}`, 50, top + 30)
        if (data.emisor.direccion) doc.text(data.emisor.direccion, 50, top + 45)
        if (data.emisor.telefono) doc.text(`Tel: ${data.emisor.telefono}`, 50, top + 60)

        // Receptor (Lado Derecho)
        doc.fontSize(12).font('Helvetica-Bold').text('Para:', 300, top)
        doc.fontSize(10).font('Helvetica')
        doc.text(data.receptor.nombre, 300, top + 15)
        if (data.receptor.cuit) doc.text(`CUIT: ${data.receptor.cuit}`, 300, top + 30)
        if (data.receptor.direccion) doc.text(data.receptor.direccion, 300, top + 45)

        doc.moveDown(4)
    }

    private static drawItemsTable(doc: PDFKit.PDFDocument, data: RemitoData) {
        const tableTop = 230
        const col1 = 50
        const col2 = 300
        const col3 = 380
        const col4 = 460

        // Header de Tabla
        doc.fontSize(10).font('Helvetica-Bold')
        doc.text('Descripción', col1, tableTop)
        doc.text('Cant.', col2, tableTop)
        doc.text('Peso', col3, tableTop)
        doc.text('Total', col4, tableTop, { align: 'right' })

        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke()

        // Filas
        let currentY = tableTop + 25
        doc.font('Helvetica')

        data.items.forEach(item => {
            // Verificar si cabe en la página
            if (currentY > 700) {
                doc.addPage()
                currentY = 50
            }

            doc.text(item.nombre, col1, currentY, { width: 240 })
            doc.text(`${item.cantidad} ${item.unidad}`, col2, currentY)
            doc.text(item.peso ? `${item.peso} kg` : '-', col3, currentY)

            if (item.subtotal !== undefined) {
                doc.text(`$${item.subtotal.toLocaleString()}`, col4, currentY, { align: 'right' })
            }

            currentY += 20
        })

        doc.moveTo(50, currentY).lineTo(545, currentY).stroke()

        // Total final
        if (data.total !== undefined) {
            currentY += 10
            doc.fontSize(12).font('Helvetica-Bold').text('TOTAL:', col3, currentY)
            doc.fontSize(12).text(`$${data.total.toLocaleString()}`, col4, currentY, { align: 'right' })
        }
    }

    private static drawFooter(doc: PDFKit.PDFDocument, data: RemitoData) {
        let currentY = doc.y + 40

        if (currentY > 700) {
            doc.addPage()
            currentY = 50
        }

        if (data.notas) {
            doc.fontSize(10).font('Helvetica-Oblique').text('Notas:', 50, currentY)
            doc.text(data.notas, 50, currentY + 15, { width: 500 })
            currentY += 50
        }

        // Firma
        if (data.firmaUrl) {
            // Nota: Si la firma es una URL, pdfkit no la descarga sola. 
            // Por ahora dejamos el espacio para firma y luego implementaremos la descarga.
            doc.fontSize(10).font('Helvetica-Bold').text('Firma Digital Receptor:', 350, currentY + 20)
            // TODO: Descargar y mostrar imagen de firma
        } else {
            doc.moveTo(350, currentY + 80).lineTo(545, currentY + 80).stroke()
            doc.fontSize(8).text('Firma y Aclaración', 350, currentY + 85, { width: 195, align: 'center' })
        }

        // Pie de página oficial
        doc.fontSize(8).font('Helvetica')
            .text('Este documento es un comprobante interno de Avícola del Sur.', 50, doc.page.height - 50, { align: 'center' })
    }
}
