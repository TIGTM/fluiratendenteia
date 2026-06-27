import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function GET(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const tenants = await prisma.clientCompany.findMany({ where: { status: "ativo" } });
  const reports = await Promise.all(tenants.map(async (tenant) => {
    const [inbound, outbound, newLeads, human, booking, converted, messages] = await Promise.all([
      prisma.conversationMessage.count({ where: { tenantId: tenant.id, direction: "inbound", createdAt: { gte: start } } }),
      prisma.conversationMessage.count({ where: { tenantId: tenant.id, direction: "outbound", createdAt: { gte: start } } }),
      prisma.lead.count({ where: { tenantId: tenant.id, createdAt: { gte: start } } }),
      prisma.lead.count({ where: { tenantId: tenant.id, status: "aguardando_humano" } }),
      prisma.lead.count({ where: { tenantId: tenant.id, status: "agendamento_solicitado" } }),
      prisma.lead.count({ where: { tenantId: tenant.id, status: "convertido", updatedAt: { gte: start } } }),
      prisma.conversationMessage.findMany({ where: { tenantId: tenant.id, direction: "inbound", createdAt: { gte: start } }, select: { content: true }, take: 20 })
    ]);
    return {
      tenantId: tenant.id,
      companyName: tenant.companyName,
      inboundMessages: inbound,
      outboundMessages: outbound,
      newLeads,
      waitingHuman: human,
      bookingIntent: booking,
      converted,
      topQuestions: messages.map((m) => m.content).slice(0, 8)
    };
  }));

  return NextResponse.json({ date: start.toISOString().slice(0, 10), reports });
}
