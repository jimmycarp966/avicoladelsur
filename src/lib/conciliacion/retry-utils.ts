/**
 * Utilidades para reintentos con backoff exponencial
 */

export interface RetryOptions {
    intentos?: number
    delayInicial?: number
    factorBackoff?: number
    retryableErrors?: string[] // Errores específicos que ameritan reintento
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    intentos: 3,
    delayInicial: 1000,
    factorBackoff: 2,
    retryableErrors: [
        'rate limit',
        'timeout',
        'network',
        'fetch',
        'ECONNRESET',
        'ETIMEDOUT',
        '503',
        '429',
        'temporarily unavailable'
    ]
}

/**
 * Espera un tiempo determinado
 */
export function esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Determina si un error amerita reintento
 */
function esErrorReintentable(error: unknown, retryableErrors: string[]): boolean {
    if (!error) return false
    
    const errorStr = String(error).toLowerCase()
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    
    return retryableErrors.some(pattern => 
        errorStr.includes(pattern.toLowerCase()) || 
        message.includes(pattern.toLowerCase())
    )
}

/**
 * Ejecuta una función con reintentos y backoff exponencial
 */
export async function procesarConReintentos<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    
    let ultimoError: unknown
    
    for (let intento = 0; intento < opts.intentos; intento++) {
        try {
            console.log(`[Retry] Intento ${intento + 1}/${opts.intentos}`)
            return await fn()
        } catch (error) {
            ultimoError = error
            
            // Si no es reintentable o es el último intento, lanzar el error
            const esUltimoIntento = intento === opts.intentos - 1
            const debeReintentar = esErrorReintentable(error, opts.retryableErrors)
            
            if (esUltimoIntento || !debeReintentar) {
                console.error(`[Retry] Error no reintentable o agotados intentos:`, error)
                throw error
            }
            
            // Calcular delay con backoff exponencial
            const delay = opts.delayInicial * Math.pow(opts.factorBackoff, intento)
            console.log(`[Retry] Error reintentable, esperando ${delay}ms antes de reintentar...`)
            await esperar(delay)
        }
    }
    
    throw ultimoError
}

/**
 * Wrapper específico para llamadas a Gemini con reintentos
 */
export async function geminiConReintentos<T>(
    fn: () => Promise<T>,
    intentos = 3
): Promise<T> {
    return procesarConReintentos(fn, {
        intentos,
        delayInicial: 2000, // Gemini a veces necesita más tiempo
        factorBackoff: 2,
        retryableErrors: [
            'rate limit',
            '429',
            'Resource has been exhausted',
            'temporarily unavailable',
            'timeout',
            'fetch'
        ]
    })
}
