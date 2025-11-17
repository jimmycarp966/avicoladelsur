#!/usr/bin/env node
/**
 * Script rápido para verificar que el bot esté listo
 * Uso: node scripts/verificar-bot.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verificar() {
  console.log('🔍 Verificando configuración del bot...\n')

  const checks = []

  // 1. Clientes
  const { data: clientes } = await supabase.from('clientes').select('id, nombre, whatsapp').eq('activo', true).limit(5)
  checks.push({
    nombre: 'Clientes',
    ok: clientes && clientes.length > 0,
    mensaje: clientes ? `${clientes.length} clientes encontrados` : 'No hay clientes',
    ejemplo: clientes?.[0] ? `${clientes[0].nombre} (${clientes[0].whatsapp})` : null
  })

  // 2. Productos
  const { data: productos } = await supabase.from('productos').select('id, codigo, nombre').eq('activo', true).limit(5)
  checks.push({
    nombre: 'Productos',
    ok: productos && productos.length > 0,
    mensaje: productos ? `${productos.length} productos encontrados` : 'No hay productos',
    ejemplo: productos?.[0] ? `[${productos[0].codigo}] ${productos[0].nombre}` : null
  })

  // 3. Variables de entorno
  checks.push({
    nombre: 'Supabase URL',
    ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    mensaje: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configurada' : 'Falta configurar'
  })

  checks.push({
    nombre: 'Supabase Key',
    ok: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    mensaje: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configurada' : 'Falta configurar'
  })

  // Mostrar resultados
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  checks.forEach(check => {
    console.log(`${check.ok ? '✅' : '❌'} ${check.nombre}: ${check.mensaje}`)
    if (check.ejemplo) console.log(`   Ejemplo: ${check.ejemplo}`)
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const allOk = checks.every(c => c.ok)
  if (allOk) {
    console.log('🎉 ¡Todo listo! Puedes continuar con la configuración de Botpress y Twilio.\n')
    console.log('📖 Lee GUIA-CONFIGURACION-BOT.md para los siguientes pasos.\n')
  } else {
    console.log('⚠️  Hay configuraciones pendientes. Revisa los errores arriba.\n')
  }
}

verificar().catch(console.error)

