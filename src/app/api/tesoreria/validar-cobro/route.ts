import { NextRequest, NextResponse } from 'next/server'
import { POST as legacyPOST } from '@/app/api/ia/validar-cobro/route'

/**
 * POST /api/tesoreria/validar-cobro
 * Ruta canonica para validacion de cobros.
 */
export async function POST(request: NextRequest) {
  const legacyResponse = await legacyPOST(request)
  const body = await legacyResponse.json()

  if (body?.ai) {
    body.ai.deprecated = false
    body.ai.deprecatedMessage = undefined
  }

  return NextResponse.json(body, { status: legacyResponse.status })
}
