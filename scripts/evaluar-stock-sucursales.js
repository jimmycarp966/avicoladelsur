#!/usr/bin/env node

/**
 * Script para evaluación automática de stock bajo en sucursales
 * Uso: node scripts/evaluar-stock-sucursales.js
 * O como script npm: npm run evaluar-stock
 */

const https = require('https')
const http = require('http')

// Configuración
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
const API_ENDPOINT = '/api/sucursales/low-stock-run'

/**
 * Realiza una petición HTTP POST
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }

    const req = protocol.request(url, requestOptions, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            data: JSON.parse(data)
          }
          resolve(response)
        } catch (error) {
          reject(new Error(`Error parsing response: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }

    req.end()
  })
}

/**
 * Función principal
 */
async function main() {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] 🚀 Iniciando evaluación de stock bajo en sucursales...`)

  try {
    const url = `${API_BASE_URL}${API_ENDPOINT}`
    console.log(`📡 Conectando a: ${url}`)

    const response = await makeRequest(url)

    if (response.status === 200 && response.data.success) {
      const { totalAlertas, resultados } = response.data.data

      console.log(`✅ Evaluación completada exitosamente`)
      console.log(`📊 Total de alertas creadas: ${totalAlertas}`)
      console.log(`📋 Detalle por sucursal:`)

      resultados.forEach(resultado => {
        const icon = resultado.exito ? '✅' : '❌'
        const status = resultado.exito ? 'OK' : 'ERROR'
        console.log(`  ${icon} ${resultado.sucursal}: ${resultado.alertas} alertas (${status})`)

        if (!resultado.exito && resultado.error) {
          console.log(`    ⚠️  Error: ${resultado.error}`)
        }
      })

      console.log(`[${new Date().toISOString()}] 🎉 Proceso completado`)
      process.exit(0)

    } else {
      console.error(`❌ Error en la evaluación:`, response.data?.error || 'Error desconocido')
      process.exit(1)
    }

  } catch (error) {
    console.error(`💥 Error ejecutando evaluación:`, error.message)
    process.exit(1)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
}

module.exports = { main }
