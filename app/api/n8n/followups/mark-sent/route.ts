import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function POST(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const followUp = await prisma.followUp.update({
    where: { id: body.followUpId || body.id },
    data: { sentAt: new Date(), status: "sent" },
    include: { lead: true }
  });
  await prisma.lead.update({
    where: { id: followUp.leadId },
    data: { followUpCount: { increment: 1 }, nextFollowUpAt: null }
  });
  return NextResponse.json({ ok: true, followUp });
}
