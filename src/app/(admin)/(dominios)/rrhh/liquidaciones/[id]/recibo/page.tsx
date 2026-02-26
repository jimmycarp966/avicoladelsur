import { notFound } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import type { Liquidacion, LiquidacionDetalle } from '@/types/domain.types'
import { PrintActions } from './print-actions'

type ReciboData = {
  liquidacion: Liquidacion
}

const EMPRESA = {
  nombre: 'Avicola del Sur',
  cuit: '30-12345678-9',
  direccion: 'Av. Principal 123, Tucuman',
}

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString('es-AR')}`
}

function formatDate(date?: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('es-AR')
}

function buildDesglose(detalles: LiquidacionDetalle[]) {
  const haberes = detalles.filter((d) => d.tipo !== 'total_neto' && d.monto > 0)
  const deducciones = detalles.filter((d) => d.tipo !== 'total_neto' && d.monto < 0)
  return { haberes, deducciones }
}

async function getReciboData(liquidacionId: string): Promise<ReciboData | null> {
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
        sucursal:sucursales(id, nombre),
        categoria:rrhh_categorias(id, nombre),
        usuario:usuarios(id, nombre, apellido, email)
      ),
      detalles:rrhh_liquidacion_detalles(*)
    `)
    .eq('id', liquidacionId)
    .maybeSingle()

  if (error || !liquidacion) {
    return null
  }

  return {
    liquidacion: liquidacion as Liquidacion,
  }
}

export const dynamic = 'force-dynamic'

export default async function ReciboLiquidacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getReciboData(id)

  if (!data) notFound()

  const { liquidacion } = data
  const detalles = (liquidacion.detalles || []) as LiquidacionDetalle[]
  const { haberes, deducciones } = buildDesglose(detalles)

  const empleado = liquidacion.empleado
  const nombreEmpleado =
    `${empleado?.usuario?.nombre || empleado?.nombre || ''} ${empleado?.usuario?.apellido || empleado?.apellido || ''}`.trim() ||
    'Empleado sin nombre'

  const periodo = `${String(liquidacion.periodo_mes).padStart(2, '0')}/${liquidacion.periodo_anio}`
  const fechaGeneracion = new Date().toLocaleDateString('es-AR')

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-4">
      <PrintActions
        backHref={`/rrhh/liquidaciones/${liquidacion.id}`}
        simpleHref={`/rrhh/liquidaciones/${liquidacion.id}/recibo/simple`}
      />

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 print:p-2">
          <div className="border-b pb-4 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{EMPRESA.nombre}</h1>
                <p className="text-sm text-muted-foreground">CUIT: {EMPRESA.cuit}</p>
                <p className="text-sm text-muted-foreground">{EMPRESA.direccion}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recibo de sueldo</p>
                <p className="text-sm font-semibold">Periodo: {periodo}</p>
                <p className="text-xs text-muted-foreground">Liquidacion #{liquidacion.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
            <div className="rounded-md border p-3">
              <p><span className="text-muted-foreground">Empleado:</span> <strong>{nombreEmpleado}</strong></p>
              <p><span className="text-muted-foreground">Legajo:</span> {empleado?.legajo || '-'}</p>
              <p><span className="text-muted-foreground">DNI:</span> {empleado?.dni || '-'}</p>
              <p><span className="text-muted-foreground">CUIL:</span> {empleado?.cuil || '-'}</p>
            </div>
            <div className="rounded-md border p-3">
              <p><span className="text-muted-foreground">Categoria:</span> {empleado?.categoria?.nombre || '-'}</p>
              <p><span className="text-muted-foreground">Sucursal:</span> {empleado?.sucursal?.nombre || liquidacion.sucursal_snapshot_nombre || '-'}</p>
              <p><span className="text-muted-foreground">Fecha liquidacion:</span> {formatDate(liquidacion.fecha_liquidacion)}</p>
              <p><span className="text-muted-foreground">Estado:</span> {liquidacion.estado}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide mb-2">Haberes</h2>
              <table className="w-full text-sm border rounded-md overflow-hidden">
                <tbody>
                  {haberes.map((item) => (
                    <tr key={`${item.id}-hab`} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{item.descripcion || item.tipo}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatMoney(item.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wide mb-2">Deducciones</h2>
              <table className="w-full text-sm border rounded-md overflow-hidden">
                <tbody>
                  {deducciones.map((item) => (
                    <tr key={`${item.id}-ded`} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{item.descripcion || item.tipo}</td>
                      <td className="px-3 py-2 text-right font-medium text-red-600">{formatMoney(Math.abs(item.monto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border p-4 bg-slate-50 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total haberes</span>
              <span className="font-medium">{formatMoney(liquidacion.total_sin_descuentos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total deducciones</span>
              <span className="font-medium">{formatMoney((liquidacion.descuentos_total || 0) + (liquidacion.adelantos_total || 0))}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Neto a cobrar</span>
              <span>{formatMoney(liquidacion.total_neto)}</span>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div className="pt-8 border-t text-center">
              <p className="font-medium">Firma del Empleado</p>
              <p className="text-xs text-muted-foreground mt-1">Aclaracion y DNI</p>
            </div>
            <div className="pt-8 border-t text-center">
              <p className="font-medium">Firma de la Empresa</p>
              <p className="text-xs text-muted-foreground mt-1">Avicola del Sur</p>
            </div>
          </div>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Recibo generado el {fechaGeneracion}. Documento interno de RRHH.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
