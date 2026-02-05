'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DateInput } from '@/components/ui/date-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Plus, Trash2, Search, X } from 'lucide-react'
import { crearPresupuestoAction } from '@/actions/presupuestos.actions'
import { obtenerTodasListasActivasAction, obtenerPrecioProductoAction, obtenerListasClienteAction } from '@/actions/listas-precios.actions'
import { obtenerClientePorIdAction } from '@/actions/ventas.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFocusField } from '@/lib/hooks/useFocusField'
import { useFormContextShortcuts } from '@/lib/hooks/useFormContextShortcuts'
import { KeyboardHintCompact } from '@/components/ui/keyboard-hint'
import { PresupuestoItemsTable } from './presupuesto-items-table'
import { useEffect, useRef } from 'react'

const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid('Debes seleccionar un cliente'),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  lista_precio_id: z.string().uuid().optional(), // Lista global (por defecto para todos los productos)
  tipo_venta: z.enum(['reparto', 'retira_casa_central']).optional(),
  items: z.array(z.object({
    producto_id: z.string().uuid('Debes seleccionar un producto'),
    cantidad_solicitada: z.number().positive('La cantidad debe ser mayor a 0'),
    precio_unit_est: z.number().positive('El precio debe ser mayor a 0'),
    lista_precio_id: z.string().uuid().optional(), // Lista individual por producto
  })).min(1, 'Debes agregar al menos un producto'),
})

type CrearPresupuestoFormData = z.infer<typeof crearPresupuestoSchema>

interface PresupuestoFormProps {
  clientes: Array<{ id: string; nombre: string; codigo?: string; telefono?: string; zona_entrega?: string; zona_id?: string; localidad?: { zona_id: string } }>
  productos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    precio_venta: number;
    unidad_medida: string;
    categoria?: string;
    // Campos de venta por mayor
    venta_mayor_habilitada?: boolean;
    unidad_mayor_nombre?: string;
    kg_por_unidad_mayor?: number;
    // Campos de stock
    stock_real?: number;
    stock_reservado?: number;
    stock_disponible?: number;
  }>
  zonas: Array<{ id: string; nombre: string }>
  tipoVentaInicial?: 'reparto' | 'retira_casa_central'
}

export function PresupuestoForm({ clientes, productos, zonas, tipoVentaInicial }: PresupuestoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false)
  const [todasListas, setTodasListas] = useState<Array<{ id: string; codigo: string; nombre: string; tipo: string; margen_ganancia: number | null }>>([])
  const [cargandoListas, setCargandoListas] = useState(true) // Iniciar en true para mostrar loading inicial
  const [errorListas, setErrorListas] = useState<string | null>(null)
  const agregarProductoButtonRef = useRef<HTMLButtonElement>(null)

  // Estado para listas por producto (index -> lista_id)
  const [listasPorProducto, setListasPorProducto] = useState<Record<number, string>>({})

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CrearPresupuestoFormData>({
    resolver: zodResolver(crearPresupuestoSchema),
    mode: 'onChange', // Actualizar en tiempo real cuando cambian los valores
    defaultValues: {
      zona_id: '', // Inicializar como string vacío para evitar warning uncontrolled/controlled
      fecha_entrega_estimada: new Date().toISOString().split('T')[0], // Fecha de hoy por defecto
      observaciones: '',
      tipo_venta: tipoVentaInicial || 'reparto',
      items: [{ producto_id: '', cantidad_solicitada: 1, precio_unit_est: 0, lista_precio_id: undefined }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  // Optimizar watch usando useWatch para mejor rendimiento
  const watchedItems = useWatch({ control, name: 'items' })
  const watchedCliente = useWatch({ control, name: 'cliente_id' })

  // Estado para forzar actualización del total cuando cambia precio
  const [totalUpdateKey, setTotalUpdateKey] = useState(0)

  // Suscribirse a cambios en items usando watch con callback para detectar cambios profundos
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      // Si cambió algún precio o cantidad, forzar actualización del total
      if (name && (name.includes('precio_unit_est') || name.includes('cantidad_solicitada'))) {
        setTotalUpdateKey(prev => prev + 1)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setTotalUpdateKey])


  // Ref para rastrear la cantidad de items y detectar cuando se agregan nuevos
  const cantidadItemsRef = useRef(watchedItems?.length || 0)

  // Ref para forzar actualización cuando se agregan productos nuevos
  const [triggerActualizacion, setTriggerActualizacion] = useState(0)

  // Efecto separado para detectar cuando se agregan productos nuevos
  useEffect(() => {
    const cantidadActual = watchedItems?.length || 0
    if (cantidadActual > cantidadItemsRef.current) {
      // Se agregaron nuevos productos, limpiar cache y forzar actualización
      productosProcesadosRef.current.clear()
      cantidadItemsRef.current = cantidadActual
      setTriggerActualizacion(prev => prev + 1)
    }
  }, [watchedItems?.length])

  // Debouncing para búsquedas (solo para cliente, productos se manejan individualmente)
  // Reducido a 150ms para mejor respuesta sin sacrificar rendimiento
  const debouncedClienteSearch = useDebounce(clienteSearch, 150)

  // Calcular total estimado usando watch directamente para detectar cambios inmediatos
  // Usar watch('items') directamente para obtener valores actuales en cada render
  const itemsParaTotal = watch('items')

  // Crear una clave única basada en los valores de los items para detectar cambios profundos
  const itemsKey = useMemo(() => {
    if (!itemsParaTotal || itemsParaTotal.length === 0) return 'empty'
    return JSON.stringify(itemsParaTotal.map(item => ({
      producto_id: item?.producto_id,
      cantidad_solicitada: item?.cantidad_solicitada,
      precio_unit_est: item?.precio_unit_est
    })))
  }, [itemsParaTotal])

  // Estado local para el total que se actualiza cuando cambian los items
  const [totalEstimadoState, setTotalEstimadoState] = useState(0)

  // Calcular total cuando cambian los items (detectado por itemsKey) o totalUpdateKey
  useEffect(() => {
    if (!itemsParaTotal || itemsParaTotal.length === 0) {
      setTotalEstimadoState(0)
      return
    }
    const total = itemsParaTotal.reduce((sum: number, item: any) => {
      const cantidad = item?.cantidad_solicitada || 0
      const precio = item?.precio_unit_est || 0
      return sum + (cantidad * precio)
    }, 0)
    setTotalEstimadoState(total)
  }, [itemsKey, totalUpdateKey, itemsParaTotal])

  // Usar el estado local para el total
  const totalEstimado = totalEstimadoState

  // Memoizar cliente seleccionado
  const clienteSeleccionado = useMemo(() => {
    return clientes.find(c => c.id === watchedCliente)
  }, [clientes, watchedCliente])

  // Atajos contextuales para el formulario
  useFormContextShortcuts({
    shortcuts: [
      {
        key: 'c',
        fieldId: 'cliente_id',
        description: 'Enfocar Cliente',
      },
      {
        key: 'p',
        description: 'Enfocar primer Producto',
        action: () => {
          // Buscar el SelectTrigger del primer producto por su ID
          const firstProductSelect = document.getElementById('producto_0')
          if (firstProductSelect) {
            firstProductSelect.click()
            // El hook mejorado manejará el focus del input de búsqueda
          }
        },
      },
      {
        key: 'a',
        description: 'Agregar Producto',
        action: () => {
          agregarProductoButtonRef.current?.click()
        },
      },
      {
        key: 'l',
        fieldId: 'lista_precio_id',
        description: 'Enfocar Lista de Precios',
      },
      {
        key: 'f',
        fieldId: 'fecha_entrega_estimada',
        description: 'Enfocar Fecha de Entrega',
      },
      {
        key: 'z',
        fieldId: 'zona_id',
        description: 'Enfocar Zona de Entrega',
      },
      {
        key: 'o',
        fieldId: 'observaciones',
        description: 'Enfocar Observaciones',
      },
      {
        key: 'q',
        ctrlKey: true,
        description: 'Enfocar Cantidad del primer producto (Ctrl+Q)',
        action: () => {
          const cantidadInput = document.getElementById('cantidad_0')
          if (cantidadInput instanceof HTMLInputElement) {
            cantidadInput.focus()
            cantidadInput.select()
          }
        },
      },
      {
        key: 'w',
        ctrlKey: true,
        description: 'Enfocar Precio del primer producto (Ctrl+W)',
        action: () => {
          const precioInput = document.getElementById('precio_0')
          if (precioInput instanceof HTMLInputElement) {
            precioInput.focus()
            precioInput.select()
          }
        },
      },
      // Atajos numéricos para enfocar productos por índice (Ctrl+1-9)
      ...Array.from({ length: 9 }, (_, i) => ({
        key: String(i + 1),
        ctrlKey: true,
        description: `Enfocar Producto ${i + 1} (Ctrl+${i + 1})`,
        action: () => {
          const productSelect = document.getElementById(`producto_${i}`)
          if (productSelect) {
            productSelect.click()
          }
        },
      })),
    ],
  })


  // Cargar todas las listas activas disponibles
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const cargarListas = async () => {
      try {
        console.log('[PRESUPUESTO FORM] Iniciando carga de listas...')
        setCargandoListas(true)
        setErrorListas(null)

        // Llamar directamente sin timeout primero para ver si funciona
        const startTime = Date.now()
        const result = await obtenerTodasListasActivasAction()
        const duration = Date.now() - startTime
        console.log(`[PRESUPUESTO FORM] Listas cargadas en ${duration}ms`, result)

        if (!isMounted) {
          console.log('[PRESUPUESTO FORM] Componente desmontado, ignorando resultado')
          return
        }

        if (result.success && result.data) {
          console.log(`[PRESUPUESTO FORM] ${result.data.length} listas cargadas exitosamente`)
          setTodasListas(result.data as any)
        } else {
          const errorMsg = result.error || 'Error desconocido al cargar listas'
          console.warn('[PRESUPUESTO FORM] Error al cargar listas:', errorMsg)
          setErrorListas(errorMsg)
          setTodasListas([])
        }
      } catch (error: any) {
        if (!isMounted) {
          console.log('[PRESUPUESTO FORM] Componente desmontado, ignorando error')
          return
        }
        const errorMsg = error?.message || 'Error al cargar listas de precios'
        console.error('[PRESUPUESTO FORM] Error al cargar listas:', error)
        setErrorListas(errorMsg)
        setTodasListas([])
      } finally {
        if (isMounted) {
          console.log('[PRESUPUESTO FORM] Finalizando carga de listas')
          setCargandoListas(false)
        }
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }

    cargarListas()

    return () => {
      console.log('[PRESUPUESTO FORM] Limpiando efecto de carga de listas')
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  // Efecto para cargar y aplicar automáticamente zona y lista de precios del cliente
  useEffect(() => {
    if (!watchedCliente) return

    const cargarDatosCliente = async () => {
      try {
        const result = await obtenerClientePorIdAction(watchedCliente)
        if (!result.success || !result.data) return

        const { zona_id, listas_precios } = result.data

        // 1. Auto-aplicar Zona del cliente
        if (zona_id && zonas.some(z => z.id === zona_id)) {
          setValue('zona_id', zona_id, { shouldValidate: true, shouldDirty: true })
        }

        // 2. Auto-aplicar Lista de Precios del cliente
        if (todasListas.length > 0 && listas_precios && listas_precios.length > 0) {
          const listasOrdenadas = [...listas_precios].sort((a: any, b: any) => (a.prioridad || 999) - (b.prioridad || 999))
          const listaPrincipal = listasOrdenadas[0]
          const listaId = listaPrincipal.lista_precio?.id || listaPrincipal.lista_precio_id

          if (listaId && todasListas.some(l => l.id === listaId)) {
            setValue('lista_precio_id', listaId, { shouldValidate: true, shouldDirty: true })
            const listaEncontrada = todasListas.find(l => l.id === listaId)
            if (listaEncontrada) {
              showToast('info', `Lista "${listaEncontrada.nombre}" aplicada`)
            }
          }
        }
      } catch (error) {
        console.error('Error cargando datos del cliente:', error)
      }
    }

    cargarDatosCliente()
  }, [watchedCliente, setValue, showToast, todasListas, zonas])

  // Actualizar precios cuando cambia la lista global o lista por producto
  const watchedListaPrecioGlobal = useWatch({ control, name: 'lista_precio_id' })

  // Ref para rastrear las últimas listas usadas y evitar loops infinitos
  const ultimasListasRef = useRef<Record<number, string>>({})
  const ultimaListaGlobalRef = useRef<string | undefined>(undefined)
  const productosProcesadosRef = useRef<Set<string>>(new Set())

  // Efecto para actualizar precios cuando cambian las listas (NO cuando cambian los items)
  useEffect(() => {
    const actualizarPrecios = async () => {
      // Obtener items actuales usando getValues para evitar loops infinitos
      const itemsActuales = getValues('items')
      if (!itemsActuales || itemsActuales.length === 0) return

      // Verificar si realmente cambió la lista global
      const listaGlobalCambio = ultimaListaGlobalRef.current !== watchedListaPrecioGlobal

      // Si cambió la lista global, limpiar el cache de productos procesados
      if (listaGlobalCambio) {
        productosProcesadosRef.current.clear()
      }

      for (let i = 0; i < itemsActuales.length; i++) {
        const item = itemsActuales[i]
        if (!item.producto_id) continue

        // Usar lista individual si existe, sino usar lista global
        const listaId = listasPorProducto[i] || watchedListaPrecioGlobal
        if (!listaId) continue

        // Crear una clave única para este producto+lista
        const clave = `${item.producto_id}-${listaId}`

        // Verificar si la lista para este producto cambió
        const listaAnterior = ultimasListasRef.current[i]
        const listaCambio = listaAnterior !== listaId || listaGlobalCambio

        // Si la lista no cambió y ya procesamos este producto con esta lista, saltar
        if (!listaCambio && productosProcesadosRef.current.has(clave)) {
          continue
        }

        const precioResult = await obtenerPrecioProductoAction(listaId, item.producto_id)
        if (precioResult.success && precioResult.data) {
          // Obtener información de la lista seleccionada
          const listaSeleccionada = todasListas.find(l => l.id === listaId)
          const esListaMayorista = listaSeleccionada?.tipo === 'mayorista'

          // Obtener información del producto
          const producto = productos.find(p => p.id === item.producto_id)
          const ventaMayorHabilitada = producto?.venta_mayor_habilitada || false
          const kgPorUnidadMayor = producto?.kg_por_unidad_mayor

          // Si es lista mayorista y el producto tiene venta mayor habilitada, multiplicar precio por kg_por_unidad_mayor
          let nuevoPrecio = precioResult.data.precio
          if (esListaMayorista && ventaMayorHabilitada && producto?.unidad_medida === 'kg' && kgPorUnidadMayor) {
            nuevoPrecio = precioResult.data.precio * kgPorUnidadMayor
          }

          const precioActual = item.precio_unit_est || 0

          // Solo actualizar si el precio es diferente para evitar loops
          if (Math.abs(nuevoPrecio - precioActual) > 0.01) {
            setValue(`items.${i}.precio_unit_est`, nuevoPrecio, {
              shouldValidate: true,
              shouldDirty: true
            })
          }

          // Actualizar también la lista_precio_id del item si se calculó desde lista global
          if (!listasPorProducto[i] && watchedListaPrecioGlobal) {
            setValue(`items.${i}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
          }

          // Actualizar las referencias
          ultimasListasRef.current[i] = listaId
          productosProcesadosRef.current.add(clave)
        }
      }

      // Actualizar referencia de lista global
      ultimaListaGlobalRef.current = watchedListaPrecioGlobal
    }

    actualizarPrecios()
    // Solo ejecutar cuando cambien las listas o cuando se agreguen productos nuevos
    // NO cuando cambien los items para evitar loops infinitos
  }, [watchedListaPrecioGlobal, listasPorProducto, setValue, getValues, triggerActualizacion, todasListas, productos])

  // Memoizar handleProductoChange
  const handleProductoChange = useCallback(async (index: number, productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (!producto) return

    // Usar lista individual si existe, sino usar lista global
    const listaId = listasPorProducto[index] || watchedListaPrecioGlobal

    if (listaId) {
      // Obtener información de la lista seleccionada
      const listaSeleccionada = todasListas.find(l => l.id === listaId)
      const esListaMayorista = listaSeleccionada?.tipo === 'mayorista'
      const ventaMayorHabilitada = producto.venta_mayor_habilitada || false
      const kgPorUnidadMayor = producto.kg_por_unidad_mayor


      const precioResult = await obtenerPrecioProductoAction(listaId, productoId)
      if (precioResult.success && precioResult.data) {
        // Si es lista mayorista y el producto tiene venta mayor habilitada, multiplicar precio por kg_por_unidad_mayor
        let precioFinal = precioResult.data.precio
        if (esListaMayorista && ventaMayorHabilitada && producto.unidad_medida === 'kg' && kgPorUnidadMayor) {
          precioFinal = precioResult.data.precio * kgPorUnidadMayor
        }

        setValue(`items.${index}.precio_unit_est`, precioFinal, {
          shouldValidate: true,
          shouldDirty: true
        })
        // Actualizar lista_precio_id del item si no tiene lista individual
        if (!listasPorProducto[index] && watchedListaPrecioGlobal) {
          setValue(`items.${index}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
        }
        return
      }
    }

    // Fallback a precio_venta del producto
    setValue(`items.${index}.precio_unit_est`, producto.precio_venta, {
      shouldValidate: true,
      shouldDirty: true
    })
  }, [productos, setValue, watchedListaPrecioGlobal, listasPorProducto, todasListas])

  // Memoizar función para filtrar productos con límite de resultados
  const getFilteredProductos = useCallback((index: number, searchTerm: string) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) {
      // Si no hay búsqueda, devolver solo los primeros MAX_RESULTS
      return productos.slice(0, MAX_RESULTS)
    }

    // Optimizar filtrado: buscar coincidencias exactas primero, luego parciales
    const results: typeof productos = []
    const termLower = term.toLowerCase()

    for (const producto of productos) {
      if (results.length >= MAX_RESULTS) break

      // Coincidencia exacta en código (prioridad alta)
      if (producto.codigo.toLowerCase() === termLower) {
        results.unshift(producto) // Al inicio
        continue
      }

      // Coincidencia que empieza con el término (prioridad media)
      if (
        producto.codigo.toLowerCase().startsWith(termLower) ||
        producto.nombre.toLowerCase().startsWith(termLower)
      ) {
        results.push(producto)
        continue
      }

      // Coincidencia parcial (prioridad baja)
      if (
        producto.codigo.toLowerCase().includes(termLower) ||
        producto.nombre.toLowerCase().includes(termLower)
      ) {
        results.push(producto)
      }
    }

    return results
  }, [productos])

  // Memoizar función para filtrar clientes con límite de resultados
  const MAX_RESULTS = 50 // Limitar resultados para mejor rendimiento
  const getFilteredClientes = useCallback((searchTerm: string) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) {
      // Si no hay búsqueda, devolver solo los primeros MAX_RESULTS
      return clientes.slice(0, MAX_RESULTS)
    }

    // Optimizar filtrado: buscar coincidencias exactas primero, luego parciales
    const results: typeof clientes = []
    const termLower = term.toLowerCase()

    // Asegurar que el cliente seleccionado siempre esté en la lista si existe
    const clienteSeleccionadoEnLista = watchedCliente
      ? clientes.find(c => c.id === watchedCliente)
      : null

    for (const cliente of clientes) {
      if (results.length >= MAX_RESULTS) break

      // Si es el cliente seleccionado, agregarlo primero si no está ya incluido
      if (cliente.id === watchedCliente && !results.find(c => c.id === cliente.id)) {
        results.unshift(cliente)
        continue
      }

      // Coincidencia exacta en código (prioridad alta)
      if (cliente.codigo?.toLowerCase() === termLower) {
        results.unshift(cliente) // Al inicio
        continue
      }

      // Coincidencia que empieza con el término (prioridad media)
      if (
        cliente.nombre.toLowerCase().startsWith(termLower) ||
        cliente.codigo?.toLowerCase().startsWith(termLower) ||
        cliente.telefono?.startsWith(term)
      ) {
        results.push(cliente)
        continue
      }

      // Coincidencia parcial (prioridad baja)
      if (
        cliente.nombre.toLowerCase().includes(termLower) ||
        cliente.codigo?.toLowerCase().includes(termLower) ||
        cliente.telefono?.includes(term) ||
        cliente.zona_entrega?.toLowerCase().includes(termLower)
      ) {
        results.push(cliente)
      }
    }

    // Si hay un cliente seleccionado y no está en los resultados, agregarlo al inicio
    if (clienteSeleccionadoEnLista && !results.find(c => c.id === clienteSeleccionadoEnLista.id)) {
      results.unshift(clienteSeleccionadoEnLista)
    }

    return results
  }, [clientes, watchedCliente])

  // Función para cambiar lista de un producto específico
  const handleListaProductoChange = useCallback(async (index: number, listaId: string) => {
    const nuevaListasPorProducto = { ...listasPorProducto }
    if (listaId) {
      nuevaListasPorProducto[index] = listaId
      setValue(`items.${index}.lista_precio_id`, listaId, { shouldDirty: false })
    } else {
      // Si se elimina la lista individual, usar lista global
      delete nuevaListasPorProducto[index]
      if (watchedListaPrecioGlobal) {
        setValue(`items.${index}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
      } else {
        setValue(`items.${index}.lista_precio_id`, undefined, { shouldDirty: false })
      }
    }
    setListasPorProducto(nuevaListasPorProducto)

    // Actualizar precio del producto con la nueva lista
    const item = watchedItems?.[index]
    if (item?.producto_id) {
      // Determinar qué lista usar: individual si existe, sino lista global
      const listaAUsar = listaId || watchedListaPrecioGlobal

      if (listaAUsar) {
        // Obtener información de la lista seleccionada
        const listaSeleccionada = todasListas.find(l => l.id === listaAUsar)
        const esListaMayorista = listaSeleccionada?.tipo === 'mayorista'

        // Obtener información del producto
        const productoSeleccionado = productos.find(p => p.id === item.producto_id)
        const ventaMayorHabilitada = productoSeleccionado?.venta_mayor_habilitada || false
        const kgPorUnidadMayor = productoSeleccionado?.kg_por_unidad_mayor

        const precioResult = await obtenerPrecioProductoAction(listaAUsar, item.producto_id)
        if (precioResult.success && precioResult.data) {
          // Si es lista mayorista y el producto tiene venta mayor habilitada, multiplicar precio por kg_por_unidad_mayor
          let precioFinal = precioResult.data.precio
          if (esListaMayorista && ventaMayorHabilitada && productoSeleccionado?.unidad_medida === 'kg' && kgPorUnidadMayor) {
            precioFinal = precioResult.data.precio * kgPorUnidadMayor
          }

          // Actualizar precio con todas las opciones para forzar actualización
          setValue(`items.${index}.precio_unit_est`, precioFinal, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true
          })
          // Forzar actualización del formulario y validación
          await trigger(`items.${index}.precio_unit_est`)
          // Forzar actualización del total estimado - usar setTimeout para asegurar que React procese el cambio
          setTimeout(() => {
            setTotalUpdateKey(prev => prev + 1)
          }, 0)
        }
      }
    }
  }, [listasPorProducto, watchedListaPrecioGlobal, watchedItems, setValue, getValues, trigger, watch, todasListas, productos])

  // Memoizar addItem
  const addItem = useCallback(() => {
    const newIndex = fields.length
    append({ producto_id: '', cantidad_solicitada: 1, precio_unit_est: 0, lista_precio_id: undefined })

    // Si hay lista global, asignarla al nuevo item
    if (watchedListaPrecioGlobal) {
      setValue(`items.${newIndex}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
    }

    // Enfocar el select del producto recién agregado después de que React lo renderice
    // Usar múltiples intentos para asegurar que funcione
    const focusProductSelect = (attempts = 0) => {
      if (attempts > 20) return // Máximo 20 intentos

      const nuevoProductoSelect = document.getElementById(`producto_${newIndex}`) as HTMLElement
      if (nuevoProductoSelect) {
        // Si hay un input con foco que no es el que queremos, quitarlo
        const activeElement = document.activeElement as HTMLElement
        if (activeElement && 'name' in activeElement && (activeElement as HTMLInputElement).name === `items.${newIndex}.cantidad_solicitada`) {
          activeElement.blur()
        }

        // Hacer click para abrir el dropdown
        nuevoProductoSelect.click()

        // Esperar a que se abra el dropdown y luego enfocar el input de búsqueda
        // Buscar el input dentro del SelectContent que se acaba de abrir
        const focusSearchInput = (searchAttempts = 0) => {
          if (searchAttempts > 30) return // Máximo 30 intentos para encontrar el input

          // Buscar el input de búsqueda usando el atributo data-product-search
          const searchInput = document.querySelector(`input[data-product-search="${newIndex}"]`) as HTMLInputElement
          if (searchInput) {
            // Enfocar y seleccionar el texto
            searchInput.focus()
            searchInput.select()
            return
          }

          // Fallback: buscar el input dentro del SelectContent abierto
          const selectContent = document.querySelector('[role="listbox"]') as HTMLElement
          if (selectContent) {
            // Buscar el input dentro del SelectContent
            const fallbackInput = selectContent.querySelector('input[type="text"], input[placeholder*="Buscar"]') as HTMLInputElement
            if (fallbackInput) {
              // Enfocar y seleccionar el texto
              fallbackInput.focus()
              fallbackInput.select()
              return
            }
          }

          // Si no se encuentra, intentar de nuevo después de un breve delay
          setTimeout(() => focusSearchInput(searchAttempts + 1), 50)
        }

        // Iniciar la búsqueda del input después de un pequeño delay para que el dropdown se abra
        setTimeout(() => focusSearchInput(), 100)
      } else {
        // Si no se encuentra el select, intentar de nuevo después de un breve delay
        setTimeout(() => focusProductSelect(attempts + 1), 50)
      }
    }

    // Iniciar el proceso después de que React renderice
    requestAnimationFrame(() => {
      setTimeout(() => focusProductSelect(), 100)
    })
  }, [append, fields.length])

  // Memoizar removeItem
  const removeItem = useCallback((index: number) => {
    console.log('[FORM] removeItem llamado con index:', index, 'fields.length:', fields.length)
    if (fields.length > 1) {
      console.log('[FORM] Ejecutando remove...')
      remove(index)
      // Limpiar lista individual si existe
      const nuevaListasPorProducto = { ...listasPorProducto }
      delete nuevaListasPorProducto[index]
      // Reindexar las listas (después de eliminar, los índices cambian)
      const reindexed: Record<number, string> = {}
      Object.keys(nuevaListasPorProducto).forEach(key => {
        const oldIndex = parseInt(key)
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = nuevaListasPorProducto[oldIndex]
        } else if (oldIndex < index) {
          reindexed[oldIndex] = nuevaListasPorProducto[oldIndex]
        }
      })
      setListasPorProducto(reindexed)
      console.log('[FORM] remove ejecutado, listas reindexadas')
    } else {
      console.log('[FORM] No se puede eliminar: solo queda 1 field')
    }
  }, [fields.length, remove, listasPorProducto])

  const onSubmit = async (data: CrearPresupuestoFormData) => {
    try {
      setIsLoading(true)

      const formData = new FormData()
      formData.append('cliente_id', data.cliente_id)
      if (data.zona_id) {
        formData.append('zona_id', data.zona_id)
      }
      if (data.fecha_entrega_estimada) {
        formData.append('fecha_entrega_estimada', data.fecha_entrega_estimada)
      }
      if (data.observaciones) {
        formData.append('observaciones', data.observaciones)
      }
      if (data.lista_precio_id) {
        formData.append('lista_precio_id', data.lista_precio_id)
      }
      formData.append('tipo_venta', data.tipo_venta || 'reparto')
      formData.append('items', JSON.stringify(data.items))

      const result = await crearPresupuestoAction(formData)

      // Debug completo
      console.log('[CLIENT] ===== RESULTADO CREAR PRESUPUESTO =====')
      console.log('[CLIENT] Success:', result.success)
      console.log('[CLIENT] Message:', result.message)
      console.log('[CLIENT] Data completo:', result.data)
      console.log('[CLIENT] Data keys:', result.data ? Object.keys(result.data) : 'no data')

      if (result.success) {
        showToast('success', result.message || 'Presupuesto creado exitosamente')
        const presupuestoId = result.data?.presupuesto_id

        console.log('[CLIENT] Presupuesto ID extraído:', presupuestoId)
        console.log('[CLIENT] Tipo de presupuestoId:', typeof presupuestoId)

        if (presupuestoId) {
          const url = `/ventas/presupuestos/${presupuestoId}`
          console.log('[CLIENT] ✅ Presupuesto ID válido:', presupuestoId)
          console.log('[CLIENT] 🔗 Redirigiendo a URL:', url)

          // Redirigir a la lista primero, luego el usuario puede hacer click en el presupuesto
          // Esto evita problemas de timing donde el presupuesto aún no está disponible
          showToast('success', `Presupuesto creado! Puedes verlo en la lista.`)
          router.push('/ventas/presupuestos')
          router.refresh()

          // Alternativa: intentar acceder directamente después de un delay
          // setTimeout(() => {
          //   window.location.href = url
          // }, 2000)
        } else {
          console.warn('[CLIENT] ⚠️ No se encontró presupuesto_id en result.data')
          console.warn('[CLIENT] Result.data completo:', JSON.stringify(result.data, null, 2))
          alert('Presupuesto creado pero no se pudo obtener el ID. Redirigiendo a lista.')
          router.push('/ventas/presupuestos')
        }
      } else {
        console.error('[CLIENT] Error al crear presupuesto:', result)
        showToast('error', result.error || 'Error al crear presupuesto')
      }
    } catch (error: any) {
      console.error('Error creando presupuesto:', error)
      showToast('error', error.message || 'Error al crear presupuesto')
    } finally {
      setIsLoading(false)
    }
  }

  // Atajos globales (Ctrl+Enter para guardar, Ctrl+N para agregar producto)
  // Debe estar después de la definición de onSubmit
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Solo procesar si no estamos escribiendo en un input/textarea
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      const isContentEditable = target.isContentEditable

      // Si estamos en un input de búsqueda dentro de un Select, permitir que funcione normalmente
      const isSearchInput = isInput && target.closest('[role="listbox"]')

      if (isSearchInput) {
        return // Permitir que el input de búsqueda maneje sus propios eventos
      }

      // Ctrl+Enter o Ctrl+S: Guardar presupuesto
      if ((e.key === 'Enter' || e.key === 's') && e.ctrlKey && !isInput && !isContentEditable) {
        e.preventDefault()
        if (!isLoading) {
          handleSubmit(onSubmit)()
        }
        return
      }

      // Ctrl+N: Agregar nuevo producto
      if (e.key === 'n' && e.ctrlKey && !isInput && !isContentEditable) {
        e.preventDefault()
        addItem()
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isLoading, handleSubmit, onSubmit, addItem])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información del Cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Cliente</CardTitle>
          <CardDescription>
            Selecciona el cliente para el presupuesto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cliente_id" className="flex items-center gap-2">
              Cliente *
              <KeyboardHintCompact shortcut="C" />
            </Label>
            <Select
              value={watchedCliente || ''}
              onValueChange={(value) => {
                // Establecer el valor primero
                setValue('cliente_id', value, { shouldValidate: true, shouldDirty: true })
                // Limpiar la búsqueda después de un pequeño delay para asegurar que el valor se estableció
                setTimeout(() => {
                  setClienteSearch('')
                  // Avanzar al siguiente campo (zona o fecha)
                  const zonaInput = document.getElementById('zona_id')
                  if (zonaInput) {
                    zonaInput.focus()
                  } else {
                    const fechaInput = document.getElementById('fecha_entrega_estimada')
                    if (fechaInput) {
                      fechaInput.focus()
                    }
                  }
                }, 100)
              }}
              onOpenChange={(open) => {
                setClienteDropdownOpen(open)
                if (open) {
                  // Cuando se abre, enfocar el input de búsqueda automáticamente
                  setTimeout(() => {
                    const searchInput = document.querySelector('#cliente_id ~ [role="listbox"] input, [data-radix-popper-content-wrapper] input[placeholder*="Buscar"]') as HTMLInputElement
                    if (searchInput) {
                      searchInput.focus()
                    }
                  }, 50)
                } else {
                  // Limpiar la búsqueda cuando se cierra el dropdown
                  setClienteSearch('')
                }
              }}
            >
              <SelectTrigger id="cliente_id" className={errors.cliente_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Buscar por código, nombre, teléfono o zona..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="sticky top-0 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código, nombre..."
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value)
                      }}
                      className="pl-8"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        const filtered = getFilteredClientes(debouncedClienteSearch)
                        const listaFinal = [...filtered]
                        const clienteSeleccionadoEnLista = watchedCliente
                          ? clientes.find(c => c.id === watchedCliente)
                          : null
                        if (clienteSeleccionadoEnLista && !listaFinal.find(c => c.id === clienteSeleccionadoEnLista.id)) {
                          listaFinal.unshift(clienteSeleccionadoEnLista)
                        }

                        if (e.key === 'Enter' && listaFinal.length > 0) {
                          e.preventDefault()
                          // Seleccionar el primer resultado
                          const primerCliente = listaFinal[0]
                          setValue('cliente_id', primerCliente.id, { shouldValidate: true, shouldDirty: true })
                          setClienteSearch('')
                          setClienteDropdownOpen(false)
                          // Avanzar al siguiente campo (zona o fecha)
                          setTimeout(() => {
                            const zonaInput = document.getElementById('zona_id')
                            if (zonaInput) {
                              zonaInput.focus()
                            } else {
                              const fechaInput = document.getElementById('fecha_entrega_estimada')
                              if (fechaInput) {
                                fechaInput.focus()
                              }
                            }
                          }, 100)
                        } else if (e.key === 'Tab' && !e.shiftKey) {
                          // Si hay un cliente seleccionado, cerrar dropdown y avanzar
                          if (watchedCliente) {
                            setClienteDropdownOpen(false)
                          }
                          // Permitir que TAB funcione normalmente
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          setClienteDropdownOpen(false)
                          const trigger = document.getElementById('cliente_id')
                          if (trigger) {
                            trigger.focus()
                          }
                        }
                      }}
                      autoComplete="off"
                    />
                    {clienteSearch && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setClienteSearch('')
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {(() => {
                    const filtered = getFilteredClientes(debouncedClienteSearch)
                    const totalClientes = clientes.length
                    const showingAll = filtered.length >= totalClientes || filtered.length < MAX_RESULTS

                    // Asegurar que el cliente seleccionado siempre esté en la lista si existe
                    const clienteSeleccionadoEnLista = watchedCliente
                      ? clientes.find(c => c.id === watchedCliente)
                      : null

                    // Si hay un cliente seleccionado y no está en los resultados filtrados, agregarlo
                    const listaFinal = [...filtered]
                    if (clienteSeleccionadoEnLista && !listaFinal.find(c => c.id === clienteSeleccionadoEnLista.id)) {
                      listaFinal.unshift(clienteSeleccionadoEnLista)
                    }

                    return listaFinal.length > 0 ? (
                      <>
                        {listaFinal.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.codigo && `[${cliente.codigo}] `}
                            {cliente.nombre} {cliente.telefono && `- ${cliente.telefono}`}
                            {cliente.zona_entrega && ` (${cliente.zona_entrega})`}
                          </SelectItem>
                        ))}
                        {!showingAll && (
                          <div className="px-2 py-2 text-xs text-muted-foreground text-center border-t bg-muted/50">
                            Mostrando {listaFinal.length} de {totalClientes} clientes
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No se encontraron clientes
                      </div>
                    )
                  })()}
                </div>
              </SelectContent>
            </Select>
            {errors.cliente_id && (
              <p className="text-sm text-red-500 mt-1">{errors.cliente_id.message}</p>
            )}
          </div>

          {/* Tipo de Venta - Visible después de seleccionar cliente */}
          {clienteSeleccionado && (
            <div className="space-y-2">
              <Label>Tipo de Venta *</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="reparto"
                    checked={watch('tipo_venta') === 'reparto'}
                    onChange={() => setValue('tipo_venta', 'reparto')}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm font-medium">🚚 Reparto (entrega a domicilio)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="retira_casa_central"
                    checked={watch('tipo_venta') === 'retira_casa_central'}
                    onChange={() => setValue('tipo_venta', 'retira_casa_central')}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-sm font-medium">🏠 Retira en Casa Central</span>
                </label>
              </div>
              {watch('tipo_venta') === 'retira_casa_central' && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ Este presupuesto no irá a almacén ni reparto. Se podrá facturar directamente.
                </p>
              )}
            </div>
          )}

          {/* Zona y Fecha - Solo visible para reparto */}
          {clienteSeleccionado && watch('tipo_venta') === 'reparto' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="zona_id" className="flex items-center gap-2">
                  Zona de Entrega
                  <KeyboardHintCompact shortcut="Z" />
                </Label>
                <Select
                  key={watchedCliente} // Forzar re-render al cambiar cliente
                  value={watch('zona_id') || ''}
                  onValueChange={(value) => {
                    setValue('zona_id', value, { shouldValidate: true, shouldDirty: true })
                    // Avanzar a fecha después de seleccionar zona
                    setTimeout(() => {
                      const fechaInput = document.getElementById('fecha_entrega_estimada')
                      if (fechaInput) {
                        fechaInput.focus()
                      }
                    }, 100)
                  }}
                >
                  <SelectTrigger id="zona_id">
                    <SelectValue placeholder="Selecciona una zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonas.map((zona) => (
                      <SelectItem key={zona.id} value={zona.id}>
                        {zona.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fecha_entrega_estimada" className="flex items-center gap-2">
                  Fecha de Entrega Estimada
                  <KeyboardHintCompact shortcut="F" />
                </Label>
                <DateInput
                  id="fecha_entrega_estimada"
                  value={watch('fecha_entrega_estimada')}
                  onChange={(value) => setValue('fecha_entrega_estimada', value)}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="lista_precio_id" className="flex items-center gap-2">
              Lista de Precios (Global)
              <KeyboardHintCompact shortcut="L" />
            </Label>
            <Select
              value={watch('lista_precio_id') || ''}
              onValueChange={(value) => {
                setValue('lista_precio_id', value)
                // Actualizar lista_precio_id de items que usan lista global
                watchedItems?.forEach((_, index) => {
                  if (!listasPorProducto[index]) {
                    setValue(`items.${index}.lista_precio_id`, value, { shouldDirty: false })
                  }
                })
                // Avanzar al primer producto después de seleccionar lista
                setTimeout(() => {
                  const firstProductSelect = document.getElementById('producto_0')
                  if (firstProductSelect) {
                    firstProductSelect.click()
                    setTimeout(() => {
                      const searchInput = document.querySelector('input[data-product-search="0"]') as HTMLInputElement
                      if (searchInput) {
                        searchInput.focus()
                        searchInput.select()
                      }
                    }, 100)
                  }
                }, 100)
              }}
              disabled={cargandoListas || !!errorListas}
            >
              <SelectTrigger id="lista_precio_id">
                <SelectValue placeholder={
                  cargandoListas
                    ? 'Cargando listas...'
                    : errorListas
                      ? 'Error al cargar listas'
                      : 'Selecciona una lista de precios (por defecto para todos los productos)'
                } />
              </SelectTrigger>
              <SelectContent>
                {todasListas.length > 0 ? (
                  todasListas.map((lista) => (
                    <SelectItem key={lista.id} value={lista.id}>
                      {lista.codigo} - {lista.nombre} {lista.margen_ganancia && `(${lista.margen_ganancia}% margen)`}
                    </SelectItem>
                  ))
                ) : !cargandoListas ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    {errorListas ? `Error: ${errorListas}` : 'No hay listas disponibles'}
                  </div>
                ) : null}
              </SelectContent>
            </Select>
            {errorListas && (
              <p className="text-sm text-red-500 mt-1">
                Error al cargar listas. Intenta recargar la página.
              </p>
            )}
            {watch('lista_precio_id') && (
              <p className="text-sm text-muted-foreground mt-1">
                Lista por defecto para todos los productos. Puedes cambiar la lista individualmente en cada producto.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items del Presupuesto - Nueva Tabla Compacta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Escribí el código o nombre y presioná Enter para agregar rápidamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PresupuestoItemsTable
            items={watchedItems || []}
            productos={productos}
            listas={todasListas}
            listaGlobalId={watchedListaPrecioGlobal}
            control={control}
            register={register}
            setValue={setValue}
            watch={watch}
            onProductoChange={handleProductoChange}
            onListaChange={handleListaProductoChange}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            errors={errors}
          />

          {errors.items && errors.items.root && (
            <p className="text-sm text-red-500">{errors.items.root.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Observaciones
            <KeyboardHintCompact shortcut="O" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="observaciones"
            {...register('observaciones')}
            rows={4}
            placeholder="Agregar notas o instrucciones especiales..."
          />
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Estimado:</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(totalEstimado)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Resumen y Total */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Estimado</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(totalEstimado)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {itemsParaTotal?.length || 0} productos
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">
                💡 <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+Enter</kbd> para guardar rápido
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear Presupuesto
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

