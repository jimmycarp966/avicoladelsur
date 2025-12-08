import { notFound } from 'next/navigation'
import { obtenerEmpleadoPorIdAction } from '@/actions/rrhh.actions'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmpleadoDetallePage({ params }: PageProps) {
  const { id } = await params
  const empleadoResult = await obtenerEmpleadoPorIdAction(id)

  if (!empleadoResult.success || !empleadoResult.data) {
    notFound()
  }

  const empleado = empleadoResult.data
  const nombreCompleto = `${empleado.usuario?.nombre || ''} ${empleado.usuario?.apellido || ''}`.trim() || 'Sin nombre'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rrhh/empleados">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{nombreCompleto}</h1>
            <p className="text-gray-600 mt-1">
              {empleado.legajo && `Legajo: ${empleado.legajo}`}
              {empleado.legajo && empleado.usuario?.email && ' • '}
              {empleado.usuario?.email}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/rrhh/empleados/${id}/editar`}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Información Personal */}
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
            <CardDescription>Datos personales del empleado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Nombre Completo</label>
              <p className="text-base font-semibold">{nombreCompleto}</p>
            </div>
            {empleado.dni && (
              <div>
                <label className="text-sm font-medium text-gray-500">DNI</label>
                <p className="text-base">{empleado.dni}</p>
              </div>
            )}
            {empleado.cuil && (
              <div>
                <label className="text-sm font-medium text-gray-500">CUIL</label>
                <p className="text-base">{empleado.cuil}</p>
              </div>
            )}
            {empleado.fecha_nacimiento && (
              <div>
                <label className="text-sm font-medium text-gray-500">Fecha de Nacimiento</label>
                <p className="text-base">{formatDate(empleado.fecha_nacimiento)}</p>
              </div>
            )}
            {empleado.domicilio && (
              <div>
                <label className="text-sm font-medium text-gray-500">Domicilio</label>
                <p className="text-base">{empleado.domicilio}</p>
              </div>
            )}
            {empleado.telefono_personal && (
              <div>
                <label className="text-sm font-medium text-gray-500">Teléfono Personal</label>
                <p className="text-base">
                  <a href={`tel:${empleado.telefono_personal}`} className="text-blue-600 hover:underline">
                    {empleado.telefono_personal}
                  </a>
                </p>
              </div>
            )}
            {empleado.usuario?.email && (
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-base">
                  <a href={`mailto:${empleado.usuario.email}`} className="text-blue-600 hover:underline">
                    {empleado.usuario.email}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Información Laboral */}
        <Card>
          <CardHeader>
            <CardTitle>Información Laboral</CardTitle>
            <CardDescription>Datos relacionados con el trabajo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {empleado.legajo && (
              <div>
                <label className="text-sm font-medium text-gray-500">Legajo</label>
                <p className="text-base font-semibold">{empleado.legajo}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Fecha de Ingreso</label>
              <p className="text-base">{formatDate(empleado.fecha_ingreso)}</p>
            </div>
            {empleado.sucursal && (
              <div>
                <label className="text-sm font-medium text-gray-500">Sucursal</label>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {empleado.sucursal.nombre}
                </Badge>
              </div>
            )}
            {empleado.categoria && (
              <div>
                <label className="text-sm font-medium text-gray-500">Puesto/Categoría</label>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  {empleado.categoria.nombre}
                </Badge>
              </div>
            )}
            {empleado.sueldo_actual && (
              <div>
                <label className="text-sm font-medium text-gray-500">Sueldo Actual</label>
                <p className="text-base font-semibold text-green-600">
                  ${empleado.sueldo_actual.toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Estado</label>
              <Badge variant={empleado.activo ? 'default' : 'secondary'}>
                {empleado.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Contacto de Emergencia */}
        {(empleado.contacto_emergencia || empleado.telefono_emergencia) && (
          <Card>
            <CardHeader>
              <CardTitle>Contacto de Emergencia</CardTitle>
              <CardDescription>Persona de contacto en caso de emergencia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {empleado.contacto_emergencia && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Nombre</label>
                  <p className="text-base">{empleado.contacto_emergencia}</p>
                </div>
              )}
              {empleado.telefono_emergencia && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Teléfono</label>
                  <p className="text-base">
                    <a href={`tel:${empleado.telefono_emergencia}`} className="text-blue-600 hover:underline">
                      {empleado.telefono_emergencia}
                    </a>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Información Bancaria */}
        {(empleado.banco || empleado.cbu || empleado.numero_cuenta) && (
          <Card>
            <CardHeader>
              <CardTitle>Información Bancaria</CardTitle>
              <CardDescription>Datos para depósito de sueldo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {empleado.banco && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Banco</label>
                  <p className="text-base">{empleado.banco}</p>
                </div>
              )}
              {empleado.cbu && (
                <div>
                  <label className="text-sm font-medium text-gray-500">CBU</label>
                  <p className="text-base font-mono">{empleado.cbu}</p>
                </div>
              )}
              {empleado.numero_cuenta && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Número de Cuenta</label>
                  <p className="text-base">{empleado.numero_cuenta}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Obra Social */}
        {(empleado.obra_social || empleado.numero_afiliado) && (
          <Card>
            <CardHeader>
              <CardTitle>Obra Social</CardTitle>
              <CardDescription>Información de afiliación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {empleado.obra_social && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Obra Social</label>
                  <p className="text-base">{empleado.obra_social}</p>
                </div>
              )}
              {empleado.numero_afiliado && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Número de Afiliado</label>
                  <p className="text-base">{empleado.numero_afiliado}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

