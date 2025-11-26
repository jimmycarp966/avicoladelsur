import * as XLSX from 'xlsx'

/**
 * Convierte datos a CSV (separado por ; para formato argentino)
 */
export function toCSV(headers: string[], rows: Array<Record<string, any>>): string {
  const escape = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.join(';')
  const dataLines = rows.map((row) =>
    headers.map((header) => escape(row[header])).join(';')
  )
  return [headerLine, ...dataLines].join('\n')
}

/**
 * Convierte datos a Excel (XLSX)
 */
export function toExcel(
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, any>>
): Buffer {
  // Crear workbook
  const wb = XLSX.utils.book_new()

  // Preparar datos
  const data = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? '')),
  ]

  // Crear worksheet
  const ws = XLSX.utils.aoa_to_sheet(data)

  // Establecer ancho de columnas
  const colWidths = headers.map((header) => ({
    wch: Math.max(header.length, 15),
  }))
  ws['!cols'] = colWidths

  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Convertir a buffer
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

/**
 * Descarga un archivo CSV
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Descarga un archivo Excel
 */
export function downloadExcel(buffer: Buffer, filename: string): void {
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.xlsx`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Genera nombre de archivo con timestamp
 */
export function generateFilename(prefix: string, extension: string = 'csv'): string {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  return `${prefix}_${timestamp}.${extension}`
}

