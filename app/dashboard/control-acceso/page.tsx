import { DashboardLayout } from "@/components/dashboard-layout"
import { AccessControl } from "@/components/access-control"

export default function ControlAccesoPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 p-2 md:p-4">
        <AccessControl />
      </div>
    </DashboardLayout>
  )
}
