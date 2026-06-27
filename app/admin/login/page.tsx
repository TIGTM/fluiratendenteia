import { loginAction } from "@/app/admin/actions";
import { Bot } from "lucide-react";

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fluir-dark px-6">
      <form action={loginAction} className="w-full max-w-md rounded-md bg-white p-8 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-500 text-white">
            <Bot />
          </div>
          <div>
            <h1 className="text-xl font-black">Fluir Atendente IA</h1>
            <p className="text-sm text-slate-500">Painel administrativo</p>
          </div>
        </div>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">E-mail</span>
          <input className="admin-input" name="email" type="email" defaultValue="admin@fluir.local" required />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">Senha</span>
          <input className="admin-input" name="password" type="password" defaultValue="admin123" required />
        </label>
        {searchParams?.error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">E-mail ou senha inválidos.</p> : null}
        <button className="btn-primary w-full" type="submit">
          Entrar
        </button>
      </form>
    </main>
  );
}
