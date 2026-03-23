'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Factory,
  History,
  Moon,
  Package,
  Search,
  Sun,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  cancelarConteoStockAction,
  finalizarConteoStockAction,
  iniciarConteoStockAction,
  obtenerConteoEnProgresoAction,
  obtenerHistorialConteosAction,
  obtenerItemsConteoAction,
  registrarConteoItemAction,
  verificarProduccionEnCursoAction,
  type ConteoStock,
  type ConteoStockItem,
  type ConteoStockResultadoFinal,
  type ProduccionEnCurso,
} from '@/actions/control-stock.actions'
import { formatDate } from '@/lib/utils'

const TIEMPO_LIMITE_MINUTOS = 60

export const dynamic = 'force-dynamic'

export default function ControlStockPage() {
  const [loading, setLoading] = useState(true)
  const [conteoActivo, setConteoActivo] = useState<ConteoStock | null>(null)
  const [items, setItems] = useState<ConteoStockItem[]>([])
  const [historial, setHistorial] = useState<ConteoStock[]>([])
  const [produccionEnCurso, setProduccionEnCurso] = useState<ProduccionEnCurso | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [resultadoFinal, setResultadoFinal] = useState<ConteoStockResultadoFinal | null>(null)

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true)

      try {
        const [conteoRes, historialRes, produccionRes] = await Promise.all([
          obtenerConteoEnProgresoAction(),
          obtenerHistorialConteosAction(20),
          verificarProduccionEnCursoAction(),
        ])

        if (conteoRes.data) {
          setConteoActivo(conteoRes.data)

          const itemsRes = await obtenerItemsConteoAction(conteoRes.data.id)
          if (itemsRes.data) {
            setItems(itemsRes.data)
          }
        }

        if (historialRes.data) {
          setHistorial(historialRes.data)
        }

        if (produccionRes.data) {
          setProduccionEnCurso(produccionRes.data)
        }
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  useEffect(() => {
    if (!conteoActivo || conteoActivo.estado !== 'en_progreso') return

    const calcularTiempo = () => {
      const inicio = new Date(conteoActivo.hora_inicio).getTime()
      const ahora = Date.now()
      const minutos = Math.floor((ahora - inicio) / 60000)
      setTiempoTranscurrido(minutos)
    }

    calcularTiempo()
    const interval = setInterval(calcularTiempo, 30000)

    return () => clearInterval(interval)
  }, [conteoActivo])

  const handleIniciarConteo = async (turno: 'mañana' | 'noche') => {
    setLoading(true)

    try {
      const result = await iniciarConteoStockAction(turno)

      if (result.success && result.data) {
        toast.success(`Conteo turno ${turno} iniciado`)
        setResultadoFinal(null)

        const conteoRes = await obtenerConteoEnProgresoAction()
        if (conteoRes.data) {
          setConteoActivo(conteoRes.data)

          const itemsRes = await obtenerItemsConteoAction(conteoRes.data.id)
          if (itemsRes.data) {
            setItems(itemsRes.data)
          }
        }

        if (result.data.produccion_en_curso) {
          toast.warning(
            `Atencion: hay produccion en curso con ${result.data.cajones_faltantes} cajones faltantes`
          )
        }
      } else {
        toast.error(result.message || 'Error al iniciar conteo')
      }
    } catch {
      toast.error('Error al iniciar conteo')
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrarConteo = async (item: ConteoStockItem, cantidadFisica: number) => {
    if (!conteoActivo) return

    const result = await registrarConteoItemAction(conteoActivo.id, item.producto_id, cantidadFisica)

    if (result.success) {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                cantidad_fisica: cantidadFisica,
              }
            : entry
        )
      )
    } else {
      toast.error(result.message || 'Error al registrar')
    }
  }

  const handleFinalizarConteo = async () => {
    if (!conteoActivo) return

    if (!confirm('Estas seguro de finalizar el conteo? No podras modificarlo despues.')) {
      return
    }

    setLoading(true)

    try {
      const result = await finalizarConteoStockAction(
        conteoActivo.id,
        observaciones,
        tiempoTranscurrido > TIEMPO_LIMITE_MINUTOS
      )

      if (result.success && result.data) {
        if (result.data.resumen_visible) {
          toast.success(
            `Conteo finalizado. ${result.data.total_diferencias || 0} diferencia(s) encontradas.`
          )
        } else {
          toast.success('Conteo finalizado. El resultado queda visible solo para administracion.')
        }

        if (result.data.excedio_tiempo) {
          toast.warning('El conteo excedio el tiempo limite recomendado de 1 hora')
        }

        setResultadoFinal(result.data.resumen_visible ? result.data : null)
        setConteoActivo(null)
        setItems([])

        const historialRes = await obtenerHistorialConteosAction(20)
        if (historialRes.data) {
          setHistorial(historialRes.data)
        }
      } else {
        toast.error(result.message || 'Error al finalizar')
      }
    } catch {
      toast.error('Error al finalizar conteo')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelarConteo = async () => {
    if (!conteoActivo) return

    if (!confirm('Estas seguro de cancelar el conteo? Se perderan los datos ingresados.')) {
      return
    }

    setLoading(true)

    try {
      const result = await cancelarConteoStockAction(conteoActivo.id)

      if (result.success) {
        toast.success('Conteo cancelado')
        setConteoActivo(null)
        setItems([])
      } else {
        toast.error(result.message || 'Error al cancelar')
      }
    } catch {
      toast.error('Error al cancelar conteo')
    } finally {
      setLoading(false)
    }
  }

  const itemsFiltrados = items.filter((item) => {
    const nombre = item.producto?.nombre?.toLowerCase() || ''
    const codigo = item.producto?.codigo?.toLowerCase() || ''
    const termino = busqueda.toLowerCase()

    return nombre.includes(termino) || codigo.includes(termino)
  })

  const itemsContados = items.filter((item) => item.cantidad_fisica !== null && item.cantidad_fisica !== undefined).length
  const itemsPendientes = Math.max(items.length - itemsContados, 0)
  const progreso = items.length > 0 ? (itemsContados / items.length) * 100 : 0

  const horaActual = new Date().getHours()
  const turnoSugerido: 'mañana' | 'noche' = horaActual < 14 ? 'mañana' : 'noche'

  if (loading && !conteoActivo) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-4 h-12 w-12 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">Cargando control de stock...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Control de Stock</h1>
          <p className="text-muted-foreground">
            Conteo fisico por turnos sin mostrar stock del sistema ni diferencias durante la carga
          </p>
        </div>
      </div>

      {resultadoFinal?.resumen_visible && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Resultado final del conteo</AlertTitle>
          <AlertDescription>
            <div className="space-y-1">
              <p>
                Productos contados: <strong>{resultadoFinal.total_productos_contados}</strong>
              </p>
              <p>
                Duracion: <strong>{resultadoFinal.duracion_minutos}</strong> min
              </p>
              <p>
                Diferencias: <strong>{resultadoFinal.total_diferencias || 0}</strong>
                {typeof resultadoFinal.monto_diferencia_estimado === 'number' && (
                  <>
                    {' '}| Impacto estimado:{' '}
                    <strong>${resultadoFinal.monto_diferencia_estimado.toFixed(2)}</strong>
                  </>
                )}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {produccionEnCurso?.en_curso && (
        <Alert variant="destructive">
          <Factory className="h-4 w-4" />
          <AlertTitle>Produccion en curso</AlertTitle>
          <AlertDescription>
            Hay {produccionEnCurso.cantidad_ordenes} orden(es) activas con aproximadamente{' '}
            <strong>{produccionEnCurso.cajones_faltantes} cajones</strong> pendientes de procesar.
            El stock puede variar durante el conteo.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={conteoActivo ? 'conteo' : 'inicio'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inicio" disabled={!!conteoActivo}>
            <Sun className="mr-2 h-4 w-4" />
            Iniciar Conteo
          </TabsTrigger>
          <TabsTrigger value="conteo" disabled={!conteoActivo}>
            <Package className="mr-2 h-4 w-4" />
            Conteo Activo
          </TabsTrigger>
          <TabsTrigger value="historial">
            <History className="mr-2 h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inicio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Iniciar nuevo conteo</CardTitle>
              <CardDescription>
                Selecciona el turno para comenzar el conteo. Solo se permite un conteo por turno por dia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card
                  className={`cursor-pointer transition-colors hover:border-primary ${
                    turnoSugerido === 'mañana' ? 'border-primary' : ''
                  }`}
                  onClick={() => handleIniciarConteo('mañana')}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="rounded-full bg-yellow-100 p-4">
                      <Sun className="h-8 w-8 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Turno Manana</h3>
                      <p className="text-sm text-muted-foreground">06:00 - 14:00</p>
                      {turnoSugerido === 'mañana' && (
                        <Badge variant="default" className="mt-2">
                          Sugerido
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-colors hover:border-primary ${
                    turnoSugerido === 'noche' ? 'border-primary' : ''
                  }`}
                  onClick={() => handleIniciarConteo('noche')}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="rounded-full bg-indigo-100 p-4">
                      <Moon className="h-8 w-8 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Turno Noche</h3>
                      <p className="text-sm text-muted-foreground">14:00 - 22:00</p>
                      {turnoSugerido === 'noche' && (
                        <Badge variant="default" className="mt-2">
                          Sugerido
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              <Clock className="mr-2 h-4 w-4" />
              El conteo tiene un tiempo limite recomendado de 1 hora
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="conteo" className="space-y-4">
          {conteoActivo && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Turno</CardDescription>
                    <CardTitle className="flex items-center gap-2">
                      {conteoActivo.turno === 'mañana' ? (
                        <Sun className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Moon className="h-5 w-5 text-indigo-500" />
                      )}
                      {conteoActivo.turno.charAt(0).toUpperCase() + conteoActivo.turno.slice(1)}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Tiempo</CardDescription>
                    <CardTitle className={tiempoTranscurrido > TIEMPO_LIMITE_MINUTOS ? 'text-orange-500' : ''}>
                      {tiempoTranscurrido} min
                      {tiempoTranscurrido > TIEMPO_LIMITE_MINUTOS && (
                        <Badge variant="outline" className="ml-2 text-orange-500">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Excedido
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Progreso</CardDescription>
                    <CardTitle>
                      {itemsContados} / {items.length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Progress value={progreso} className="h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Pendientes</CardDescription>
                    <CardTitle className={itemsPendientes > 0 ? 'text-orange-500' : 'text-green-500'}>
                      {itemsPendientes}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>Productos</CardTitle>
                      <CardDescription>Ingresa solo la cantidad fisica contada para cada producto</CardDescription>
                    </div>

                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar producto..."
                        value={busqueda}
                        onChange={(event) => setBusqueda(event.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="max-h-[500px] space-y-2 overflow-y-auto">
                    {itemsFiltrados.map((item) => (
                      <div
                        key={item.id}
                        className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors md:flex-row md:items-center ${
                          item.cantidad_fisica !== null && item.cantidad_fisica !== undefined ? 'bg-muted/30' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{item.producto?.nombre}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.producto?.codigo}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Registra el conteo fisico en <strong>{item.producto?.unidad}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-32">
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="Cantidad"
                              value={item.cantidad_fisica ?? ''}
                              onChange={(event) => {
                                const valor = parseFloat(event.target.value.replace(',', '.'))

                                if (!Number.isNaN(valor) || event.target.value === '') {
                                  void handleRegistrarConteo(item, Number.isNaN(valor) ? 0 : valor)
                                }
                              }}
                              onFocus={(event) => event.target.select()}
                              className="text-center"
                            />
                          </div>

                          {item.cantidad_fisica !== null && item.cantidad_fisica !== undefined && (
                            <div className="w-24 text-center">
                              <Badge variant="outline" className="bg-green-100">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Registrado
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <div className="w-full">
                    <Label htmlFor="observaciones">Observaciones del conteo</Label>
                    <Textarea
                      id="observaciones"
                      placeholder="Notas adicionales..."
                      value={observaciones}
                      onChange={(event) => setObservaciones(event.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="flex w-full flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={handleCancelarConteo} disabled={loading}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button onClick={handleFinalizarConteo} disabled={loading || itemsContados === 0}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finalizar Conteo
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de conteos</CardTitle>
              <CardDescription>Registro de conteos anteriores</CardDescription>
            </CardHeader>
            <CardContent>
              {historial.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <History className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No hay conteos registrados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historial.map((conteo) => (
                    <div
                      key={conteo.id}
                      className="flex flex-col justify-between rounded-lg border p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center"
                    >
                      <div className="flex items-center gap-3">
                        {conteo.turno === 'mañana' ? (
                          <Sun className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Moon className="h-5 w-5 text-indigo-500" />
                        )}
                        <div>
                          <div className="font-medium">
                            {formatDate(conteo.fecha)} - Turno {conteo.turno}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Por: {conteo.usuario?.nombre} {conteo.usuario?.apellido || ''}
                            {conteo.duracion_minutos && ` | ${conteo.duracion_minutos} min`}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-3 md:mt-0">
                        <div className="text-right">
                          <div className="text-sm">{conteo.total_productos_contados} contados</div>
                          {conteo.total_diferencias > 0 && (
                            <div className="text-sm text-red-500">{conteo.total_diferencias} diferencias</div>
                          )}
                        </div>

                        <Badge
                          variant={
                            conteo.estado === 'completado'
                              ? 'default'
                              : conteo.estado === 'timeout'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className={conteo.estado === 'completado' ? 'bg-green-500' : ''}
                        >
                          {conteo.estado === 'completado' && <CheckCircle className="mr-1 h-3 w-3" />}
                          {conteo.estado === 'timeout' && <Clock className="mr-1 h-3 w-3" />}
                          {conteo.estado === 'cancelado' && <XCircle className="mr-1 h-3 w-3" />}
                          {conteo.estado}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
