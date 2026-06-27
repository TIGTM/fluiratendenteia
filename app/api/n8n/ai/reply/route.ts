import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAssistantReply } from "@/lib/ai";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function POST(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const tenant = body.tenant;
  const lead = body.lead;
  if (!tenant || !lead) return NextResponse.json({ error: "tenant and lead required" }, { status: 400 });

  if (lead.status === "optout") {
    return NextResponse.json({ reply: "Tudo bem, não enviaremos novas mensagens por aqui.", intent: "optout", leadStatus: "optout", needsHuman: false, detectedName: null, detectedInterest: null, shouldScheduleFollowUp: false, followUpMinutes: 0, tenant, lead, session: tenant.wahaSessionName, from: body.from });
  }
  if (lead.humanPaused || lead.status === "aguardando_humano") {
    return NextResponse.json({ reply: "Perfeito, vou chamar uma pessoa da equipe para continuar seu atendimento. Só um instante :)", intent: "human", leadStatus: "aguardando_humano", needsHuman: true, detectedName: null, detectedInterest: null, shouldScheduleFollowUp: false, followUpMinutes: 0, tenant, lead, session: tenant.wahaSessionName, from: body.from });
  }

  const result = await generateAssistantReply({
    tenant,
    lead,
    currentMessage: body.currentMessage || body.message || "",
    recentHistory: body.recentHistory || [],
    knowledgeBase: body.knowledgeBase || [],
    services: body.services || []
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: result.leadStatus,
      name: result.detectedName || undefined,
      interest: result.detectedInterest || undefined,
      humanPaused: result.needsHuman || result.leadStatus === "aguardando_humano"
    }
  });

  return NextResponse.json({ ...result, tenant, lead, session: tenant.wahaSessionName, from: body.from || body.currentMessage?.from });
}
