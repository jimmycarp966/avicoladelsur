'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PrintActionsProps = {
  backHref: string
}

export function PrintActions({ backHref }: PrintActionsProps) {
  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <Button variant="outline" asChild>
        <Link href={backHref}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Link>
      </Button>
      <Button onClick={() => window.print()}>
        <Printer className="w-4 h-4 mr-2" />
        Imprimir
      </Button>
    </div>
  )
}

