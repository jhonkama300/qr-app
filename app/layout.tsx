import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { StudentStoreProvider } from "@/components/providers/student-store-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Control de Acceso",
  description: "Sistema de control de acceso con QR",
  generator: "v0.dev",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <StudentStoreProvider>{children}</StudentStoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
