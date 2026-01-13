/**
 * Tool: Consultar Saldo
 * Permite al agente consultar el saldo pendiente de un cliente
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ConsultarSaldoParams {
  cliente_id: string
}

export interface ConsultarSaldoResult {
  success: boolean
  saldo?: number
  limite_credito?: number
  credito_disponible?: number
  bloqueado?: boolean
  error?: string
}

/**
 * Tool para consultar saldo de cliente desde el bot
 */
export async function consultarSaldoTool(
  params: ConsultarSaldoParams
): Promise<ConsultarSaldoResult> {
  try {
    const supabase = createAdminClient()

    // Obtener información de cuenta corriente del cliente
    const { data: cuenta, error: cuentaError } = await supabase
      .from('cuentas_corriente')
      .select('saldo, limite_credito, bloqueado')
      .eq('cliente_id', params.cliente_id)
      .single()

    if (cuentaError && cuentaError.code !== 'PGRST116') {
      console.error('[Tool: Consultar Saldo] Error:', cuentaError)
      return {
        success: false,
        error: 'Error al consultar saldo: ' + cuentaError.message
      }
    }

    const saldo = cuenta?.saldo || 0
    const limiteCredito = cuenta?.limite_credito || 0
    const creditoDisponible = limiteCredito - saldo
    const bloqueado = cuenta?.bloqueado || false

    return {
      success: true,
      saldo,
      limite_credito: limiteCredito,
      credito_disponible: creditoDisponible,
      bloqueado
    }
  } catch (error) {
    console.error('[Tool: Consultar Saldo] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const consultarSaldoToolDefinition = {
  name: 'consultar_saldo',
  description: 'Consulta el saldo pendiente y crédito disponible de un cliente',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: {
        type: 'string',
        description: 'ID del cliente en la base de datos'
      }
    },
    required: ['cliente_id']
  }
}
