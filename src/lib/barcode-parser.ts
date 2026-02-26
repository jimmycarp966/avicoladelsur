/**
 * Utilities to parse EAN-13 barcodes, including variable-weight labels.
 */

export interface BarcodeResult {
  isValid: boolean
  isWeightCode: boolean
  plu: string | null
  pluExtended?: string | null
  weight: number | null
  rawCode: string
  checksumValid?: boolean
  error?: string
}

/**
 * Calculates EAN-13 check digit for a 12-digit base.
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
 * Validates a full EAN-13 code.
 */
export function validateEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false

  const checkDigit = parseInt(code[12], 10)
  const calculatedCheck = calculateEAN13CheckDigit(code.substring(0, 12))

  return checkDigit === calculatedCheck
}

/**
 * Parses EAN-13 barcode and extracts variable-weight payload when prefix is 20/21/22.
 */
export function parseBarcodeEAN13(code: string): BarcodeResult {
  const rawCode = code.trim()

  if (!/^\d{13}$/.test(rawCode)) {
    return {
      isValid: false,
      isWeightCode: false,
      plu: null,
      weight: null,
      rawCode,
      checksumValid: false,
      error: 'Codigo debe tener 13 digitos'
    }
  }

  const checksumValid = validateEAN13(rawCode)

  // Variable weight prefixes used by scales.
  const prefix = rawCode.substring(0, 2)
  const isWeightCode = prefix === '20' || prefix === '21' || prefix === '22'

  if (!isWeightCode) {
    return {
      isValid: checksumValid,
      isWeightCode: false,
      plu: rawCode,
      weight: null,
      rawCode,
      checksumValid,
      error: checksumValid ? undefined : 'Checksum EAN-13 invalido'
    }
  }

  if (!checksumValid) {
    return {
      isValid: false,
      isWeightCode: true,
      plu: null,
      pluExtended: null,
      weight: null,
      rawCode,
      checksumValid,
      error: 'Checksum EAN-13 invalido'
    }
  }

  // Format: 20 + PLU(4) + FLAG(1) + WEIGHT(5) + CHECK(1)
  // Alternate format also exists with PLU(5).
  const pluRaw = rawCode.substring(2, 6)
  const flag = rawCode.substring(6, 7)
  const weightRaw = rawCode.substring(7, 12)
  const pluRawExtended = rawCode.substring(2, 7)

  const plu = pluRaw.replace(/^0+/, '') || '0'
  const pluExtended = pluRawExtended.replace(/^0+/, '') || '0'

  const weightGrams = parseInt(weightRaw, 10)
  const weight = weightGrams / 1000

  if (process.env.NODE_ENV === 'development') {
    console.log('[barcode-parser] Parsed code:', {
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
    rawCode,
    checksumValid
  }
}

/**
 * Parses non-EAN formats (Code128, etc.).
 */
export function parseGenericBarcode(code: string): BarcodeResult {
  const rawCode = code.trim()

  if (/^\d{13}$/.test(rawCode)) {
    return parseBarcodeEAN13(rawCode)
  }

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
 * Formats weight with 3 decimals.
 */
export function formatWeight(weight: number | null): string {
  if (weight === null) return '-'
  return `${weight.toFixed(3)} kg`
}

/**
 * Produces PLU variants used in DB lookup.
 */
export function getPLUVariants(plu: string): string[] {
  const variants: string[] = [plu]

  if (plu.length < 4) {
    variants.push(plu.padStart(4, '0'))
  }

  const withoutLeadingZeros = plu.replace(/^0+/, '')
  if (withoutLeadingZeros !== plu && withoutLeadingZeros.length > 0) {
    variants.push(withoutLeadingZeros)
  }

  return [...new Set(variants)]
}
