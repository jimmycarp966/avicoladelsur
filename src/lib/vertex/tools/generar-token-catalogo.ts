/**
 * Tool: Generar Token Catálogo
 * Permite al agente generar un link autenticado para el catálogo web
 */

export interface GenerarTokenCatalogoParams {
  telefono: string
}

export interface GenerarTokenCatalogoResult {
  success: boolean
  url?: string
  token?: string
  message?: string
  error?: string
}

/**
 * Tool para generar un link autenticado del catálogo
 */
export async function generarTokenCatalogoTool(
  params: GenerarTokenCatalogoParams
): Promise<GenerarTokenCatalogoResult> {
  try {
    // Validar teléfono
    if (!params.telefono || params.telefono.length < 10) {
      return {
        success: false,
        error: 'El teléfono debe tener al menos 10 dígitos'
      }
    }

    // Llamar al endpoint interno para generar el token
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://avicoladelsur.vercel.app'
    const response = await fetch(`${baseUrl}/api/catalogo/auth/generar-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono: params.telefono })
    })

    if (!response.ok) {
      return {
        success: false,
        error: 'Error al generar el link de catálogo'
      }
    }

    const data = await response.json()

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Error al generar el link'
      }
    }

    return {
      success: true,
      url: data.url,
      token: data.token,
      message: `Link generado para ${params.telefono}. Válido por 24hs.`
    }

  } catch (error) {
    console.error('[Tool: Generar Token Catálogo] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const generarTokenCatalogoToolDefinition = {
  name: 'generar_token_catalogo',
  description:
    'Genera un link autenticado para el catálogo web. Úsalo cuando el cliente quiera ver productos y precios. El link incluye un token válido por 24hs que permite acceder al catálogo y crear pedidos.',
  parameters: {
    type: 'object',
    properties: {
      telefono: {
        type: 'string',
        description: 'Número de teléfono del cliente (con código de país, ej: 5491112345678)'
      }
    },
    required: ['telefono']
  }
}
