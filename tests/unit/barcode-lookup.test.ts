import assert from "node:assert/strict"
import { buildBarcodeLookupCandidates } from "../../src/lib/barcode-lookup"

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
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(base12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const checkDigit = (10 - (sum % 10)) % 10
  return `${base12}${checkDigit}`
}

runTest("prioritize PLU variants for variable-weight code", () => {
  const weightedCode = buildEan13FromBase("200148011650")
  const candidates = buildBarcodeLookupCandidates(weightedCode)

  assert.deepEqual(candidates.barcodeCandidates, [weightedCode])
  assert.deepEqual(candidates.productCodeCandidates, ["148", "0148", "1480"])
})

runTest("generate numeric variants for plain numeric input", () => {
  const candidates = buildBarcodeLookupCandidates("55")

  assert.deepEqual(candidates.barcodeCandidates, ["55"])
  assert.deepEqual(candidates.productCodeCandidates, ["55", "0055"])
})

runTest("keep alphanumeric code as-is", () => {
  const candidates = buildBarcodeLookupCandidates("ABC-01")

  assert.deepEqual(candidates.barcodeCandidates, ["ABC-01"])
  assert.deepEqual(candidates.productCodeCandidates, ["ABC-01"])
})

if (failed) {
  process.exitCode = 1
}
