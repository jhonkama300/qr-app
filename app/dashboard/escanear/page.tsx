"use client"

import { useAuth } from "@/components/auth-provider"
import { BarcodeScanner } from "@/components/barcode-scanner"
import { BuffeteScanner } from "@/components/bufete-scanner"

export default function EscanearPage() {
  const { activeRole } = useAuth()

  if (activeRole === "bufete") {
    return <BuffeteScanner />
  }

  return <BarcodeScanner />
}