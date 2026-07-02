import { NextRequest, NextResponse } from "next/server";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

const optOutTerms = ["parar", "cancelar", "sair", "não quero", "nao quero", "não quero receber", "nao quero receber"];

export async function POST(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const tenant = await prisma.clientCompany.findUnique({ where: { wahaSessionName: body.session } });
  if (!tenant || tenant.status !== "ativo") return NextResponse.json({ error: "Tenant inactive or not found" }, { status: 404 });

  const message = String(body.message || "");
  const normalized = message.toLowerCase();
  const isOptOut = optOutTerms.some((term) => normalized.includes(term));
  const humanAsked = normalized.includes("humano") || normalized.includes("falar com atendente") || normalized.includes("falar com uma pessoa") || normalized.includes("pessoa da equipe");

  const lead = await prisma.lead.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: body.phone } },
    update: {
      name: body.name || undefined,
      lastMessage: message,
      status: isOptOut ? LeadStatus.optout : humanAsked ? LeadStatus.aguardando_humano : undefined,
      humanPaused: humanAsked ? true : undefined,
      nextFollowUpAt: isOptOut ? null : undefined
    },
    create: {
      tenantId: tenant.id,
      name: body.name || null,
      phone: body.phone,
      status: isOptOut ? LeadStatus.optout : humanAsked ? LeadStatus.aguardando_humano : LeadStatus.novo,
      humanPaused: humanAsked,
      lastMessage: message,
      origin: "whatsapp"
    }
  });

  await prisma.conversationMessage.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      contactPhone: body.phone,
      contactName: body.name || null,
      direction: "inbound",
      content: message,
      needsHuman: humanAsked,
      rawPayload: body.raw || body
    }
  });

  const [recentHistory, knowledgeBase, services] = await Promise.all([
    prisma.conversationMessage.findMany({ where: { tenantId: tenant.id, leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.knowledgeBaseItem.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { createdAt: "asc" } }),
    prisma.serviceItem.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { createdAt: "asc" } })
  ]);

  return NextResponse.json({ tenant, lead, recentHistory: recentHistory.reverse(), knowledgeBase, services, currentMessage: message, from: body.from });
}
