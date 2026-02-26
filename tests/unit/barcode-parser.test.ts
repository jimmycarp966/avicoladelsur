import assert from "node:assert/strict"
import { parseBarcodeEAN13, validateEAN13 } from "../../src/lib/barcode-parser"

let failed = false

function runTest(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    failed = true
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

function buildEan13FromBase(base12: string): string {
  assert.equal(base12.length, 12, "base12 must have 12 digits")
  assert.match(base12, /^\d{12}$/)

  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(base12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return `${base12}${checkDigit}`
}

runTest("parse standard valid EAN-13", () => {
  const code = buildEan13FromBase("123456789012")
  const parsed = parseBarcodeEAN13(code)

  assert.equal(validateEAN13(code), true)
  assert.equal(parsed.isValid, true)
  assert.equal(parsed.isWeightCode, false)
  assert.equal(parsed.plu, code)
  assert.equal(parsed.weight, null)
  assert.equal(parsed.checksumValid, true)
})

runTest("reject standard EAN-13 with invalid checksum", () => {
  const valid = buildEan13FromBase("123456789012")
  const invalid = `${valid.slice(0, 12)}${valid[12] === "9" ? "0" : "9"}`
  const parsed = parseBarcodeEAN13(invalid)

  assert.equal(parsed.isValid, false)
  assert.equal(parsed.isWeightCode, false)
  assert.equal(parsed.plu, invalid)
  assert.equal(parsed.checksumValid, false)
  assert.match(parsed.error ?? "", /Checksum/i)
})

runTest("parse valid variable-weight code", () => {
  const code = buildEan13FromBase("200148011650")
  const parsed = parseBarcodeEAN13(code)

  assert.equal(parsed.isValid, true)
  assert.equal(parsed.isWeightCode, true)
  assert.equal(parsed.plu, "148")
  assert.equal(parsed.pluExtended, "1480")
  assert.equal(parsed.weight, 11.65)
  assert.equal(parsed.checksumValid, true)
})

runTest("reject variable-weight code with invalid checksum", () => {
  const valid = buildEan13FromBase("200148011650")
  const invalid = `${valid.slice(0, 12)}${valid[12] === "9" ? "0" : "9"}`
  const parsed = parseBarcodeEAN13(invalid)

  assert.equal(parsed.isWeightCode, true)
  assert.equal(parsed.isValid, false)
  assert.equal(parsed.plu, null)
  assert.equal(parsed.weight, null)
  assert.equal(parsed.checksumValid, false)
  assert.match(parsed.error ?? "", /Checksum/i)
})

if (failed) {
  process.exitCode = 1
}
