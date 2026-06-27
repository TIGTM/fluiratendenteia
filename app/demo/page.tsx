"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";

const demos = {
  Estética: [
    ["Cliente", "Oi, queria saber valor de limpeza de pele"],
    ["IA", "Olá! Que bom te receber por aqui. A limpeza de pele custa R$120 e dura cerca de 1 hora. Posso verificar os melhores horários para você?"],
    ["Cliente", "Tem horário amanhã?"],
    ["IA", "Consigo te ajudar com o agendamento. Me diga seu nome e se prefere manhã ou tarde."]
  ],
  Barbearia: [
    ["Cliente", "Boa tarde, quanto está corte e barba?"],
    ["IA", "Boa tarde! Corte + barba está a partir de R$65. Quer que eu veja uma opção de horário para hoje ou amanhã?"],
    ["Cliente", "Hoje depois das 18 tem?"],
    ["IA", "Posso registrar sua preferência. Me passa seu nome e a unidade desejada para a equipe confirmar o horário certinho."]
  ],
  Oficina: [
    ["Cliente", "Meu carro está fazendo barulho quando freia"],
    ["IA", "Entendi. Pode ser necessário avaliar pastilhas, discos ou suspensão. Qual o modelo do carro e em qual bairro você está?"],
    ["Cliente", "É um Onix 2020"],
    ["IA", "Perfeito. Vou registrar como avaliação de freio para um Onix 2020. Você prefere levar pela manhã ou à tarde?"]
  ]
} as const;

export default function DemoPage() {
  const [niche, setNiche] = useState<keyof typeof demos>("Estética");
  return (
    <main className="min-h-screen bg-[#eef5f1]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section>
            <h1 className="text-4xl font-black text-slate-950">Demonstração por nicho</h1>
            <p className="mt-4 leading-7 text-slate-600">
              Clique em um segmento e veja como o atendimento automatizado pode responder com contexto, educar o cliente e coletar dados para venda.
            </p>
            <div className="mt-6 grid gap-3">
              {Object.keys(demos).map((item) => (
                <button
                  key={item}
                  onClick={() => setNiche(item as keyof typeof demos)}
                  className={`rounded-md border px-4 py-3 text-left font-bold transition ${niche === item ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-md bg-[#111b21] shadow-soft">
            <div className="flex items-center gap-3 bg-[#202c33] px-5 py-4 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
                <MessageCircle size={20} />
              </div>
              <div>
                <p className="font-bold">{niche} Assistente IA</p>
                <p className="text-xs text-emerald-200">respondendo agora</p>
              </div>
            </div>
            <div className="min-h-[520px] bg-[#0b141a] p-5">
              {demos[niche].map(([who, text], index) => (
                <div key={index} className={`mb-4 flex ${who === "IA" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-md px-4 py-3 text-sm leading-6 shadow ${who === "IA" ? "bg-[#005c4b] text-white" : "bg-[#202c33] text-slate-100"}`}>
                    <span className="mb-1 block text-xs font-bold opacity-70">{who}</span>
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
