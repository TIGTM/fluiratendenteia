import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function POST(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const tenantId = body.tenantId || body.tenant?.id;
  const leadId = body.leadId || body.lead?.id;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  const message = await prisma.conversationMessage.create({
    data: {
      tenantId,
      leadId,
      contactPhone: body.phone || body.lead?.phone || body.to || "",
      contactName: body.name || body.lead?.name || null,
      direction: "outbound",
      content: body.message || body.reply || body.text || "",
      detectedIntent: body.intent || null,
      answeredByAi: Boolean(body.answeredByAi ?? true),
      needsHuman: Boolean(body.needsHuman)
    }
  });
  return NextResponse.json({ ok: true, message });
}
