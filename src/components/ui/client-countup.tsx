'use client'

import { useSyncExternalStore } from 'react'
import CountUp, { CountUpProps } from 'react-countup'

const emptySubscribe = () => () => {}

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

export function ClientCountUp({ end = 0, separator = '.', decimal = ',', decimals = 0, ...props }: CountUpProps) {
  const isClient = useIsClient()
  const safeEnd = Number(end) || 0

  if (!isClient) {
    return safeEnd.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  return (
    <CountUp
      end={safeEnd}
      separator={separator}
      decimal={decimal}
      decimals={decimals}
      {...props}
    />
  )
}
