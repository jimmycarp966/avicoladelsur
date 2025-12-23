/**
 * Utilidades para parsear códigos de barras EAN-13 con peso embebido
 * 
 * Formato de la balanza SDP BBC-4030:
 * 2 0 P P P P P W W W W W C
 * │ │ └─────┘   └─────┘   │
 * │ │    │         │      └── Dígito verificador
 * │ │    │         └── Peso (5 dígitos, ej: 10170 = 10.170 kg)
 * │ │    └── PLU/Código producto (5 dígitos)
 * │ └── Indicador tipo (0 = precio variable, 1 = peso variable)
 * └── Prefijo nacional peso variable
 */

export interface BarcodeResult {
  isValid: boolean
  isWeightCode: boolean
  plu: string | null
  weight: number | null
  rawCode: string
  error?: string
}

/**
 * Calcula el dígito verificador EAN-13
 */
function calculateEAN13CheckDigit(code: string): number {
  if (code.length !== 12) return -1
  
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  
  return (10 - (sum % 10)) % 10
}

/**
 * Valida un código EAN-13
 */
export function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  
  const checkDigit = parseInt(code[12], 10)
  const calculatedCheck = calculateEAN13CheckDigit(code.substring(0, 12))
  
  return checkDigit === calculatedCheck
}

/**
 * Parsea un código de barras EAN-13 con peso embebido
 * Soporta códigos con prefijo 20 (estándar de peso variable)
 */
export function parseBarcodeEAN13(code: string): BarcodeResult {
  const rawCode = code.trim()
  
  // Validar formato básico
  if (!/^\d{13}$/.test(rawCode)) {
    return {
      isValid: false,
      isWeightCode: false,
      plu: null,
      weight: null,
      rawCode,
      error: 'Código debe tener 13 dígitos'
    }
  }
  
  // Verificar prefijo de peso variable (20, 21, 22, etc.)
  const prefix = rawCode.substring(0, 2)
  const isWeightCode = prefix === '20' || prefix === '21' || prefix === '22'
  
  if (!isWeightCode) {
    // Es un código EAN-13 estándar (sin peso embebido)
    return {
      isValid: validateEAN13(rawCode),
      isWeightCode: false,
      plu: rawCode, // El código completo es el identificador
      weight: null,
      rawCode
    }
  }
  
  // Extraer PLU y peso del código
  // Formato: 20 PPPPP WWWWW C
  const pluRaw = rawCode.substring(2, 7)  // 5 dígitos de PLU
  const weightRaw = rawCode.substring(7, 12)  // 5 dígitos de peso
  
  // Limpiar PLU (remover ceros a la izquierda pero mantener al menos 1 dígito)
  const plu = pluRaw.replace(/^0+/, '') || '0'
  
  // Convertir peso: los 5 dígitos representan gramos (ej: 10170 = 10.170 kg)
  // O pueden representar el peso con 3 decimales (ej: 10170 = 10.170 kg)
  const weightGrams = parseInt(weightRaw, 10)
  const weight = weightGrams / 1000  // Convertir a kg
  
  return {
    isValid: true,
    isWeightCode: true,
    plu,
    weight,
    rawCode
  }
}

/**
 * Parsea códigos alternativos (Code128, etc.)
 * Útil cuando el código no es EAN-13
 */
export function parseGenericBarcode(code: string): BarcodeResult {
  const rawCode = code.trim()
  
  // Si es EAN-13, usar el parser específico
  if (/^\d{13}$/.test(rawCode)) {
    return parseBarcodeEAN13(rawCode)
  }
  
  // Para otros formatos, simplemente retornar el código como PLU
  return {
    isValid: true,
    isWeightCode: false,
    plu: rawCode,
    weight: null,
    rawCode
  }
}

/**
 * Formatea el peso para mostrar (ej: 10.170 kg)
 */
export function formatWeight(weight: number | null): string {
  if (weight === null) return '-'
  return `${weight.toFixed(3)} kg`
}

/**
 * Formatea el PLU para búsqueda en BD
 * Genera variantes posibles del código
 */
export function getPLUVariants(plu: string): string[] {
  const variants: string[] = [plu]
  
  // Agregar con ceros a la izquierda (4 dígitos)
  if (plu.length < 4) {
    variants.push(plu.padStart(4, '0'))
  }
  
  // Agregar sin ceros a la izquierda
  const withoutLeadingZeros = plu.replace(/^0+/, '')
  if (withoutLeadingZeros !== plu && withoutLeadingZeros.length > 0) {
    variants.push(withoutLeadingZeros)
  }
  
  return [...new Set(variants)] // Eliminar duplicados
}
