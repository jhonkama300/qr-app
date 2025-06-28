import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth-provider"
import { StudentStoreProvider } from "@/components/providers/student-store-provider" // Importar StudentStoreProvider

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Login con Firebase",
  description: "Aplicación de autenticación con Firebase",
    generator: 'v0.dev'
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
                    <StudentStoreProvider>

          {children}
                    </StudentStoreProvider>
          </AuthProvider>
      </body>
    </html>
  )
}
