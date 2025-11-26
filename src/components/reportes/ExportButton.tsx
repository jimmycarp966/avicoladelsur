'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface ExportButtonProps {
  onExport: (format: 'csv' | 'excel' | 'pdf') => Promise<void>
  disabled?: boolean
  className?: string
}

export function ExportButton({ onExport, disabled = false, className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true)
    try {
      await onExport(format)
      toast.success(`Reporte exportado en formato ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Error al exportar:', error)
      toast.error('Error al exportar el reporte')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isExporting} className={className}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Exportar
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')} disabled={isExporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

