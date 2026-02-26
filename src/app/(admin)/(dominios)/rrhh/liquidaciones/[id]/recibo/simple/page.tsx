import { notFound } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { Liquidacion } from '@/types/domain.types'
import Link from 'next/link'
import { PrintButton } from '../print-button'

const EMPRESA = {
  nombre: 'Avícola del Sur',
}

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString('es-AR')}`
}

function numberToWords(n: number): string {
  const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  if (n === 0) return 'cero'
  if (n < 0) return `menos ${numberToWords(-n)}`

  const floor = Math.floor(n)
  let result = ''

  if (floor >= 1000000) {
    const mill = Math.floor(floor / 1000000)
    result += mill === 1 ? 'un millón ' : `${numberToWords(mill)} millones `
  }

  const resto = floor % 1000000

  if (resto >= 1000) {
    const miles = Math.floor(resto / 1000)
    result += miles === 1 ? 'mil ' : `${numberToWords(miles)} mil `
  }

  const restoMiles = resto % 1000

  if (restoMiles >= 100) {
    const c = Math.floor(restoMiles / 100)
    const r = restoMiles % 100
    if (r === 0) {
      result += c === 1 ? 'cien ' : `${centenas[c]} `
    } else {
      result += `${centenas[c]} `
    }
  }

  const restoC = restoMiles % 100

  if (restoC > 0) {
    if (restoC < 20) {
      result += `${unidades[restoC]} `
    } else {
      const d = Math.floor(restoC / 10)
      const u = restoC % 10
      if (u === 0) {
        result += `${decenas[d]} `
      } else if (d === 2) {
        result += `veinti${unidades[u]} `
      } else {
        result += `${decenas[d]} y ${unidades[u]} `
      }
    }
  }

  return result.trim()
}

function montoEnLetras(monto: number): string {
  const entero = Math.floor(Math.abs(monto))
  const centavos = Math.round((Math.abs(monto) - entero) * 100)
  let texto = numberToWords(entero)
  texto = texto.charAt(0).toUpperCase() + texto.slice(1)
  if (centavos > 0) {
    return `${texto} pesos con ${centavos}/100`
  }
  return `${texto} pesos`
}

async function getReciboSimpleData(liquidacionId: string) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return null

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === 'admin'
  const db = isAdmin ? adminSupabase : supabase

  const { data: liquidacion, error } = await db
    .from('rrhh_liquidaciones')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        dni,
        cuil,
        nombre,
        apellido,
        usuario:usuarios(id, nombre, apellido)
      )
    `)
    .eq('id', liquidacionId)
    .maybeSingle()

  if (error || !liquidacion) return null
  return liquidacion as Liquidacion
}

export const dynamic = 'force-dynamic'

export default async function ReciboSimplePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const liquidacion = await getReciboSimpleData(id)

  if (!liquidacion) notFound()

  const empleado = liquidacion.empleado
  const nombreEmpleado =
    `${empleado?.usuario?.nombre || empleado?.nombre || ''} ${empleado?.usuario?.apellido || empleado?.apellido || ''}`.trim() ||
    'Empleado sin nombre'

  const periodo = `${String(liquidacion.periodo_mes).padStart(2, '0')}/${liquidacion.periodo_anio}`
  const totalNeto = liquidacion.total_neto || 0
  const enLetras = montoEnLetras(totalNeto)

  return (
    <>
      {/* Botones de acción — ocultos al imprimir */}
      <div className="print:hidden flex items-center gap-3 p-4 border-b bg-white">
        <Link
          href={`/rrhh/liquidaciones/${id}`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Volver
        </Link>
        <PrintButton className="ml-auto px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 transition-colors">
          Imprimir comprobante
        </PrintButton>
      </div>

      {/* Comprobante — blanco y negro */}
      <div
        className="max-w-2xl mx-auto my-8 print:my-0 print:max-w-full font-mono"
        style={{ fontFamily: 'Courier New, monospace' }}
      >
        <div
          className="border-2 border-black p-6 print:border print:p-4"
          style={{ borderStyle: 'solid' }}
        >
          {/* Encabezado */}
          <div className="text-center border-b-2 border-black pb-3 mb-4">
            <p className="text-sm font-bold uppercase tracking-widest">RECIBÍ DE:</p>
            <p className="text-xl font-bold uppercase">{EMPRESA.nombre}</p>
            <p className="text-sm mt-1">Período: {periodo}</p>
          </div>

          {/* Datos del empleado */}
          <div className="space-y-1 text-sm border-b border-black pb-4 mb-4">
            <div className="flex gap-2">
              <span className="font-bold w-24 shrink-0">Nombre:</span>
              <span className="uppercase font-bold">{nombreEmpleado}</span>
            </div>
            {empleado?.dni && (
              <div className="flex gap-2">
                <span className="font-bold w-24 shrink-0">DNI:</span>
                <span>{empleado.dni}</span>
              </div>
            )}
            {empleado?.cuil && (
              <div className="flex gap-2">
                <span className="font-bold w-24 shrink-0">CUIL:</span>
                <span>{empleado.cuil}</span>
              </div>
            )}
            {empleado?.legajo && (
              <div className="flex gap-2">
                <span className="font-bold w-24 shrink-0">Legajo:</span>
                <span>{empleado.legajo}</span>
              </div>
            )}
          </div>

          {/* Monto */}
          <div className="border-b border-black pb-4 mb-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold uppercase">MONTO NETO:</span>
              <span className="text-2xl font-bold tabular-nums">{formatMoney(totalNeto)}</span>
            </div>
            <p className="text-xs mt-1 text-gray-700">
              (Son pesos: {enLetras})
            </p>
          </div>

          {/* Firma */}
          <div className="mt-8 pt-2">
            <div className="border-t-2 border-black w-2/3 mx-auto pt-2 text-center">
              <p className="text-xs">Firma / Aclaración / DNI</p>
            </div>
          </div>

          {/* Pie */}
          <p className="text-[10px] text-center text-gray-500 mt-6 print:text-gray-400">
            Liquidación #{id.slice(0, 8).toUpperCase()} — {EMPRESA.nombre}
          </p>
        </div>
      </div>
    </>
  )
}
