'use client'

import type { ReactNode } from 'react'

type PrintButtonProps = {
  children: ReactNode
  className?: string
}

export function PrintButton({ children, className }: PrintButtonProps) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  )
}
