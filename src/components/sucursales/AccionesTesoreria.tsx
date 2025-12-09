'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LockOpen, Lock, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { AbrirCajaDialog } from './AbrirCajaDialog'
import { CerrarCajaDialog } from './CerrarCajaDialog'
import { IngresoEgresoDialog } from './IngresoEgresoDialog'

interface AccionesTesoreriaProps {
  cajaId: string
  cajaNombre: string
  cierreAbierto: any
  totalesCierre: {
    ingresos: number
    egresos: number
    cobranzasCC: number
    gastos: number
  }
  saldoInicial: number
  saldoActual: number
}

export function AccionesTesoreria({
  cajaId,
  cajaNombre,
  cierreAbierto,
  totalesCierre,
  saldoInicial,
  saldoActual,
}: AccionesTesoreriaProps) {
  const [abrirDialogOpen, setAbrirDialogOpen] = useState(false)
  const [cerrarDialogOpen, setCerrarDialogOpen] = useState(false)
  const [ingresoDialogOpen, setIngresoDialogOpen] = useState(false)
  const [egresoDialogOpen, setEgresoDialogOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!cierreAbierto ? (
          <Button
            onClick={() => setAbrirDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <LockOpen className="mr-2 h-4 w-4" />
            Abrir Caja
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setCerrarDialogOpen(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Lock className="mr-2 h-4 w-4" />
              Cerrar Caja
            </Button>
            <Button
              onClick={() => setIngresoDialogOpen(true)}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Ingreso
            </Button>
            <Button
              onClick={() => setEgresoDialogOpen(true)}
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-50"
            >
              <ArrowDownRight className="mr-2 h-4 w-4" />
              Egreso
            </Button>
          </>
        )}
      </div>

      <AbrirCajaDialog
        open={abrirDialogOpen}
        onOpenChange={setAbrirDialogOpen}
        cajaId={cajaId}
        cajaNombre={cajaNombre}
        saldoActual={saldoActual}
      />

      {cierreAbierto && (
        <CerrarCajaDialog
          open={cerrarDialogOpen}
          onOpenChange={setCerrarDialogOpen}
          cierreId={cierreAbierto.id}
          saldoInicial={saldoInicial}
          totalIngresos={totalesCierre.ingresos}
          totalEgresos={totalesCierre.egresos}
          totalCobranzasCC={totalesCierre.cobranzasCC}
          totalGastos={totalesCierre.gastos}
        />
      )}

      <IngresoEgresoDialog
        open={ingresoDialogOpen}
        onOpenChange={setIngresoDialogOpen}
        cajaId={cajaId}
        tipo="ingreso"
      />

      <IngresoEgresoDialog
        open={egresoDialogOpen}
        onOpenChange={setEgresoDialogOpen}
        cajaId={cajaId}
        tipo="egreso"
      />
    </>
  )
}

