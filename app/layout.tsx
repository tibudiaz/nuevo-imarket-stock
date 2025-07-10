import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner" // Importa el Toaster de sonner
import FirebaseProvider from "@/components/firebase-provider"
import type { Metadata } from "next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "iMarket - Sistema de Gestión",
  description: "Sistema de gestión para tienda de celulares",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <FirebaseProvider>
          {children}
          {/* Este es el Toaster de sonner */}
          <Toaster position="top-right" richColors />
        </FirebaseProvider>
      </body>
    </html>
  )
}