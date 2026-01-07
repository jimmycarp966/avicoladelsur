import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const timestamp = new Date().toISOString()
        const { level, message, details, component } = body

        // Estos logs aparecerán en el dashboard de Vercel (Runtime Logs)
        console.log(`[CLIENT-LOG] [${timestamp}] [${component || 'Unknown'}] [${level?.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : '')

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 500 })
    }
}
