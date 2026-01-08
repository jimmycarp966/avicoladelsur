import PDFDocument from 'pdfkit'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ResultadoValidacion, EstadoValidacion } from '@/types/conciliacion'

/**
 * Opciones para generar el reporte de conciliación
 */
export interface OpcionesReporte {
    sesionId: string
    fecha: Date
    usuarioNombre: string
    sabanaArchivo: string
    resultados: ResultadoValidacion[]
    resumen: {
        totalComprobantes: number
        validados: number
        noEncontrados: number
        sinCliente: number
        errores: number
        montoTotalAcreditado: number
    }
}

/**
 * Genera un reporte PDF de la sesión de conciliación.
 * 
 * @returns Buffer del PDF generado
 */
export async function generarReporteConciliacion(opciones: OpcionesReporte): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: `Reporte Conciliación - ${format(opciones.fecha, 'dd/MM/yyyy')}`,
                    Author: 'Avícola del Sur ERP',
                    Subject: 'Conciliación Bancaria',
                }
            })

            const chunks: Buffer[] = []
            doc.on('data', (chunk) => chunks.push(chunk))
            doc.on('end', () => resolve(Buffer.concat(chunks)))
            doc.on('error', reject)

            // === ENCABEZADO ===
            doc.fontSize(18).font('Helvetica-Bold')
                .text('REPORTE DE CONCILIACIÓN BANCARIA', { align: 'center' })

            doc.moveDown(0.5)
            doc.fontSize(12).font('Helvetica')
                .text(`Fecha: ${format(opciones.fecha, "EEEE d 'de' MMMM 'de' yyyy - HH:mm", { locale: es })}`, { align: 'center' })

            doc.moveDown(0.3)
            doc.fontSize(10)
                .text(`Sesión: ${opciones.sesionId.slice(0, 8).toUpperCase()}`, { align: 'center' })
                .text(`Usuario: ${opciones.usuarioNombre}`, { align: 'center' })

            doc.moveDown()

            // Línea separadora
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
            doc.moveDown()

            // === INFORMACIÓN DE ARCHIVOS ===
            doc.fontSize(11).font('Helvetica-Bold')
                .text('Archivo de Sábana:')
            doc.font('Helvetica')
                .text(opciones.sabanaArchivo || 'No especificado')

            doc.moveDown()

            // === RESUMEN ===
            doc.fontSize(14).font('Helvetica-Bold')
                .text('RESUMEN DE CONCILIACIÓN', { underline: true })

            doc.moveDown(0.5)

            // Tabla de resumen
            const resumenY = doc.y
            const col1X = 50
            const col2X = 300
            const col3X = 400

            doc.fontSize(11).font('Helvetica-Bold')
            doc.text('Concepto', col1X, resumenY)
            doc.text('Cantidad', col2X, resumenY)
            doc.text('Monto', col3X, resumenY)

            doc.moveDown(0.3)
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
            doc.moveDown(0.3)

            const filas = [
                { concepto: 'Total Comprobantes', cantidad: opciones.resumen.totalComprobantes, monto: '' },
                { concepto: '✅ Validados', cantidad: opciones.resumen.validados, monto: '' },
                { concepto: '❌ No Encontrados', cantidad: opciones.resumen.noEncontrados, monto: '' },
                { concepto: '⚠️ Sin Cliente', cantidad: opciones.resumen.sinCliente, monto: '' },
                { concepto: '🚫 Errores', cantidad: opciones.resumen.errores, monto: '' },
                { concepto: '💰 Monto Acreditado', cantidad: '', monto: formatMoney(opciones.resumen.montoTotalAcreditado) },
            ]

            doc.font('Helvetica')
            for (const fila of filas) {
                doc.text(fila.concepto, col1X, doc.y)
                doc.text(String(fila.cantidad), col2X, doc.y - 12)
                doc.text(fila.monto, col3X, doc.y - 12)
                doc.moveDown(0.5)
            }

            doc.moveDown()
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
            doc.moveDown()

            // === DETALLE DE COMPROBANTES ===
            doc.fontSize(14).font('Helvetica-Bold')
                .text('DETALLE DE COMPROBANTES', { underline: true })

            doc.moveDown(0.5)

            // Encabezados de tabla
            const tableY = doc.y
            const tcol1 = 50  // #
            const tcol2 = 70  // Estado
            const tcol3 = 150 // Monto
            const tcol4 = 230 // DNI/CUIT
            const tcol5 = 310 // Cliente
            const tcol6 = 430 // Score

            doc.fontSize(9).font('Helvetica-Bold')
            doc.text('#', tcol1, tableY)
            doc.text('Estado', tcol2, tableY)
            doc.text('Monto', tcol3, tableY)
            doc.text('DNI/CUIT', tcol4, tableY)
            doc.text('Cliente', tcol5, tableY)
            doc.text('Score', tcol6, tableY)

            doc.moveDown(0.3)
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
            doc.moveDown(0.3)

            // Filas de comprobantes
            doc.font('Helvetica').fontSize(8)
            let index = 1
            for (const resultado of opciones.resultados) {
                // Verificar si necesitamos nueva página
                if (doc.y > 720) {
                    doc.addPage()
                    doc.fontSize(9).font('Helvetica-Bold')
                    doc.text('#', tcol1, 50)
                    doc.text('Estado', tcol2, 50)
                    doc.text('Monto', tcol3, 50)
                    doc.text('DNI/CUIT', tcol4, 50)
                    doc.text('Cliente', tcol5, 50)
                    doc.text('Score', tcol6, 50)
                    doc.moveDown(0.3)
                    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
                    doc.moveDown(0.3)
                    doc.font('Helvetica').fontSize(8)
                }

                const estadoIcon = getEstadoIcon(resultado.estado)
                const clienteNombre = resultado.cliente?.nombre || '-'
                const scoreStr = resultado.confianza_score ? `${resultado.confianza_score}%` : '-'

                const rowY = doc.y
                doc.text(String(index), tcol1, rowY)
                doc.text(estadoIcon, tcol2, rowY)
                doc.text(formatMoney(resultado.comprobante.monto), tcol3, rowY)
                doc.text(resultado.comprobante.dni_cuit || '-', tcol4, rowY)
                doc.text(truncate(clienteNombre, 20), tcol5, rowY)
                doc.text(scoreStr, tcol6, rowY)

                doc.moveDown(0.5)
                index++
            }

            // === PIE DE PÁGINA ===
            doc.moveDown(2)
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
            doc.moveDown(0.5)

            doc.fontSize(8).font('Helvetica')
                .text(`Generado automáticamente por Avícola del Sur ERP - ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, { align: 'center' })

            doc.moveDown()
            doc.text('Este documento es un comprobante de la conciliación bancaria realizada.', { align: 'center' })

            doc.end()

        } catch (error) {
            reject(error)
        }
    })
}

/**
 * Formatea un número como moneda argentina
 */
function formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(value)
}

/**
 * Obtiene el ícono de estado
 */
function getEstadoIcon(estado: EstadoValidacion): string {
    switch (estado) {
        case 'validado': return '✅ Validado'
        case 'no_encontrado': return '❌ No encontrado'
        case 'sin_cliente': return '⚠️ Sin cliente'
        case 'error': return '🚫 Error'
        case 'pendiente': return '⏳ Pendiente'
        default: return estado
    }
}

/**
 * Trunca un texto a la longitud especificada
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + '...'
}
