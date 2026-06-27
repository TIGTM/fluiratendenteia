import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function GET(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const followUps = await prisma.followUp.findMany({
    where: {
      sentAt: null,
      status: "pending",
      dueAt: { lte: new Date() },
      lead: { status: { notIn: ["convertido", "perdido", "optout", "aguardando_humano"] }, followUpCount: { lt: 2 }, humanPaused: false },
      tenant: { status: "ativo" }
    },
    include: { lead: true, tenant: true },
    orderBy: { dueAt: "asc" },
    take: 50
  });
  return NextResponse.json({ followUps });
}
