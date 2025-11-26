import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, User, Phone, Mail, MapPin, MessageCircle, ShoppingCart, DollarSign, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
// import { getClienteById } from '@/actions/ventas.actions' // TODO: Implementar cuando esté disponible

interface ClienteDetallePageProps {
  params: {
    id: string
  }
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Detalle Cliente - Avícola del Sur ERP',
  description: 'Información detallada del cliente',
}

export default async function ClienteDetallePage({ params }: ClienteDetallePageProps) {
  const { id } = await params
  const clienteId = id

  // En producción, esto sería una llamada real a la base de datos
  // const cliente = await getClienteById(clienteId)
  // if (!cliente) notFound()

  // Datos de ejemplo para desarrollo
  const clienteEjemplo = {
    id: clienteId,
    nombre: 'Supermercado Central',
    telefono: '+5491123456789',
    whatsapp: '+5491123456789',
    email: 'contacto@supercentral.com',
    direccion: 'Av. Principal 123, Ciudad de Buenos Aires, Argentina',
    zona_entrega: 'Centro',
    coordenadas: { lat: -34.6118, lng: -58.3965 },
    tipo_cliente: 'mayorista',
    limite_credito: 50000.00,
    activo: true,
    fecha_registro: '2024-01-15T10:00:00Z',
    ultimo_pedido: '2025-11-05T14:30:00Z',
    total_pedidos: 45,
    total_compras: 125000.00,
    pedidos_pendientes: 2,
    promedio_compra: 2777.78,
  }

  const cliente = clienteEjemplo

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ventas/clientes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{cliente.nombre}</h1>
            <p className="text-muted-foreground">Cliente {cliente.tipo_cliente}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link href={`tel:${cliente.telefono}`}>
              <Phone className="mr-2 h-4 w-4" />
              Llamar
            </Link>
          </Button>
          {cliente.whatsapp && (
            <Button variant="outline" asChild className="text-green-600 hover:text-green-700">
              <a
                href={`https://wa.me/${cliente.whatsapp.replace(/[^\d]/g, '')}?text=Hola, le escribo desde Avícola del Sur`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/ventas/clientes/${cliente.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Estado del cliente */}
      <div className="flex items-center space-x-4">
        <Badge variant={cliente.activo ? "default" : "secondary"}>
          {cliente.activo ? "Activo" : "Inactivo"}
        </Badge>
        <Badge variant="outline" className="capitalize">{cliente.tipo_cliente}</Badge>
        <Badge variant="outline">{cliente.zona_entrega}</Badge>
      </div>

      {/* Información principal */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Información de contacto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p className="text-sm">{cliente.nombre}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Teléfono
              </label>
              <p className="text-sm">{cliente.telefono}</p>
            </div>
            {cliente.whatsapp && (
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1 text-green-600">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </label>
                <p className="text-sm text-green-600">{cliente.whatsapp}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </label>
              <p className="text-sm">{cliente.email}</p>
            </div>
          </CardContent>
        </Card>

        {/* Dirección */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Dirección y Zona
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Dirección</label>
              <p className="text-sm">{cliente.direccion}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Zona de Entrega</label>
              <p className="text-sm">{cliente.zona_entrega}</p>
            </div>
            {cliente.coordenadas && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Coordenadas GPS</label>
                <p className="text-xs font-mono text-muted-foreground">
                  {cliente.coordenadas.lat.toFixed(6)}, {cliente.coordenadas.lng.toFixed(6)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Información comercial */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Información Comercial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tipo de Cliente</label>
              <p className="text-sm capitalize">{cliente.tipo_cliente}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Límite de Crédito</label>
              <p className="text-lg font-semibold text-blue-600">
                {formatCurrency(cliente.limite_credito)}
              </p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fecha de Registro</label>
              <p className="text-sm">{formatDate(cliente.fecha_registro)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas de compras */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cliente.total_pedidos}</div>
            <p className="text-xs text-muted-foreground">
              Desde el registro
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comprado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cliente.total_compras)}</div>
            <p className="text-xs text-muted-foreground">
              Valor total de compras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Compra</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(cliente.promedio_compra)}</div>
            <p className="text-xs text-muted-foreground">
              Valor promedio por pedido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendientes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{cliente.pedidos_pendientes}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historial de facturas (placeholder, se conectará a BD más adelante) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Facturas del Cliente
          </CardTitle>
          <CardDescription>
            Aquí se listarán las facturas reales de este cliente cuando se conecte a la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Esta sección usará la tabla <code>facturas</code> filtrada por <code>cliente_id</code> para mostrar el historial completo.
          </p>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Factura FAC-20251202-0001</p>
              <p className="text-sm text-muted-foreground">
                {formatDate('2025-12-02T10:00:00Z')}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="default">emitida</Badge>
              <p className="text-sm font-medium mt-1">{formatCurrency(12345)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
