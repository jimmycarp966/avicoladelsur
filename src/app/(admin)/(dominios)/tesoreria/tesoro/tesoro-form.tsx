'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownCircle, ArrowUpCircle, Wallet, CreditCard, Receipt } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { registrarRetiroTesoroAction, registrarDepositoBancarioAction } from '@/actions/tesoreria.actions'
import { registrarGasto } from '@/actions/gastos.actions'
import { toast } from 'sonner'

interface TesoroFormProps {
  categorias: Array<{ id: string; nombre: string }>
}

export function TesoroForm({ categorias }: TesoroFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'retiro' | 'deposito' | 'gasto'>('retiro')
  const [tipo, setTipo] = useState<'efectivo' | 'transferencia' | 'qr' | 'tarjeta'>('efectivo')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [numeroTransaccion, setNumeroTransaccion] = useState('')
  
  // Estados para gasto
  const [categoriaId, setCategoriaId] = useState('')
  const [fechaGasto, setFechaGasto] = useState(new Date().toISOString().split('T')[0])
  const [metodoPagoGasto, setMetodoPagoGasto] = useState<'efectivo' | 'transferencia' | 'qr' | 'tarjeta'>('transferencia')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!monto || parseFloat(monto) <= 0) {
        toast.error('Ingresa un monto válido')
        setLoading(false)
        return
      }

      if (action === 'retiro') {
        const formData = new FormData()
        formData.append('tipo', tipo)
        formData.append('monto', monto)
        if (descripcion) {
          formData.append('descripcion', descripcion)
        }

        const result = await registrarRetiroTesoroAction(formData)

        if (result.success) {
          toast.success(result.message || 'Retiro registrado exitosamente')
          setMonto('')
          setDescripcion('')
          router.refresh()
        } else {
          toast.error(result.message || 'Error al registrar retiro')
        }
      } else if (action === 'gasto') {
        // Registrar gasto desde tesoro
        if (!categoriaId) {
          toast.error('Selecciona una categoría')
          setLoading(false)
          return
        }

        const result = await registrarGasto({
          categoria_id: categoriaId,
          monto: parseFloat(monto),
          descripcion: descripcion || undefined,
          fecha: fechaGasto,
          metodo_pago: metodoPagoGasto,
          afecta_caja: false, // No afecta caja cuando se registra desde tesoro
        })

        if (result.success) {
          toast.success(result.message || 'Gasto registrado exitosamente')
          setMonto('')
          setDescripcion('')
          setCategoriaId('')
          setFechaGasto(new Date().toISOString().split('T')[0])
          router.refresh()
        } else {
          toast.error(result.error || 'Error al registrar gasto')
        }
      } else {
        // Depósito bancario
        if (!numeroTransaccion) {
          toast.error('Número de transacción requerido para depósitos')
          setLoading(false)
          return
        }

        // Validar número BNA (sin 0 inicial)
        if (numeroTransaccion.startsWith('0')) {
          toast.error('El número de transacción BNA no debe empezar con 0')
          setLoading(false)
          return
        }

        const formData = new FormData()
        formData.append('monto', monto)
        formData.append('numero_transaccion', numeroTransaccion)

        const result = await registrarDepositoBancarioAction(formData)

        if (result.success) {
          toast.success(result.message || 'Depósito registrado exitosamente')
          setMonto('')
          setNumeroTransaccion('')
          router.refresh()
        } else {
          toast.error(result.message || 'Error al registrar depósito')
        }
      }
    } catch (error) {
      toast.error('Error inesperado al procesar la operación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Operaciones de Tesoro
        </CardTitle>
        <CardDescription>
          Registra retiros, depósitos bancarios o gastos del tesoro
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={action} onValueChange={(value) => setAction(value as 'retiro' | 'deposito' | 'gasto')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="retiro" className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              Retiro
            </TabsTrigger>
            <TabsTrigger value="deposito" className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Depósito Bancario
            </TabsTrigger>
            <TabsTrigger value="gasto" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Gasto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="retiro" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo-retiro">Tipo *</Label>
                  <Select value={tipo} onValueChange={(value) => setTipo(value as typeof tipo)} required>
                    <SelectTrigger id="tipo-retiro">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="qr">QR</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monto-retiro">Monto *</Label>
                  <Input
                    id="monto-retiro"
                    type="number"
                    step="0.01"
                    min="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion-retiro">Descripción</Label>
                <Input
                  id="descripcion-retiro"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Motivo del retiro..."
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Registrando...' : 'Registrar Retiro'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="deposito" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="monto-deposito">Monto *</Label>
                <Input
                  id="monto-deposito"
                  type="number"
                  step="0.01"
                  min="0"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero-transaccion" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Número de Transacción BNA *
                </Label>
                <Input
                  id="numero-transaccion"
                  value={numeroTransaccion}
                  onChange={(e) => {
                    // Validar que no empiece con 0
                    const value = e.target.value.replace(/^0+/, '')
                    setNumeroTransaccion(value)
                  }}
                  placeholder="Número sin 0 inicial"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El número de transacción BNA no debe empezar con 0
                </p>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Registrando...' : 'Registrar Depósito'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="gasto" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="categoria-gasto">Categoría *</Label>
                  <Select value={categoriaId} onValueChange={setCategoriaId} required>
                    <SelectTrigger id="categoria-gasto">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((categoria) => (
                        <SelectItem key={categoria.id} value={categoria.id}>
                          {categoria.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha-gasto">Fecha *</Label>
                  <Input
                    id="fecha-gasto"
                    type="date"
                    value={fechaGasto}
                    onChange={(e) => setFechaGasto(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="monto-gasto">Monto *</Label>
                  <Input
                    id="monto-gasto"
                    type="number"
                    step="0.01"
                    min="0"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metodo-pago-gasto">Método de pago *</Label>
                  <Select
                    value={metodoPagoGasto}
                    onValueChange={(value) => setMetodoPagoGasto(value as typeof metodoPagoGasto)}
                    required
                  >
                    <SelectTrigger id="metodo-pago-gasto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="qr">QR</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si es transferencia, se registrará automáticamente en tesoro
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion-gasto">Descripción</Label>
                <Textarea
                  id="descripcion-gasto"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalle del gasto..."
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Registrando...' : 'Registrar Gasto'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

