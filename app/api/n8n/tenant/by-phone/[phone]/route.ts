import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function GET(req: NextRequest, { params }: { params: { phone: string } }) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const tenant = await prisma.clientCompany.findFirst({ where: { connectedWhatsapp: params.phone } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant });
}
