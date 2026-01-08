
/**
 * Normaliza un string para comparación: minúsculas, sin tildes, trim.
 */
export function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
}

/**
 * Calcula la distancia de Levenshtein entre dos strings.
 */
export function levenshteinDistance(a: string, b: string): number {
    const an = a.length
    const bn = b.length
    if (an === 0) return bn
    if (bn === 0) return an

    const matrix = Array(bn + 1).fill(null).map(() => Array(an + 1).fill(null))

    for (let i = 0; i <= an; i += 1) {
        matrix[0][i] = i
    }

    for (let j = 0; j <= bn; j += 1) {
        matrix[j][0] = j
    }

    for (let j = 1; j <= bn; j += 1) {
        for (let i = 1; i <= an; i += 1) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + indicator // substitution
            )
        }
    }

    return matrix[bn][an]
}

/**
 * Calcula similitud entre 0 y 1
 */
export function calculateStringSimilarity(a: string, b: string): number {
    const normA = normalizeString(a)
    const normB = normalizeString(b)

    if (!normA && !normB) return 1
    if (!normA || !normB) return 0

    const distance = levenshteinDistance(normA, normB)
    const maxLength = Math.max(normA.length, normB.length)

    return 1 - distance / maxLength
}
