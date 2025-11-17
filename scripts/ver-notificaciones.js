const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function verNotificaciones() {
  console.log('\n🔔 NOTIFICACIONES DEL SISTEMA:\n')
  
  const { data: notificaciones } = await supabase
    .from('notificaciones')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!notificaciones || notificaciones.length === 0) {
    console.log('No hay notificaciones aún.\n')
    console.log('Haz un pedido desde WhatsApp para crear una.\n')
  } else {
    notificaciones.forEach(n => {
      const emoji = n.leida ? '✓' : '●'
      console.log(`${emoji} ${n.tipo.toUpperCase()}`)
      console.log(`  ${n.titulo}`)
      console.log(`  ${n.mensaje}`)
      console.log(`  ${new Date(n.created_at).toLocaleString()}`)
      if (n.datos) {
        console.log(`  Datos:`, JSON.parse(JSON.stringify(n.datos)))
      }
      console.log('')
    })
  }
}

verNotificaciones()

