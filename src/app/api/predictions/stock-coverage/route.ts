import { NextRequest, NextResponse } from 'next/server'
import { POST as legacyPOST } from '@/app/api/ia/prediccion-stock/route'

/**
 * POST /api/predictions/stock-coverage
 * Ruta canonica para prediccion de cobertura de stock.
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
