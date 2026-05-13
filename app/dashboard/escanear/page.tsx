import { DashboardLayout } from "@/components/dashboard-layout"
import { BarcodeScanner } from "@/components/barcode-scanner"

export default function EscanearPage() {
  return (
    <DashboardLayout>
      <BarcodeScanner />
    </DashboardLayout>
  )
}
