import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner" // Importa el Toaster de sonner
import FirebaseProvider from "@/components/firebase-provider"
import PathCleaner from "@/components/path-cleaner"
import type { Metadata } from "next"

const inter = Inter({ subsets: ["latin"] })

const LOCAL_STORE_IMAGE_PATH = "/local-store-image.jpg"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "iMarket - Tu próximo celular está aquí",
  description: "Tu próximo celular está aquí",
  openGraph: {
    title: "iMarket - Tu próximo celular está aquí",
    description: "Tu próximo celular está aquí",
    type: "website",
    locale: "es_AR",
    images: [
      {
        url: LOCAL_STORE_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "Tu próximo celular está aquí",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "iMarket - Tu próximo celular está aquí",
    description: "Tu próximo celular está aquí",
    images: [LOCAL_STORE_IMAGE_PATH],
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
