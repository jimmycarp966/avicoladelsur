import { getPLUVariants, parseBarcodeEAN13 } from "./barcode-parser"

export interface BarcodeLookupCandidates {
  barcodeCandidates: string[]
  productCodeCandidates: string[]
}

function pushUnique(target: string[], value: string | null | undefined): void {
  if (!value) return
  if (!target.includes(value)) {
    target.push(value)
  }
}

function addNumericVariants(target: string[], code: string): void {
  for (const variant of getPLUVariants(code)) {
    pushUnique(target, variant)
  }
}

/**
 * Builds deterministic lookup candidates for barcode and product-code search.
 * Order matters and is preserved to keep query behavior predictable.
 */
export function buildBarcodeLookupCandidates(scannedCode: string): BarcodeLookupCandidates {
  const input = scannedCode.trim()
  const barcodeCandidates: string[] = []
  const productCodeCandidates: string[] = []

  if (!input) {
    return { barcodeCandidates, productCodeCandidates }
  }

  // 1) Always try exact barcode first.
  pushUnique(barcodeCandidates, input)

  const isNumeric = /^\d+$/.test(input)

  // 2) If EAN-13 variable-weight, prioritize PLU and extended PLU variants.
  if (/^\d{13}$/.test(input)) {
    const parsed = parseBarcodeEAN13(input)

    if (parsed.isWeightCode && parsed.isValid) {
      if (parsed.plu) {
        addNumericVariants(productCodeCandidates, parsed.plu)
      }
      if (parsed.pluExtended) {
        addNumericVariants(productCodeCandidates, parsed.pluExtended)
      }
      return { barcodeCandidates, productCodeCandidates }
    }
  }

  // 3) Generic fallback for direct product code scans.
  if (isNumeric) {
    addNumericVariants(productCodeCandidates, input)
  } else {
    pushUnique(productCodeCandidates, input)
  }

  return { barcodeCandidates, productCodeCandidates }
}
