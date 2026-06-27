import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function POST(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const leadId = body.leadId || body.lead?.id;
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (body.status || body.leadStatus) data.status = body.status || body.leadStatus;
  if (body.interest || body.detectedInterest) data.interest = body.interest || body.detectedInterest;
  if (body.name || body.detectedName) data.name = body.name || body.detectedName;
  if (body.nextFollowUpAt) data.nextFollowUpAt = new Date(body.nextFollowUpAt);
  if (typeof body.humanPaused === "boolean") data.humanPaused = body.humanPaused;
  const lead = await prisma.lead.update({ where: { id: leadId }, data });

  if (body.shouldScheduleFollowUp && body.followUpMinutes && !["convertido", "perdido", "optout", "aguardando_humano"].includes(lead.status) && lead.followUpCount < 2) {
    const dueAt = new Date(Date.now() + Number(body.followUpMinutes) * 60_000);
    await prisma.followUp.create({
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        dueAt,
        message: body.followUpMessage || "Oi, tudo bem? Passando só para saber se você ainda tem interesse. Posso te ajudar a dar continuidade? :)"
      }
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { nextFollowUpAt: dueAt } });
  }

  return NextResponse.json({ ok: true, lead });
}
