import Link from "next/link";
import { Bot, CheckCircle2, Clock, MessageCircle, Shield, TrendingUp, Users, Zap } from "lucide-react";

const niches = ["Clínicas de estética", "Barbearias", "Clínicas odontológicas", "Pet shops", "Oficinas", "Lojas locais", "Prestadores de serviço", "Transportadoras pequenas"];
const plans = [
  { name: "Inicial", setup: "R$497", monthly: "R$297/mês", features: ["1 WhatsApp", "Base de conhecimento", "Follow-up básico"] },
  { name: "Profissional", setup: "R$1.500", monthly: "R$497/mês", features: ["Fluxos por nicho", "Relatórios", "Ajuste fino da IA"], highlight: true },
  { name: "Premium", setup: "R$2.500", monthly: "R$797/mês", features: ["Mais automações", "Monitoramento", "Prioridade de suporte"] }
];

export default function HomePage() {
  return (
    <main className="bg-[#f7faf8]">
      <section className="bg-fluir-dark text-white">
        <div className="mx-auto flex min-h-[92vh] max-w-7xl flex-col px-6 py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-400 text-slate-950">
                <Bot size={22} />
              </div>
              <div>
                <p className="font-bold">Fluir Tecnologia</p>
                <p className="text-xs text-emerald-100">Atendente IA para WhatsApp</p>
              </div>
            </div>
            <Link className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-950" href="/admin">
              Acessar painel
            </Link>
          </nav>

          <div className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-sm text-emerald-100">
                SaaS operacional com n8n, WAHA e IA conversacional
              </div>
              <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                Atendente IA para WhatsApp que responde seus clientes 24h por dia
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                Automatize respostas, capture interessados, envie follow-ups e pare de perder clientes por demora no atendimento.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="btn-primary px-5 py-3" href="/demo">
                  <MessageCircle size={18} /> Ver demonstração
                </Link>
                <a className="btn-secondary px-5 py-3" href="#planos">
                  <Zap size={18} /> Quero automatizar meu WhatsApp
                </a>
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-white p-4 text-slate-950 shadow-soft">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="font-bold">Clínica Bella Estética</p>
                  <p className="text-xs text-emerald-600">online agora</p>
                </div>
                <span className="badge bg-emerald-50 text-emerald-700">IA ativa</span>
              </div>
              {[
                ["Cliente", "Oi, queria saber valor de limpeza de pele"],
                ["IA", "Olá! A limpeza de pele custa R$120 e dura cerca de 1 hora. Posso verificar os melhores horários para você?"],
                ["Cliente", "Tem horário amanhã?"],
                ["IA", "Consigo te ajudar. Me diga seu nome e se prefere manhã ou tarde."]
              ].map(([who, text], index) => (
                <div key={index} className={`mb-3 flex ${who === "IA" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[82%] rounded-md px-4 py-3 text-sm ${who === "IA" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-900"}`}>
                    <p className="mb-1 text-xs font-semibold opacity-75">{who}</p>
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["Problema", "Clientes chamam no WhatsApp e esperam resposta rápida. Quando há demora, eles cotam com outro fornecedor.", Clock],
            ["Solução", "A IA responde dúvidas, qualifica interesse, registra lead e chama humano quando o assunto pede cuidado.", Bot],
            ["Como funciona", "WAHA recebe mensagens, n8n orquestra fluxos e o painel da Fluir centraliza dados, base e relatórios.", TrendingUp]
          ].map(([title, text, Icon]) => (
            <div key={String(title)} className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
              <Icon className="mb-4 text-emerald-500" />
              <h2 className="text-xl font-bold">{title as string}</h2>
              <p className="mt-3 leading-7 text-slate-600">{text as string}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-black">Benefícios para pequenas empresas</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {["Resposta instantânea", "Mais leads registrados", "Menos atendimento repetitivo", "Follow-up sem bagunça"].map((item) => (
              <div className="flex items-center gap-3 rounded-md border border-slate-200 p-4" key={item}>
                <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
                <span className="font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="text-3xl font-black">Nichos atendidos</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {niches.map((niche) => (
            <div className="rounded-md bg-white p-4 font-semibold shadow-sm" key={niche}>
              {niche}
            </div>
          ))}
        </div>
      </section>

      <section id="planos" className="bg-fluir-dark py-16 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-black">Planos</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-md border p-6 ${plan.highlight ? "border-emerald-300 bg-white text-slate-950" : "border-white/10 bg-white/5"}`}>
                <h3 className="text-2xl font-black">Plano {plan.name}</h3>
                <p className="mt-4 text-3xl font-black text-emerald-400">{plan.setup}</p>
                <p className="text-sm opacity-80">implantação + {plan.monthly}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li className="flex gap-2" key={feature}><CheckCircle2 className="text-emerald-400" size={18} />{feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-black">FAQ</h2>
          <div className="mt-6 space-y-4">
            {[
              ["Preciso trocar meu WhatsApp?", "Não. O WAHA conecta uma sessão e o session name é vinculado ao cliente no painel."],
              ["A IA agenda sozinha?", "Ela coleta dados e intenção. Horários reais devem vir de integração ou validação humana."],
              ["Tem opt-out?", "Sim. Pedidos como parar, cancelar ou sair bloqueiam follow-ups automáticos."]
            ].map(([q, a]) => (
              <div className="rounded-md bg-white p-5 shadow-sm" key={q}>
                <h3 className="font-bold">{q}</h3>
                <p className="mt-2 text-slate-600">{a}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md bg-white p-8 shadow-soft">
          <Shield className="text-emerald-500" />
          <h2 className="mt-4 text-3xl font-black">Pronto para operar com cuidado comercial e LGPD</h2>
          <p className="mt-4 leading-7 text-slate-600">
            O painel registra leads, respeita opt-out, pausa atendimento automático quando humano é necessário e evita disparos em massa.
          </p>
          <a className="btn-primary mt-6" href="mailto:contato@fluirtecnologia.com.br">
            <Users size={18} /> Quero conversar com a Fluir
          </a>
        </div>
      </section>
    </main>
  );
}
