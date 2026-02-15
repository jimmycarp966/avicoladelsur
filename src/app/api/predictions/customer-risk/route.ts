import { NextRequest, NextResponse } from 'next/server'
import { GET as legacyGET } from '@/app/api/ia/clientes-riesgo/route'

/**
 * GET /api/predictions/customer-risk
 * Ruta canonica para clientes en riesgo.
 */
export async function GET(request: NextRequest) {
  const legacyResponse = await legacyGET(request)
  const body = await legacyResponse.json()

  if (body?.ai) {
    body.ai.deprecated = false
    body.ai.deprecatedMessage = undefined
  }

  return NextResponse.json(body, { status: legacyResponse.status })
}
