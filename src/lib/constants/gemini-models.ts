/**
 * Constantes de Modelos Gemini - Avícola del Sur
 * Centraliza los modelos de IA usados en todo el sistema para consistencia
 * 
 * @see https://ai.google.dev/gemini-api/docs/models
 */

/**
 * Modelo rápido para tareas que requieren baja latencia
 * Ideal para: detección de anomalías, clasificaciones, validaciones, chat
 * Costo: Muy bajo (~15-30 RPM free tier)
 */
export const GEMINI_MODEL_FLASH = 'gemini-2.5-flash'

/**
 * Modelo avanzado para análisis complejos
 * Ideal para: reportes inteligentes, análisis de documentos, predicciones complejas
 * Costo: Moderado (requiere plan pagado para alto volumen)
 */
export const GEMINI_MODEL_PRO = 'gemini-3-pro'

/**
 * Modelo por defecto para la mayoría de casos
 * Se recomienda usar FLASH a menos que necesites análisis muy profundo
 */
export const GEMINI_MODEL_DEFAULT = GEMINI_MODEL_FLASH

/**
 * Determina qué modelo usar según el tipo de tarea
 */
export type GeminiTaskType =
    | 'quick_analysis'     // Clasificaciones, detecciones rápidas
    | 'complex_report'     // Reportes, análisis profundo
    | 'document_parsing'   // Parseo de PDFs/imágenes
    | 'chat'               // Conversaciones, bot
    | 'matching'           // Matching/comparaciones

export function getGeminiModelForTask(task: GeminiTaskType): string {
    switch (task) {
        case 'quick_analysis':
        case 'chat':
        case 'matching':
            return GEMINI_MODEL_FLASH
        case 'complex_report':
        case 'document_parsing':
            return GEMINI_MODEL_PRO
        default:
            return GEMINI_MODEL_DEFAULT
    }
}
