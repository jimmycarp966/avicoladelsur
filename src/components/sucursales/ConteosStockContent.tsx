'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  ClipboardList,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Loader2,
  Calendar,
  User,
  Package,
  TrendingDown,
  Camera,
} from 'lucide-react'
import {
  iniciarConteoStockAction,
  obtenerConteoStockAction,
  actualizarCantidadContadaAction,
  completarConteoStockAction,
  type ConteoStock,
  type ConteoStockItem,
} from '@/actions/ventas-sucursal.actions'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import { buscarProductoPorCodigoBarrasAction } from '@/actions/almacen.actions'

// ===========================================
// TIPOS
// ===========================================

interface ConteoResumen {
  id: string
  fecha_conteo: string
  estado: string
  total_diferencias: number
  total_merma_valor: number
  usuarios: { nombre: string } | null
  aprobador: { nombre: string } | null
}

interface ConteosData {
  conteos: ConteoResumen[]
  sucursalId: string
  sucursalNombre: string
  conteoEnProceso: ConteoResumen | undefined
  ultimoConteoCompletado: ConteoResumen | undefined
  estadisticas: {
    totalConteos: number
    enProceso: number
    completados: number
    aprobados: number
  }
}

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

export function ConteosStockContent({ data }: { data: ConteosData }) {
  const [iniciandoConteo, setIniciandoConteo] = useState(false)
  const [conteoActivo, setConteoActivo] = useState<ConteoStock | null>(null)
  const [cargandoConteo, setCargandoConteo] = useState(false)
  const [guardandoItem, setGuardandoItem] = useState<string | null>(null)
  const [completandoConteo, setCompletandoConteo] = useState(false)
  const [dialogAbierto, setDialogAbierto] = useState(false)

  // Iniciar nuevo conteo
  const handleIniciarConteo = async () => {
    if (data.conteoEnProceso) {
      toast.error('Ya hay un conteo en proceso. Complétalo antes de iniciar otro.')
      return
    }

    setIniciandoConteo(true)
    try {
      const result = await iniciarConteoStockAction(data.sucursalId)
      if (result.success && result.data) {
        toast.success('Conteo iniciado correctamente')
        // Intentar cargar el conteo con reintentos
        let cargaResult = false
        for (let intento = 0; intento < 3; intento++) {
          // Pequeño delay antes de cada intento
          await new Promise(resolve => setTimeout(resolve, 300))
          cargaResult = await cargarConteo(result.data.conteoId)
          if (cargaResult) {
            setDialogAbierto(true)
            break
          }
          // Si es el último intento y falló, mostrar mensaje y recargar
          if (intento === 2) {
            toast.info('Conteo creado. Recargando página...')
            setTimeout(() => window.location.reload(), 1000)
          }
        }
      } else {
        const errorMsg = result.error || 'Error al iniciar conteo'
        toast.error(errorMsg)
        // Si hay un conteo existente, recargar la página para mostrarlo
        if (errorMsg.includes('Ya existe un conteo en proceso')) {
          setTimeout(() => window.location.reload(), 2000)
        }
      }
    } catch (error) {
      toast.error('Error al iniciar conteo')
      console.error('Error al iniciar conteo:', error)
    } finally {
      setIniciandoConteo(false)
    }
  }

  // Cargar conteo existente
  const cargarConteo = async (conteoId: string): Promise<boolean> => {
    setCargandoConteo(true)
    try {
      const result = await obtenerConteoStockAction(conteoId)
      if (result.success && result.data) {
        setConteoActivo(result.data)
        return true
      } else {
        toast.error(result.error || 'Error al cargar conteo')
        console.error('Error al cargar conteo:', result.error)
        return false
      }
    } catch (error) {
      toast.error('Error al cargar conteo')
      console.error('Error al cargar conteo:', error)
      return false
    } finally {
      setCargandoConteo(false)
    }
  }

  // Ver conteo existente
  const handleVerConteo = async (conteoId: string) => {
    await cargarConteo(conteoId)
    setDialogAbierto(true)
  }

  // Actualizar cantidad contada
  const handleActualizarCantidad = async (
    itemId: string,
    cantidadContada: number
  ) => {
    setGuardandoItem(itemId)
    try {
      const result = await actualizarCantidadContadaAction(itemId, cantidadContada)
      if (result.success) {
        // Actualizar estado local
        if (conteoActivo) {
          setConteoActivo({
            ...conteoActivo,
            items: conteoActivo.items.map((item) =>
              item.productoId === itemId
                ? {
                  ...item,
                  cantidadContada,
                  diferencia: cantidadContada - item.cantidadTeorica,
                  valorDiferencia:
                    (cantidadContada - item.cantidadTeorica) * item.costoUnitario,
                }
                : item
            ),
          })
        }
        toast.success('Cantidad actualizada')
      } else {
        toast.error(result.error || 'Error al actualizar')
      }
    } catch (error) {
      toast.error('Error al actualizar cantidad')
    } finally {
      setGuardandoItem(null)
    }
  }

  // Completar conteo
  const handleCompletarConteo = async () => {
    if (!conteoActivo) return

    // Verificar que todos los items tengan cantidad contada
    const itemsSinContar = conteoActivo.items.filter(
      (item) => item.cantidadContada === null
    )
    if (itemsSinContar.length > 0) {
      toast.error(
        `Faltan ${itemsSinContar.length} productos por contar. Completa todos antes de finalizar.`
      )
      return
    }

    setCompletandoConteo(true)
    try {
      const result = await completarConteoStockAction(conteoActivo.id, 2.0)
      if (result.success && result.data) {
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">Conteo completado</p>
            <p className="text-sm">
              Diferencias: {result.data.totalDiferencias}
            </p>
            <p className="text-sm">
              Merma total: ${result.data.totalMermaValor.toFixed(2)}
            </p>
          </div>
        )
        setDialogAbierto(false)
        setConteoActivo(null)
        // Recargar página para actualizar lista
        window.location.reload()
      } else {
        toast.error(result.error || 'Error al completar conteo')
      }
    } catch (error) {
      toast.error('Error al completar conteo')
    } finally {
      setCompletandoConteo(false)
    }
  }

  // Obtener color de badge según estado
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'en_proceso':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En Proceso</Badge>
      case 'completado':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Completado</Badge>
      case 'aprobado':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Aprobado</Badge>
      case 'rechazado':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Rechazado</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  // Manejar escaneo de código de barras en conteo
  const handleScanConteo = useCallback(async (code: string) => {
    if (!conteoActivo) return

    const parsed = parseBarcodeEAN13(code)
    console.log('[ConteosStock] Código escaneado:', code, parsed)

    if (!parsed.plu) {
      toast.error('Código no válido')
      return
    }

    // Buscar producto por PLU
    const result = await buscarProductoPorCodigoBarrasAction(parsed.plu)

    if (!result.success || !result.data) {
      toast.error(result.error || 'Producto no encontrado')
      return
    }

    // Buscar el item en el conteo activo
    const itemConteo = conteoActivo.items.find(
      item => item.productoId === result.data!.producto.id
    )

    if (!itemConteo) {
      toast.error('Este producto no está en el conteo actual')
      return
    }

    // Si el código tiene peso embebido, actualizar cantidad contada
    if (parsed.isWeightCode && parsed.weight) {
      await handleActualizarCantidad(itemConteo.productoId, parsed.weight)
      toast.success(`${result.data.producto.nombre}: ${parsed.weight.toFixed(3)} kg registrado`)
    } else {
      // Mostrar mensaje para ingresar cantidad manualmente
      toast.info(`Producto: ${result.data.producto.nombre}. Ingresa la cantidad manualmente.`)
      // Hacer scroll al item
      const rowElement = document.getElementById(`conteo-item-${itemConteo.productoId}`)
      rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [conteoActivo, handleActualizarCantidad])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-8 h-8" />
            Conteos de Stock
          </h1>
          <p className="text-muted-foreground">
            {data.sucursalNombre} - Control de inventario físico
          </p>
        </div>

        <Button onClick={handleIniciarConteo} disabled={iniciandoConteo || !!data.conteoEnProceso}>
          {iniciandoConteo ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Conteo
            </>
          )}
        </Button>
      </div>

      {/* Alerta de conteo en proceso */}
      {data.conteoEnProceso && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium">Conteo en proceso</p>
                  <p className="text-sm text-muted-foreground">
                    Iniciado el {new Date(data.conteoEnProceso.fecha_conteo).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button onClick={() => handleVerConteo(data.conteoEnProceso!.id)}>
                Continuar conteo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conteos</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estadisticas.totalConteos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {data.estadisticas.enProceso}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {data.estadisticas.completados}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.estadisticas.aprobados}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de conteos */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Conteos</CardTitle>
          <CardDescription>
            Últimos conteos realizados en la sucursal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Realizado por</TableHead>
                <TableHead className="text-right">Diferencias</TableHead>
                <TableHead className="text-right">Merma ($)</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.conteos.map((conteo) => (
                <TableRow key={conteo.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {new Date(conteo.fecha_conteo).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>{getEstadoBadge(conteo.estado)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {conteo.usuarios?.nombre || 'Desconocido'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {conteo.total_diferencias > 0 ? (
                      <span className="text-amber-600 font-medium">
                        {conteo.total_diferencias}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {conteo.total_merma_valor > 0 ? (
                      <span className="text-red-600 font-medium">
                        ${conteo.total_merma_valor.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleVerConteo(conteo.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.conteos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      No hay conteos registrados
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de conteo */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Conteo de Stock
              {conteoActivo && getEstadoBadge(conteoActivo.estado)}
            </DialogTitle>
            <DialogDescription>
              {conteoActivo && (
                <>
                  Fecha: {new Date(conteoActivo.fechaConteo).toLocaleDateString()} •
                  Realizado por: {conteoActivo.realizadoPor}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {cargandoConteo ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : conteoActivo ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        Producto
                        {conteoActivo.estado === 'en_proceso' && (
                          <ScanButton
                            onScan={handleScanConteo}
                            size="sm"
                            variant="ghost"
                            title="Escanear Producto"
                            description="Escanea el código de barras para registrar cantidad"
                          />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Stock Teórico</TableHead>
                    <TableHead className="text-right w-32">Cantidad Contada</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-right">Valor Dif.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conteoActivo.items.map((item) => (
                    <TableRow key={item.productoId} id={`conteo-item-${item.productoId}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          {item.productoNombre}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.cantidadTeorica.toFixed(2)} kg
                      </TableCell>
                      <TableCell className="text-right">
                        {conteoActivo.estado === 'en_proceso' ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28 text-right"
                            defaultValue={item.cantidadContada?.toString() || ''}
                            disabled={guardandoItem === item.productoId}
                            onBlur={(e) => {
                              const valor = parseFloat(e.target.value)
                              if (!isNaN(valor) && valor >= 0) {
                                handleActualizarCantidad(item.productoId, valor)
                              }
                            }}
                          />
                        ) : (
                          <span className="font-medium">
                            {item.cantidadContada?.toFixed(2) || '-'} kg
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.cantidadContada !== null ? (
                          <span
                            className={
                              item.diferencia < 0
                                ? 'text-red-600 font-medium'
                                : item.diferencia > 0
                                  ? 'text-green-600 font-medium'
                                  : 'text-muted-foreground'
                            }
                          >
                            {item.diferencia > 0 ? '+' : ''}
                            {item.diferencia.toFixed(2)} kg
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.cantidadContada !== null ? (
                          <span
                            className={
                              item.valorDiferencia < 0
                                ? 'text-red-600 font-medium'
                                : item.valorDiferencia > 0
                                  ? 'text-green-600 font-medium'
                                  : 'text-muted-foreground'
                            }
                          >
                            {item.valorDiferencia > 0 ? '+' : ''}$
                            {item.valorDiferencia.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Resumen */}
              {conteoActivo.estado !== 'en_proceso' && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total diferencias
                          </p>
                          <p className="text-lg font-bold">
                            {conteoActivo.totalDiferencias}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Merma total
                          </p>
                          <p className="text-lg font-bold text-red-600">
                            ${conteoActivo.totalMermaValor.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No se pudo cargar el conteo
            </div>
          )}

          <DialogFooter>
            {conteoActivo?.estado === 'en_proceso' && (
              <Button
                onClick={handleCompletarConteo}
                disabled={completandoConteo}
                className="bg-green-600 hover:bg-green-700"
              >
                {completandoConteo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Completando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completar Conteo
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

