import LoginForm from "@/components/login-form"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
