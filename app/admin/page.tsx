import { Bot, Building2, Database, LogOut, MessageSquare, Settings, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maskSecret } from "@/lib/n8n-auth";
import { deleteKnowledge, deleteLead, deleteService, deleteTenant, logoutAction, updateLead, upsertKnowledge, upsertService, upsertTenant } from "./actions";
import type { LucideIcon } from "lucide-react";

const leadStatuses = ["novo", "em_atendimento", "aguardando_humano", "orcamento_enviado", "agendamento_solicitado", "agendado", "perdido", "convertido", "optout"];

export default async function AdminPage() {
  const user = await requireAdmin();
  const [tenants, leads, messages, followUps] = await Promise.all([
    prisma.clientCompany.findMany({ include: { knowledgeBaseItems: true, serviceItems: true }, orderBy: { createdAt: "desc" } }),
    prisma.lead.findMany({ include: { tenant: true }, orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.conversationMessage.findMany({ include: { tenant: true }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.followUp.findMany({ include: { lead: true, tenant: true }, where: { sentAt: null }, orderBy: { dueAt: "asc" }, take: 20 })
  ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const leadsToday = leads.filter((lead) => lead.createdAt >= today).length;
  const activeConversations = new Set(messages.filter((m) => m.createdAt >= today).map((m) => m.contactPhone)).size;
  const outboundCount = messages.filter((m) => m.direction === "outbound").length;
  const humanMode = leads.filter((lead) => lead.status === "aguardando_humano" || lead.humanPaused).length;

  const cards: { label: string; value: number; Icon: LucideIcon }[] = [
    { label: "Clientes", value: tenants.length, Icon: Building2 },
    { label: "Leads hoje", value: leadsToday, Icon: Users },
    { label: "Conversas ativas", value: activeConversations, Icon: MessageSquare },
    { label: "Follow-ups pendentes", value: followUps.length, Icon: Bot },
    { label: "Mensagens enviadas", value: outboundCount, Icon: Database },
    { label: "Modo humano", value: humanMode, Icon: Settings }
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="grid lg:grid-cols-[260px_1fr]">
        <aside className="bg-fluir-dark p-6 text-white lg:min-h-screen">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500">
              <Bot />
            </div>
            <div>
              <p className="font-black">Fluir IA</p>
              <p className="text-xs text-slate-300">{user.email}</p>
            </div>
          </div>
          <nav className="mt-8 grid gap-2 text-sm font-semibold text-slate-200">
            {["Dashboard", "Clientes", "Base", "Serviços", "Leads", "Conversas", "Config"].map((item) => (
              <a className="rounded-md px-3 py-2 hover:bg-white/10" href={`#${item.toLowerCase()}`} key={item}>
                {item}
              </a>
            ))}
          </nav>
          <form action={logoutAction} className="mt-8">
            <button className="btn-secondary w-full border-white/10 bg-white/10 text-white" type="submit">
              <LogOut size={16} /> Sair
            </button>
          </form>
        </aside>

        <section className="p-6 lg:p-8">
          <div id="dashboard" className="mb-8">
            <h1 className="text-3xl font-black">Painel operacional</h1>
            <p className="mt-1 text-slate-600">Clientes, leads, conversas e automações WhatsApp.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {cards.map(({ label, value, Icon }) => (
                <div className="rounded-md bg-white p-4 shadow-sm" key={label}>
                  <Icon className="mb-3 text-emerald-500" size={20} />
                  <p className="text-2xl font-black">{value}</p>
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <section id="clientes" className="mb-8 rounded-md bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Clientes/empresas</h2>
            <TenantForm />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th>Empresa</th><th>Responsável</th><th>Segmento</th><th>WAHA</th><th>Plano</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr className="border-t" key={tenant.id}>
                      <td className="py-3 font-bold">{tenant.companyName}</td><td>{tenant.responsibleName}</td><td>{tenant.segment}</td><td>{tenant.wahaSessionName}</td><td>{tenant.plan}</td>
                      <td><span className={`badge ${tenant.status === "ativo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{tenant.status}</span></td>
                      <td><form action={deleteTenant}><input type="hidden" name="id" value={tenant.id} /><button className="text-red-600" type="submit">Excluir</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="base" className="mb-8 rounded-md bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Base de conhecimento</h2>
            <KnowledgeForm tenants={tenants} />
            <div className="mt-5 grid gap-3">
              {tenants.flatMap((tenant) => tenant.knowledgeBaseItems.map((item) => (
                <div className="rounded-md border border-slate-200 p-4" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-bold">{item.question}</p><p className="mt-1 text-sm text-slate-600">{item.answer}</p><p className="mt-2 text-xs text-slate-500">{tenant.companyName} · {item.category || "sem categoria"}</p></div>
                    <form action={deleteKnowledge}><input type="hidden" name="id" value={item.id} /><button className="text-sm font-semibold text-red-600">Excluir</button></form>
                  </div>
                </div>
              )))}
            </div>
          </section>

          <section id="serviços" className="mb-8 rounded-md bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Serviços/produtos</h2>
            <ServiceForm tenants={tenants} />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {tenants.flatMap((tenant) => tenant.serviceItems.map((item) => (
                <div className="rounded-md border border-slate-200 p-4" key={item.id}>
                  <p className="font-bold">{item.name}</p><p className="text-sm text-slate-600">{item.description}</p><p className="mt-2 text-sm font-semibold">{item.price} · {item.duration}</p>
                  <form action={deleteService} className="mt-2"><input type="hidden" name="id" value={item.id} /><button className="text-sm font-semibold text-red-600">Excluir</button></form>
                </div>
              )))}
            </div>
          </section>

          <section id="leads" className="mb-8 rounded-md bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Leads</h2>
            <div className="mt-5 grid gap-3">
              {leads.map((lead) => (
                <form action={updateLead} className="grid gap-3 rounded-md border border-slate-200 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]" key={lead.id}>
                  <input type="hidden" name="id" value={lead.id} />
                  <input className="admin-input" name="name" defaultValue={lead.name || ""} placeholder="Nome" />
                  <input className="admin-input" name="interest" defaultValue={lead.interest || ""} placeholder="Interesse" />
                  <select className="admin-input" name="status" defaultValue={lead.status}>{leadStatuses.map((s) => <option key={s}>{s}</option>)}</select>
                  <label className="flex items-center gap-2 text-sm"><input name="humanPaused" type="checkbox" defaultChecked={lead.humanPaused} /> Modo humano</label>
                  <button className="btn-primary" type="submit">Salvar</button>
                  <button formAction={deleteLead} className="btn-secondary text-red-600" type="submit">Excluir</button>
                  <p className="md:col-span-6 text-xs text-slate-500">{lead.tenant.companyName} · {lead.phone} · {lead.lastMessage}</p>
                </form>
              ))}
            </div>
          </section>

          <section id="conversas" className="mb-8 rounded-md bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Conversas recentes</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th>Data</th><th>Empresa</th><th>Contato</th><th>Direção</th><th>Mensagem</th><th>IA</th><th>Humano</th></tr></thead>
                <tbody>{messages.map((m) => <tr className="border-t" key={m.id}><td className="py-3">{m.createdAt.toLocaleString("pt-BR")}</td><td>{m.tenant.companyName}</td><td>{m.contactName || m.contactPhone}</td><td>{m.direction}</td><td className="max-w-md truncate">{m.content}</td><td>{m.answeredByAi ? "sim" : "não"}</td><td>{m.needsHuman ? "sim" : "não"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section id="config" className="rounded-md bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Configurações do sistema</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ["WAHA_BASE_URL", process.env.WAHA_BASE_URL],
                ["WAHA_SESSION", process.env.WAHA_SESSION],
                ["LLM_PROVIDER", process.env.LLM_PROVIDER],
                ["GROQ_API_KEY", maskSecret(process.env.GROQ_API_KEY)],
                ["OPENAI_API_KEY", maskSecret(process.env.OPENAI_API_KEY)],
                ["DATABASE_URL", maskSecret(process.env.DATABASE_URL)],
                ["APP_URL", process.env.APP_URL]
              ].map(([key, val]) => <div className="rounded-md bg-slate-50 p-3" key={key}><p className="text-xs font-bold text-slate-500">{key}</p><p className="mt-1 break-all font-mono text-sm">{val || "não configurado"}</p></div>)}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function TenantForm() {
  return (
    <form action={upsertTenant} className="mt-5 grid gap-3 md:grid-cols-3">
      <input className="admin-input" name="companyName" placeholder="Nome da empresa" required />
      <input className="admin-input" name="responsibleName" placeholder="Responsável" required />
      <input className="admin-input" name="email" placeholder="E-mail" required />
      <input className="admin-input" name="phone" placeholder="Telefone" required />
      <input className="admin-input" name="segment" placeholder="Segmento/nicho" required />
      <input className="admin-input" name="connectedWhatsapp" placeholder="WhatsApp conectado" />
      <input className="admin-input" name="wahaSessionName" placeholder="Session WAHA" required />
      <select className="admin-input" name="status" defaultValue="ativo"><option value="ativo">ativo</option><option value="inativo">inativo</option></select>
      <select className="admin-input" name="plan" defaultValue="inicial"><option value="inicial">inicial</option><option value="profissional">profissional</option><option value="premium">premium</option></select>
      <input className="admin-input md:col-span-3" name="voiceTone" placeholder="Tom de voz da IA" required />
      <input className="admin-input" name="humanHours" placeholder="Horário humano" />
      <input className="admin-input md:col-span-2" name="welcomeMessage" placeholder="Mensagem de boas-vindas" required />
      <textarea className="admin-input md:col-span-3" name="outOfHoursMessage" placeholder="Mensagem fora do horário" />
      <textarea className="admin-input md:col-span-3" name="internalInstructions" placeholder="Instruções internas da IA" />
      <input className="admin-input" name="instagramUrl" placeholder="Instagram" />
      <input className="admin-input" name="websiteUrl" placeholder="Site" />
      <input className="admin-input" name="notes" placeholder="Observações" />
      <button className="btn-primary md:col-span-3" type="submit">Cadastrar cliente</button>
    </form>
  );
}

function KnowledgeForm({ tenants }: { tenants: { id: string; companyName: string }[] }) {
  return <form action={upsertKnowledge} className="mt-5 grid gap-3 md:grid-cols-4"><select className="admin-input" name="tenantId">{tenants.map((t) => <option value={t.id} key={t.id}>{t.companyName}</option>)}</select><input className="admin-input" name="question" placeholder="Pergunta" required /><input className="admin-input" name="category" placeholder="Categoria" /><label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked /> Ativo</label><textarea className="admin-input md:col-span-4" name="answer" placeholder="Resposta" required /><button className="btn-primary md:col-span-4">Adicionar pergunta/resposta</button></form>;
}

function ServiceForm({ tenants }: { tenants: { id: string; companyName: string }[] }) {
  return <form action={upsertService} className="mt-5 grid gap-3 md:grid-cols-4"><select className="admin-input" name="tenantId">{tenants.map((t) => <option value={t.id} key={t.id}>{t.companyName}</option>)}</select><input className="admin-input" name="name" placeholder="Nome" required /><input className="admin-input" name="price" placeholder="Preço" /><input className="admin-input" name="duration" placeholder="Duração" /><textarea className="admin-input md:col-span-2" name="description" placeholder="Descrição" /><textarea className="admin-input md:col-span-2" name="notes" placeholder="Observações" /><label className="flex items-center gap-2 text-sm"><input name="active" type="checkbox" defaultChecked /> Ativo</label><button className="btn-primary md:col-span-3">Adicionar serviço</button></form>;
}
