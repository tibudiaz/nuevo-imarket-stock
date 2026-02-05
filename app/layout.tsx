import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner" // Importa el Toaster de sonner
import FirebaseProvider from "@/components/firebase-provider"
import PathCleaner from "@/components/path-cleaner"
import type { Metadata } from "next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "iMarket - Sistema de Gestión",
  description: "Sistema de gestión para tienda de celulares",
  openGraph: {
    title: "iMarket - Sistema de Gestión",
    description: "Sistema de gestión para tienda de celulares",
    type: "website",
    locale: "es_AR",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Vista previa de iMarket",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "iMarket - Sistema de Gestión",
    description: "Sistema de gestión para tienda de celulares",
    images: ["/opengraph-image"],
  },
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
          <PathCleaner />
          {children}
          {/* Este es el Toaster de sonner */}
          <Toaster position="top-right" richColors />
        </FirebaseProvider>
      </body>
    </html>
  )
}
