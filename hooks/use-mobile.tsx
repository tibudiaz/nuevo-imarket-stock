"use client"

import { useState, useEffect } from "react"

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Verificar si estamos en un navegador
    if (typeof window !== "undefined") {
      // Función para verificar si es un dispositivo móvil
      const checkMobile = () => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera

        // Verificar si es un dispositivo móvil basado en el user agent
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent.toLowerCase(),
        )

        // También verificar el tamaño de la pantalla
        const isSmallScreen = window.innerWidth < 768

        setIsMobile(isMobileDevice || isSmallScreen)
      }

      // Verificar inicialmente
      checkMobile()

      // Verificar cuando cambie el tamaño de la ventana
      window.addEventListener("resize", checkMobile)

      // Limpiar el event listener
      return () => {
        window.removeEventListener("resize", checkMobile)
      }
    }
  }, [])

  return isMobile
}
