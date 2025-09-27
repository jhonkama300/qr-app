import LoginForm from "@/components/login-form"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
