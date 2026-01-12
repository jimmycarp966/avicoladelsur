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
  pluExtended?: string | null
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
 * 
 * Formato de balanza SDP BBC-4030 (Avícola del Sur):
 * 2 0 P P P P F W W W W W C
 * │ │ └─────┘ │ └───────┘ │
 * │ │    │    │     │     └── Dígito verificador
 * │ │    │    │     └── Peso (5 dígitos en gramos, ej: 11650 = 11.650 kg)
 * │ │    │    └── Flag (0=normal, 1=unidad mayor, etc.)
 * │ │    └── PLU/Código producto (4 dígitos con ceros a la izquierda)
 * │ └── Indicador tipo
 * └── Prefijo nacional peso variable
 * 
 * Ejemplos:
 * - 2001480116503 → PLU: 148, Peso: 11.650 kg
 * - 2001481010704 → PLU: 148, Peso: 10.170 kg (flag 1 = unidad mayor)
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

  // Formato SDP: 20 + PLU(4) + FLAG(1) + PESO(5) + CHECK(1)
  // O Alternativa 5 dígitos PLU: 20 + PLU(5) + PESO(5) + CHECK(1)
  // Como no podemos estar seguros, extraemos estándar pero permitimos variantes
  const pluRaw = rawCode.substring(2, 6)   // 4 dígitos de PLU (posición 2-5)
  const flag = rawCode.substring(6, 7)      // 1 dígito flag (posición 6)
  const weightRaw = rawCode.substring(7, 12)  // 5 dígitos de peso (posición 7-11)

  // Variante 5 dígitos (si el formato es PPPPP sin flag)
  // Esto es útil si el PLU real es de 5 dígitos (ej: 00055)
  const pluRawExtended = rawCode.substring(2, 7)

  // Limpiar PLU: remover ceros a la izquierda
  // Devolvemos el PLU estándar, pero getPLUVariants debería considerar pluRawExtended si es necesario
  const plu = pluRaw.replace(/^0+/, '') || '0'
  const pluExtended = pluRawExtended.replace(/^0+/, '') || '0'

  // Convertir peso: los 5 dígitos representan gramos (ej: 11650 = 11.650 kg)
  const weightGrams = parseInt(weightRaw, 10)
  const weight = weightGrams / 1000  // Convertir a kg

  // Log solo en desarrollo para debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[barcode-parser] Código parseado:', {
      rawCode,
      pluRaw,
      plu,
      flag,
      weightRaw,
      weight: weight.toFixed(3) + ' kg'
    })
  }

  return {
    isValid: true,
    isWeightCode: true,
    plu,
    pluExtended,
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
    pluExtended: rawCode,
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
