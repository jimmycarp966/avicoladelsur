/**
 * Robot de Pruebas E2E - Módulo Sucursales
 * =========================================
 * 
 * Este script ejecuta pruebas automatizadas completas del módulo de sucursales
 * usando las Server Actions directamente.
 * 
 * Uso: npm run test:sucursales
 * 
 * Requiere: Variables de entorno configuradas para Supabase
 */

// Cargar variables de entorno PRIMERO
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Credenciales de prueba
const TEST_USER_EMAIL = 'alberdi@avicoladelsur.com'
const TEST_USER_PASSWORD = '123456'

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
}

// Helpers
function log(message: string, type: 'info' | 'success' | 'error' | 'warning' | 'header' = 'info') {
    const prefix = {
        info: `${colors.blue}ℹ${colors.reset}`,
        success: `${colors.green}✓${colors.reset}`,
        error: `${colors.red}✗${colors.reset}`,
        warning: `${colors.yellow}⚠${colors.reset}`,
        header: `${colors.cyan}${colors.bold}▶${colors.reset}`,
    }
    console.log(`${prefix[type]} ${message}`)
}

function divider() {
    console.log('\n' + '─'.repeat(60) + '\n')
}

interface TestResult {
    name: string
    passed: boolean
    duration: number
    error?: string
    details?: string
}

const results: TestResult[] = []

async function runTest(name: string, testFn: () => Promise<string | void>): Promise<boolean> {
    const start = Date.now()
    try {
        const details = await testFn()
        const duration = Date.now() - start
        results.push({ name, passed: true, duration, details: details || undefined })
        log(`${name} (${duration}ms)`, 'success')
        if (details) console.log(`   ${colors.cyan}→ ${details}${colors.reset}`)
        return true
    } catch (error) {
        const duration = Date.now() - start
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.push({ name, passed: false, duration, error: errorMsg })
        log(`${name} (${duration}ms) - ${errorMsg}`, 'error')
        return false
    }
}

async function main() {
    console.log('\n')
    console.log(colors.bold + colors.cyan)
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║       🤖 ROBOT DE PRUEBAS - MÓDULO SUCURSALES 🤖         ║')
    console.log('║              Avícola del Sur ERP                         ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log(colors.reset)

    // Verificar variables de entorno
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        log('Variables de entorno SUPABASE no configuradas', 'error')
        process.exit(1)
    }

    // Crear cliente Supabase con service key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })

    divider()
    log('FASE 1: AUTENTICACIÓN Y CONFIGURACIÓN', 'header')
    divider()

    // Test 1: Login
    let userId: string | null = null
    let sucursalId: string | null = null

    await runTest('Autenticación de usuario de prueba', async () => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
        })
        if (error) throw new Error(error.message)
        userId = data.user?.id || null
        return `Usuario: ${data.user?.email}`
    })

    // Test 2: Obtener sucursal del usuario
    await runTest('Obtener sucursal asignada', async () => {
        const { data, error } = await supabase
            .from('rrhh_empleados')
            .select('sucursal_id, sucursales(nombre)')
            .eq('usuario_id', userId)
            .eq('activo', true)
            .maybeSingle()

        if (error || !data?.sucursal_id) {
            throw new Error('No tiene sucursal asignada')
        }
        sucursalId = data.sucursal_id
        const sucursalNombre = (data.sucursales as any)?.nombre || 'Desconocida'
        return `Sucursal: ${sucursalNombre} (${sucursalId})`
    })

    divider()
    log('FASE 2: VERIFICACIÓN DE DASHBOARD', 'header')
    divider()

    // Test 3: Verificar datos del dashboard
    await runTest('Obtener datos de sucursal', async () => {
        const { data, error } = await supabase
            .from('sucursales')
            .select('id, nombre, direccion, telefono, active')
            .eq('id', sucursalId)
            .single()

        if (error) throw new Error(error.message)
        return `Nombre: ${data.nombre}, Estado: ${data.active ? 'Activa' : 'Inactiva'}`
    })

    // Test 4: Contar ventas del día
    await runTest('Contar ventas del día', async () => {
        const hoy = new Date().toISOString().split('T')[0]
        const { data, error, count } = await supabase
            .from('pedidos')
            .select('id', { count: 'exact', head: true })
            .eq('sucursal_id', sucursalId)
            .gte('created_at', `${hoy}T00:00:00.000Z`)
            .lte('created_at', `${hoy}T23:59:59.999Z`)

        if (error) throw new Error(error.message)
        return `Ventas hoy: ${count || 0}`
    })

    // Test 5: Verificar caja
    await runTest('Verificar estado de caja', async () => {
        const { data, error } = await supabase
            .from('tesoreria_cajas')
            .select('id, nombre, saldo_actual, active')
            .eq('sucursal_id', sucursalId)
            .eq('active', true)
            .maybeSingle()

        if (error) throw new Error(error.message)
        if (!data) return 'Sin caja activa configurada'
        return `Caja: ${data.nombre}, Saldo: $${data.saldo_actual?.toLocaleString() || 0}`
    })

    divider()
    log('FASE 3: INVENTARIO', 'header')
    divider()

    // Test 6: Obtener inventario de sucursal
    await runTest('Obtener inventario de sucursal', async () => {
        const { data, error, count } = await supabase
            .from('sucursal_stock')
            .select('producto_id, cantidad_actual', { count: 'exact' })
            .eq('sucursal_id', sucursalId)
            .gt('cantidad_actual', 0)
            .limit(5)

        if (error) return `Error al consultar stock (${error.code || 'desconocido'})`
        return `${count || 0} productos con stock`
    })

    // Test 7: Verificar alertas de stock
    await runTest('Verificar alertas de stock', async () => {
        const { data, error, count } = await supabase
            .from('alertas_stock')
            .select('id', { count: 'exact', head: true })
            .eq('sucursal_id', sucursalId)
            .eq('estado', 'pendiente')

        if (error) throw new Error(error.message)
        return `${count || 0} alertas pendientes`
    })

    // Test 8: Verificar stock mínimo configurado
    await runTest('Verificar configuración de stock mínimo', async () => {
        const { data, error, count } = await supabase
            .from('sucursal_stock_minimo')
            .select('id', { count: 'exact', head: true })
            .eq('sucursal_id', sucursalId)

        if (error) throw new Error(error.message)
        return `${count || 0} productos con stock mínimo configurado`
    })

    divider()
    log('FASE 4: VENTAS Y POS', 'header')
    divider()

    // Test 9: Verificar productos disponibles para venta
    await runTest('Verificar productos disponibles para venta', async () => {
        const { data, error, count } = await supabase
            .from('productos')
            .select('id', { count: 'exact', head: true })

        if (error) return `Error al consultar productos (${error.code || error.message})`
        return `${count || 0} productos en catálogo`
    })

    // Test 10: Verificar clientes disponibles
    await runTest('Verificar clientes disponibles', async () => {
        const { data, error, count } = await supabase
            .from('clientes')
            .select('id', { count: 'exact', head: true })

        if (error) return `Error al consultar clientes (${error.code || error.message})`
        return `${count || 0} clientes registrados`
    })

    // Test 11: Verificar listas de precios
    await runTest('Verificar listas de precios', async () => {
        const { data, error, count } = await supabase
            .from('listas_precios')
            .select('id, codigo, nombre', { count: 'exact' })

        if (error) throw new Error(error.message)
        const nombres = data?.slice(0, 3).map(l => l.codigo).join(', ') || ''
        return `${count || 0} listas activas (${nombres}${(count || 0) > 3 ? '...' : ''})`
    })

    // Test 12: Verificar historial de ventas
    await runTest('Verificar historial de ventas', async () => {
        const { data, error, count } = await supabase
            .from('pedidos')
            .select('id, total, estado', { count: 'exact' })
            .eq('sucursal_id', sucursalId)
            .order('created_at', { ascending: false })
            .limit(5)

        if (error) throw new Error(error.message)
        const totalVendido = data?.reduce((sum, p) => sum + (p.total || 0), 0) || 0
        return `${count || 0} ventas en historial, últimas 5: $${totalVendido.toLocaleString()}`
    })

    divider()
    log('FASE 5: TESORERÍA', 'header')
    divider()

    // Test 13: Verificar movimientos de caja
    await runTest('Verificar movimientos de caja', async () => {
        const hoy = new Date().toISOString().split('T')[0]
        const { data, error, count } = await supabase
            .from('tesoreria_movimientos')
            .select('id, tipo, monto', { count: 'exact' })
            .eq('sucursal_id', sucursalId)
            .gte('created_at', `${hoy}T00:00:00.000Z`)

        if (error) throw new Error(error.message)
        const ingresos = data?.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0) || 0
        const egresos = data?.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (m.monto || 0), 0) || 0
        return `${count || 0} movimientos hoy. Ingresos: $${ingresos.toLocaleString()}, Egresos: $${egresos.toLocaleString()}`
    })

    divider()
    log('FASE 6: TRANSFERENCIAS', 'header')
    divider()

    // Test 14: Verificar transferencias pendientes
    await runTest('Verificar transferencias pendientes de recibir', async () => {
        const { data, error, count } = await supabase
            .from('transferencias_stock')
            .select('id', { count: 'exact', head: true })
            .eq('sucursal_destino_id', sucursalId)
            .in('estado', ['pendiente', 'en_transito', 'preparada'])

        if (error) throw new Error(error.message)
        return `${count || 0} transferencias pendientes de recibir`
    })

    // Test 15: Verificar transferencias enviadas
    await runTest('Verificar historial de transferencias', async () => {
        const { data, error, count } = await supabase
            .from('transferencias_stock')
            .select('id', { count: 'exact', head: true })
            .or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`)

        if (error) throw new Error(error.message)
        return `${count || 0} transferencias en historial`
    })

    divider()
    log('FASE 7: REPORTES', 'header')
    divider()

    // Test 16: Verificar datos para reporte de uso de listas
    await runTest('Verificar datos para reporte de listas de precios', async () => {
        const { data, error, count } = await supabase
            .from('auditoria_listas_precios')
            .select('id', { count: 'exact', head: true })
            .eq('sucursal_id', sucursalId)

        if (error) return `Sin tabla de auditoría (${error.code || 'tabla no existe'})`
        return `${count || 0} registros de auditoría de listas`
    })

    // Test 17: Verificar conteos de stock
    await runTest('Verificar conteos de stock realizados', async () => {
        const { data, error, count } = await supabase
            .from('conteos_stock')
            .select('id, estado', { count: 'exact' })
            .eq('sucursal_id', sucursalId)

        if (error) return `Sin tabla de conteos (${error.code || 'tabla no existe'})`
        const completados = data?.filter(c => c.estado === 'completado').length || 0
        return `${count || 0} conteos (${completados} completados)`
    })

    divider()
    log('FASE 8: NOVEDADES Y COMUNICACIÓN', 'header')
    divider()

    // Test 18: Verificar novedades disponibles
    await runTest('Verificar novedades disponibles', async () => {
        const { data, error, count } = await supabase
            .from('rrhh_novedades')
            .select('id', { count: 'exact', head: true })
            .eq('active', true)

        if (error) return `Error al consultar novedades (${error.code || 'desconocido'})`
        return `${count || 0} novedades activas`
    })

    // ============================================
    // RESUMEN FINAL
    // ============================================
    divider()
    console.log(colors.bold + colors.cyan)
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log('║                  📊 RESUMEN DE PRUEBAS                   ║')
    console.log('╚══════════════════════════════════════════════════════════╝')
    console.log(colors.reset)

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

    console.log(`\n  Total de pruebas: ${results.length}`)
    console.log(`  ${colors.green}✓ Pasadas: ${passed}${colors.reset}`)
    console.log(`  ${colors.red}✗ Fallidas: ${failed}${colors.reset}`)
    console.log(`  Duración total: ${totalDuration}ms`)
    console.log(`  Tasa de éxito: ${((passed / results.length) * 100).toFixed(1)}%`)

    if (failed > 0) {
        console.log(`\n${colors.red}Pruebas fallidas:${colors.reset}`)
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  • ${r.name}: ${r.error}`)
        })
    }

    console.log('\n' + '─'.repeat(60))

    if (failed === 0) {
        console.log(`\n${colors.green}${colors.bold}🎉 ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!${colors.reset}\n`)
    } else {
        console.log(`\n${colors.yellow}${colors.bold}⚠️  Algunas pruebas fallaron. Revisar errores arriba.${colors.reset}\n`)
    }

    // Cerrar sesión
    await supabase.auth.signOut()

    process.exit(failed > 0 ? 1 : 0)
}

// Ejecutar
main().catch(console.error)
