"use client"

import type { ReactNode } from "react"

type PrintButtonProps = {
  className?: string
  children: ReactNode
}

export function PrintButton({ children, className }: PrintButtonProps) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  )
}
