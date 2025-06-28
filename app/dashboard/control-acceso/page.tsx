import { DashboardLayout } from "@/components/dashboard-layout"
import { AccessControl } from "@/components/access-control"

export default function ControlAccesoPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <AccessControl />
      </div>
    </DashboardLayout>
  )
}
