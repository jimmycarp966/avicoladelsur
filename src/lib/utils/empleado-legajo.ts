export function normalizeEmployeeDocumentDigits(value?: string | null): string {
  return String(value ?? '').replace(/\D/g, '')
}

export function buildEmpleadoLegajoFromDni(dni?: string | null): string | undefined {
  const digits = normalizeEmployeeDocumentDigits(dni)
  if (!digits) {
    return undefined
  }

  return `01${digits}`
}
