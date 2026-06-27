import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function POST(req: NextRequest) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const body = await req.json();
  const log = await prisma.systemLog.create({
    data: {
      tenantId: body.tenantId || body.tenant?.id || null,
      level: body.level || "info",
      source: body.source || "n8n",
      message: body.message || "Log n8n",
      metadata: body.metadata || body
    }
  });
  return NextResponse.json({ ok: true, log });
}
