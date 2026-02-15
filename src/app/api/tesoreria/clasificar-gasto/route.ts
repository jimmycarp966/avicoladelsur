import { NextRequest, NextResponse } from 'next/server'
import { POST as legacyPOST } from '@/app/api/ia/clasificar-gasto/route'

/**
 * POST /api/tesoreria/clasificar-gasto
 * Ruta canonica para clasificacion de gastos.
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
