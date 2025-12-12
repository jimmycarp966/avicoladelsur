#!/usr/bin/env node
/**
 * Script para actualizar límite de crédito de clientes a $1.000.000
 * 
 * Uso: node scripts/actualizar-limite-credito-clientes.js
 * 
 * Requisitos:
 * - Variables de entorno configuradas en .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 
 * Funcionalidad:
 * - Lee lista de clientes (mismos que se geocodificaron)
 * - Busca cada cliente por código en la base de datos
 * - Actualiza limite_credito a 1.000.000 en tabla clientes
 * - Actualiza limite_credito en tabla cuentas_corrientes si existe
 * - Genera log detallado en consola y archivo
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
require('dotenv').config({ path: '.env.local' })

// ============================================
// CONFIGURACIÓN
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const LIMITE_CREDITO = 1000000 // $1.000.000

// ============================================
// LISTA DE CLIENTES A PROCESAR (mismos que geocodificación)
// ============================================

const clientesAProcesar = [
  { codigo: '2', nombre: 'HORQUETA (P)' },
  { codigo: '3', nombre: 'SAN MARTIN (P)' },
  { codigo: '4', nombre: 'ALBERDI (P)' },
  { codigo: '101', nombre: 'ALICIA VAQUERA' },
  { codigo: '102', nombre: 'SOLEDAD ORELLANA' },
  { codigo: '103', nombre: 'PAOLA ARDILES' },
  { codigo: '104', nombre: 'POLLERIA MONTEAGUDO' },
  { codigo: '107', nombre: 'ALMENDRA' },
  { codigo: '110', nombre: 'WALTER NIEVA' },
  { codigo: '116', nombre: 'POLLERIA LA 5TA' },
  { codigo: '123', nombre: 'POLLERIA ENZO' },
  { codigo: '124', nombre: 'POLLERIA LA GRINGA' },
  { codigo: '125', nombre: 'EMILIA MARKET' },
  { codigo: '126', nombre: 'CARLOS CORONEL' },
  { codigo: '129', nombre: 'ALE FERNANDEZ' },
  { codigo: '134', nombre: 'POLLERIA LA PATRONA' },
  { codigo: '137', nombre: 'LEO KISI' },
  { codigo: '139', nombre: 'BAR SCARAMANZIA' },
  { codigo: '140', nombre: 'BETO CORREA' },
  { codigo: '143', nombre: 'POLLERIA AMERICO PAEZ' },
  { codigo: '146', nombre: 'POLLERIA MONZON' },
  { codigo: '149', nombre: 'CRISTIAN COSTILLA' },
  { codigo: '159', nombre: 'POLLERIA JUAREZ' },
  { codigo: '160', nombre: 'MIMI ORELLANA' },
  { codigo: '161', nombre: 'FRANCO CORREA' },
  { codigo: '164', nombre: 'ROSA VILLAGRA' },
  { codigo: '167', nombre: 'JUAN NIEVA' },
  { codigo: '169', nombre: 'PANADERIA DAVID' },
  { codigo: '173', nombre: 'POLLERIA LA ARGENTINA' },
  { codigo: '174', nombre: 'DARIO PAEZ' },
  { codigo: '176', nombre: 'POLLERIA TOMASITO' },
  { codigo: '184', nombre: 'MARTIN ELIAS' },
  { codigo: '187', nombre: 'MONICA NUÑEZ' },
  { codigo: '188', nombre: 'BAR FIKA (MONTEROS)' },
  { codigo: '189', nombre: 'DESPENSA E Y F' },
  { codigo: '195', nombre: 'POLLERIA LA 24' },
  { codigo: '197', nombre: 'JUAN JOSE OLEA' },
  { codigo: '209', nombre: 'LA PORTEÑA' },
  { codigo: '216', nombre: 'GUSTAVO OLEA' },
  { codigo: '218', nombre: 'ROBERTO ARGAÑARAZ' },
  { codigo: '221', nombre: 'OMAR FERNANDEZ' },
  { codigo: '228', nombre: 'VALERIA ALBORNOZ' },
  { codigo: '230', nombre: 'LUCAS LOPEZ' },
  { codigo: '232', nombre: 'MAIRA CORONEL' },
  { codigo: '246', nombre: 'POLLERIA BMP' },
  { codigo: '248', nombre: 'MANUELA MEDINA' },
  { codigo: '253', nombre: 'POLLERIA J Y E' },
  { codigo: '254', nombre: 'POLLERIA TETE' },
  { codigo: '261', nombre: 'GOMEZ ENRIQUE' },
  { codigo: '263', nombre: 'NORMA GAUNA' },
  { codigo: '266', nombre: 'SILVIA GONZALES' },
  { codigo: '275', nombre: 'POLLERIA JD' },
  { codigo: '278', nombre: 'ELINA ALBORNOZ' },
  { codigo: '280', nombre: 'PUNTO TINCHO' },
  { codigo: '286', nombre: 'JEREZ ROSA' },
  { codigo: '290', nombre: 'ARIEL ALDERETE' },
  { codigo: '291', nombre: 'VALERIA JIMENEZ' },
  { codigo: '296', nombre: 'OPEN24HS' },
  { codigo: '297', nombre: 'IVANA NORRY' },
  { codigo: '298', nombre: 'ANTONIA PONCE' },
  { codigo: '301', nombre: 'MARTIN NORRY' },
  { codigo: '304', nombre: 'JONATAN FIGUEROA' },
  { codigo: '318', nombre: 'NANCY TEJEDA' },
  { codigo: '323', nombre: 'ALICIA GALVAN' },
  { codigo: '324', nombre: 'ARROYO RODOLFO' },
  { codigo: '329', nombre: 'MARIA JOSE CASTILLO' },
  { codigo: '343', nombre: 'HUGO SALES' },
  { codigo: '345', nombre: 'DESPENSA PEDRO' },
  { codigo: '348', nombre: 'SUPER CARNES FREDY' },
  { codigo: '352', nombre: 'DESPENSA DOÑA RAMONA' },
  { codigo: '353', nombre: 'CASINO RITZ' },
  { codigo: '354', nombre: 'LUIS NADAL' },
  { codigo: '361', nombre: 'MERCEDES MANCA (KIOSCO LA TUCU)' },
  { codigo: '366', nombre: 'KARINA TREJO' },
  { codigo: '389', nombre: 'LUIS HERRERA' },
  { codigo: '392', nombre: 'TOMAS GIMENEZ' },
  { codigo: '396', nombre: 'WALTER CADONI' },
  { codigo: '407', nombre: 'POLLERIA EL PACARA' },
  { codigo: '418', nombre: 'MARIA MANSILLA' },
  { codigo: '434', nombre: 'CARNICERIA EL PORTEÑO' },
  { codigo: '436', nombre: 'POLLERIA TOLEDO' },
  { codigo: '438', nombre: 'CLUB MONTEROS VOLEY' },
  { codigo: '447', nombre: 'FRANCO VAQUERA' },
  { codigo: '459', nombre: 'PABLO HEREDIA' },
  { codigo: '460', nombre: 'MARIA JIMENA MOLINA' },
  { codigo: '461', nombre: 'POLLERIA COMERCIAL' },
  { codigo: '473', nombre: 'IVAN SORIA' },
  { codigo: '483', nombre: 'MARIA NIETO' },
  { codigo: '484', nombre: 'JOSE MIGUEL LLORENS' },
  { codigo: '490', nombre: 'POLLERIA JYE' },
  { codigo: '492', nombre: 'POLLERIA DEL VALLE' },
  { codigo: '494', nombre: 'MARIELA MEDINA' },
  { codigo: '498', nombre: 'ZOZINE SILVIA' },
  { codigo: '506', nombre: 'RAUL NUÑEZ' },
  { codigo: '508', nombre: 'CRISTINA ZOZINE' },
  { codigo: '510', nombre: 'RAUL CAYO' },
  { codigo: '527', nombre: 'POLLERIA AVILA' },
  { codigo: '528', nombre: 'POLLERIA MAURICIO' },
  { codigo: '534', nombre: 'DAMIAN HERRERA' },
  { codigo: '551', nombre: 'CARNICERIA HUGO' },
  { codigo: '558', nombre: 'MONONA ORELLANA' },
  { codigo: '560', nombre: 'ROSARIO ALE' },
  { codigo: '562', nombre: 'AZUCENA VILLAGRA (LOLI)' },
  { codigo: '565', nombre: 'MARIA AGUIRRE' },
  { codigo: '567', nombre: 'ANALIA AVILA' },
  { codigo: '575', nombre: 'CARNICERIA SAN TORO' },
  { codigo: '588', nombre: 'AGUSTIN OLEA' },
  { codigo: '589', nombre: 'WALTER DIP' },
  { codigo: '592', nombre: 'DESPENSA EL MELLI' },
  { codigo: '604', nombre: 'BIANCA SALGUERO' },
  { codigo: '605', nombre: 'MAXI LESCANO' },
  { codigo: '608', nombre: 'SUPER CARNES GUILLERMINA' },
  { codigo: '613', nombre: 'IVANA DOMINGUEZ' },
  { codigo: '614', nombre: 'GABRIELA SALAS' },
  { codigo: '624', nombre: 'GUADALUPE CHUMBA' },
  { codigo: '626', nombre: 'ALDO MOYA' },
  { codigo: '630', nombre: 'JESICA ROMANO' },
  { codigo: '631', nombre: 'VERONICA FIGUEROA' },
  { codigo: '634', nombre: 'HERNAN DIAZ' },
  { codigo: '637', nombre: 'BAR DE RODI' },
  { codigo: '640', nombre: 'JESUS RIVADENEIRA' },
  { codigo: '661', nombre: 'MARLEN PERALTA' },
  { codigo: '665', nombre: 'POLLERIA ISABELA' },
  { codigo: '699', nombre: 'WILLIAM FONTEÑO' },
  { codigo: '713', nombre: 'BEATRIZ MOLINA' },
  { codigo: '715', nombre: 'FERNANDA VAQUERA' },
  { codigo: '726', nombre: 'GABRIEL DELGADO' },
  { codigo: '734', nombre: 'NATALIA LAZARTE' },
  { codigo: '750', nombre: 'MINISERVICE URKUPIÑA' },
  { codigo: '752', nombre: 'MARIA QUINTEROS' },
  { codigo: '753', nombre: 'POLLERIA LA NORTEÑITA' },
  { codigo: '761', nombre: 'CLAUDIO TRIPOLONI' },
  { codigo: '762', nombre: 'CARLOS COSTILLA' },
  { codigo: '773', nombre: 'DESPENSA CRIS' },
  { codigo: '776', nombre: 'PATRICIA VELIZ' },
  { codigo: '779', nombre: 'MARCOS EZEQUIEL ORELLANA' },
  { codigo: '781', nombre: 'AZAR MARIA MARCELA' },
  { codigo: '789', nombre: 'GRACIELA GONZALEZ' },
  { codigo: '790', nombre: 'MARTA MOLINA' },
  { codigo: '792', nombre: 'MARU PAEZ' },
]

// ============================================
// UTILIDADES
// ============================================

// Array para acumular logs
const logEntries = []

// Función para loguear con timestamp
function log(mensaje, tipo = 'INFO') {
  const timestamp = new Date().toISOString()
  const linea = `[${timestamp}] [${tipo}] ${mensaje}`
  console.log(linea)
  logEntries.push(linea)
}

// Formatear número con separadores de miles
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

// Buscar cliente por código en la base de datos
async function buscarClientePorCodigo(codigo) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, codigo, nombre, limite_credito')
    .eq('codigo', codigo)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Error al buscar cliente: ${error.message}`)
  }

  return data
}

// Buscar cuenta corriente del cliente
async function buscarCuentaCorriente(clienteId) {
  const { data, error } = await supabase
    .from('cuentas_corrientes')
    .select('id, limite_credito, saldo')
    .eq('cliente_id', clienteId)
    .single()

  if (error && error.code !== 'PGRST116') {
    // Si no existe, no es error, simplemente retornar null
    return null
  }

  return data
}

// Actualizar límite de crédito en cliente
async function actualizarLimiteCliente(clienteId, nuevoLimite) {
  const { error } = await supabase
    .from('clientes')
    .update({
      limite_credito: nuevoLimite,
      updated_at: new Date().toISOString()
    })
    .eq('id', clienteId)

  if (error) {
    throw new Error(`Error al actualizar cliente: ${error.message}`)
  }
}

// Actualizar límite de crédito en cuenta corriente
async function actualizarLimiteCuentaCorriente(cuentaId, nuevoLimite) {
  const { error } = await supabase
    .from('cuentas_corrientes')
    .update({
      limite_credito: nuevoLimite,
      updated_at: new Date().toISOString()
    })
    .eq('id', cuentaId)

  if (error) {
    throw new Error(`Error al actualizar cuenta corriente: ${error.message}`)
  }
}

// Pedir confirmación al usuario
function pedirConfirmacion(mensaje) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => {
    rl.question(mensaje, respuesta => {
      rl.close()
      resolve(respuesta.toLowerCase() === 's' || respuesta.toLowerCase() === 'si')
    })
  })
}

// Guardar log en archivo
function guardarLogEnArchivo() {
  const logsDir = path.join(process.cwd(), 'logs')
  
  // Crear directorio logs si no existe
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = path.join(logsDir, `limite-credito-${timestamp}.log`)
  
  fs.writeFileSync(logPath, logEntries.join('\n'), 'utf8')
  
  return logPath
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  ACTUALIZACIÓN DE LÍMITE DE CRÉDITO - AVÍCOLA DEL SUR')
  console.log('='.repeat(60) + '\n')

  // Validación inicial
  log('Verificando configuración...')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    log('ERROR: NEXT_PUBLIC_SUPABASE_URL no configurada', 'ERROR')
    process.exit(1)
  }

  log(`✅ Supabase configurado: ${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...`)

  // Análisis de clientes a procesar
  log('\nAnalizando clientes a procesar...')
  
  console.log('\n' + '-'.repeat(60))
  console.log(`  Total de clientes en la lista:    ${clientesAProcesar.length}`)
  console.log(`  Límite de crédito a asignar:      ${formatCurrency(LIMITE_CREDITO)}`)
  console.log('-'.repeat(60))

  console.log('\n📍 Clientes que serán actualizados (primeros 10):')
  clientesAProcesar.slice(0, 10).forEach(c => {
    console.log(`   - ${c.codigo}: ${c.nombre}`)
  })
  if (clientesAProcesar.length > 10) {
    console.log(`   ... y ${clientesAProcesar.length - 10} clientes más`)
  }

  console.log('\n' + '-'.repeat(60))
  console.log(`  📝 Se generará log en: logs/limite-credito-{timestamp}.log`)
  console.log('-'.repeat(60) + '\n')

  // Pedir confirmación
  const confirmado = await pedirConfirmacion('¿Deseas continuar con la actualización de límites de crédito? (s/n): ')
  
  if (!confirmado) {
    log('❌ Proceso cancelado por el usuario')
    process.exit(0)
  }

  console.log('\n')
  log('🚀 Iniciando actualización de límites de crédito...\n')

  // Contadores
  const resultados = {
    exitosos: 0,
    soloCliente: 0, // Actualizó solo en clientes (no tenía cuenta corriente)
    noEncontrados: 0,
    errores: []
  }

  // Procesar clientes
  for (let i = 0; i < clientesAProcesar.length; i++) {
    const cliente = clientesAProcesar[i]
    const progreso = `[${i + 1}/${clientesAProcesar.length}]`

    // Buscar cliente en BD
    let clienteBD
    try {
      clienteBD = await buscarClientePorCodigo(cliente.codigo)
    } catch (error) {
      log(`${progreso} ❌ ERROR ${cliente.codigo} - ${cliente.nombre}: ${error.message}`, 'ERROR')
      resultados.errores.push({ codigo: cliente.codigo, error: error.message })
      continue
    }

    if (!clienteBD) {
      log(`${progreso} ⚠️  NO ENCONTRADO ${cliente.codigo} - ${cliente.nombre}: No existe en BD`)
      resultados.noEncontrados++
      continue
    }

    const limiteAnterior = clienteBD.limite_credito || 0

    // Actualizar límite en tabla clientes
    try {
      await actualizarLimiteCliente(clienteBD.id, LIMITE_CREDITO)
    } catch (error) {
      log(`${progreso} ❌ ERROR al actualizar cliente ${cliente.codigo}: ${error.message}`, 'ERROR')
      resultados.errores.push({ codigo: cliente.codigo, error: error.message })
      continue
    }

    // Buscar y actualizar cuenta corriente si existe
    let cuentaCorriente
    try {
      cuentaCorriente = await buscarCuentaCorriente(clienteBD.id)
    } catch (error) {
      log(`${progreso} ⚠️  No se pudo buscar cuenta corriente ${cliente.codigo}: ${error.message}`)
    }

    if (cuentaCorriente) {
      // Actualizar también en cuenta corriente
      try {
        await actualizarLimiteCuentaCorriente(cuentaCorriente.id, LIMITE_CREDITO)
        log(`${progreso} ✅ ÉXITO ${cliente.codigo} - ${cliente.nombre}: ${formatCurrency(limiteAnterior)} → ${formatCurrency(LIMITE_CREDITO)} (cliente + cuenta corriente)`)
        resultados.exitosos++
      } catch (error) {
        log(`${progreso} ⚠️  PARCIAL ${cliente.codigo} - ${cliente.nombre}: Actualizado en cliente pero error en cuenta corriente: ${error.message}`)
        resultados.soloCliente++
      }
    } else {
      // No tiene cuenta corriente, solo se actualizó en clientes
      log(`${progreso} ✅ ÉXITO ${cliente.codigo} - ${cliente.nombre}: ${formatCurrency(limiteAnterior)} → ${formatCurrency(LIMITE_CREDITO)} (solo cliente, sin cuenta corriente)`)
      resultados.soloCliente++
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(60))
  console.log('  RESUMEN DE ACTUALIZACIÓN')
  console.log('='.repeat(60))
  console.log(`  ✅ Exitosos (cliente + cuenta corriente): ${resultados.exitosos}`)
  console.log(`  ✅ Parciales (solo cliente):            ${resultados.soloCliente}`)
  console.log(`  ❓ No encontrados en BD:                ${resultados.noEncontrados}`)
  console.log(`  ❌ Errores:                             ${resultados.errores.length}`)
  console.log('='.repeat(60))

  if (resultados.errores.length > 0) {
    console.log('\n📋 Detalle de errores:')
    resultados.errores.forEach(e => {
      console.log(`   - ${e.codigo}: ${e.error}`)
    })
  }

  // Guardar log
  const logPath = guardarLogEnArchivo()
  console.log(`\n📝 Log guardado en: ${logPath}`)

  console.log('\n✨ Proceso completado.\n')
}

// Ejecutar
main().catch(error => {
  console.error('Error fatal:', error)
  process.exit(1)
})



























