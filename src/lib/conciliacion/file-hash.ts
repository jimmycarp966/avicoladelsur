/**
 * Utilidades para calcular hashes de archivos y detectar duplicados
 */

/**
 * Calcula un hash SHA-256 del archivo para detectar duplicados
 */
export async function calcularHashArchivo(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Calcula hashes para múltiples archivos en batch
 */
export async function calcularHashesBatch(
    files: File[]
): Promise<{ file: File; hash: string }[]> {
    const resultados = await Promise.all(
        files.map(async (file) => ({
            file,
            hash: await calcularHashArchivo(file)
        }))
    )
    return resultados
}
