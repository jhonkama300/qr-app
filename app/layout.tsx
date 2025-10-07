import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { StudentAuthProvider } from "@/components/student-auth-provider"
import { StudentStoreProvider } from "@/components/providers/student-store-provider"
import { SessionProvider } from "@/components/session-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Control de Acceso Uparsistem",
  description: "Sistema de control de acceso con QR",
  icons: {
    icon: "/images/logoupar.ico",
    shortcut: "/favicon-16x16.png",
  },
    generator: 'v0.app'
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
          <StudentAuthProvider>
            <StudentStoreProvider>
              <SessionProvider>{children}</SessionProvider>
            </StudentStoreProvider>
          </StudentAuthProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
