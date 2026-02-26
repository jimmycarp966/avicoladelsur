'use client'

import Link from 'next/link'
import { ArrowLeft, FileText, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PrintActionsProps = {
  backHref: string
  simpleHref?: string
}

export function PrintActions({ backHref, simpleHref }: PrintActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <Button variant="outline" asChild>
        <Link href={backHref}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        {simpleHref && (
          <Button variant="outline" asChild>
            <Link href={simpleHref}>
              <FileText className="w-4 h-4 mr-2" />
              Recibí (comprobante)
            </Link>
          </Button>
        )}
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>
    </div>
  )
}
