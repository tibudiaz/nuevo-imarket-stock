import LoginForm from "@/components/login-form"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-800">iMarket</h1>
          <p className="mt-2 text-slate-600">Sistema de gestión para tu negocio de celulares</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
