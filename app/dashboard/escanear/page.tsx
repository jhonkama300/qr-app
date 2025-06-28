import { DashboardLayout } from "@/components/dashboard-layout"
import { BarcodeScanner } from "@/components/barcode-scanner"
//import { StudentStoreProvider } from "@/components/providers/student-store-provider"

export default function EscanearPage() {
  return (
    <DashboardLayout>
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <BarcodeScanner />
        </div>
    </DashboardLayout>
  )
}
