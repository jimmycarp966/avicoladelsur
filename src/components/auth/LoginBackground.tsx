'use client'

import { useEffect } from 'react'

export function LoginBackground() {
  useEffect(() => {
    // Forzar fondo verde oscuro en html, body y #__next
    const html = document.documentElement
    const body = document.body
    const nextRoot = document.getElementById('__next')
    const main = document.querySelector('main')

    // Aplicar estilos directamente
    html.style.backgroundColor = '#2F7058'
    body.style.backgroundColor = '#2F7058'
    if (nextRoot) {
      nextRoot.style.backgroundColor = '#2F7058'
    }
    if (main) {
      main.style.backgroundColor = '#2F7058'
    }

    // Cleanup: restaurar estilos cuando el componente se desmonte
    return () => {
      html.style.backgroundColor = ''
      body.style.backgroundColor = ''
      if (nextRoot) {
        nextRoot.style.backgroundColor = ''
      }
      if (main) {
        main.style.backgroundColor = ''
      }
    }
  }, [])

  return null
}




