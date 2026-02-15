import { NextResponse } from 'next/server'
import { AI_CAPABILITY_REGISTRY } from '@/lib/ai/capability-registry'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: Object.values(AI_CAPABILITY_REGISTRY),
  })
}

