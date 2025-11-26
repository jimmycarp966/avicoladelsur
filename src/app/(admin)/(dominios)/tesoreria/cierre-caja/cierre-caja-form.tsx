'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { crearCierreCajaAction } from '@/actions/tesoreria.actions'
import { toast } from 'sonner'
import { getTodayArgentina } from '@/lib/utils'

interface CierreCajaFormProps {
  cajas: Array<{ id: string; nombre: string; moneda: string }>
}

export function CierreCajaForm({ cajas }: CierreCajaFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [cajaId, setCajaId] = useState('')
  const [fecha, setFecha] = useState(getTodayArgentina())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!cajaId || !fecha) {
        toast.error('Completa todos los campos requeridos')
        setLoading(false)
        return
      }

      const formData = new FormData()
      formData.append('caja_id', cajaId)
      formData.append('fecha', fecha)

      const result = await crearCierreCajaAction(formData)

      if (result.success) {
        toast.success(result.message || 'Cierre de caja creado exitosamente')
        setCajaId('')
        router.refresh()
      } else {
        toast.error(result.message || 'Error al crear cierre de caja')
      }
    } catch (error) {
      toast.error('Error inesperado al crear cierre de caja')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Crear Cierre de Caja
        </CardTitle>
        <CardDescription>
          Crea un nuevo cierre de caja para una fecha específica
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="caja" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Caja *
              </Label>
              <Select value={cajaId} onValueChange={setCajaId} required>
                <SelectTrigger id="caja">
                  <SelectValue placeholder="Selecciona una caja" />
                </SelectTrigger>
                <SelectContent>
                  {cajas.map(caja => (
                    <SelectItem key={caja.id} value={caja.id}>
                      {caja.nombre} ({caja.moneda})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creando...' : 'Crear Cierre de Caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

