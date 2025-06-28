import { DashboardLayout } from "@/components/dashboard-layout"

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center">
            <p className="text-muted-foreground">Contenido 1</p>
          </div>
          <div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center">
            <p className="text-muted-foreground">Contenido 2</p>
          </div>
          <div className="aspect-video rounded-xl bg-muted/50 flex items-center justify-center">
            <p className="text-muted-foreground">Contenido 3</p>
          </div>
        </div>
        <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min flex items-center justify-center">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Bienvenido al Dashboard</h2>
            <p className="text-muted-foreground">Aquí puedes agregar tu contenido principal</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
