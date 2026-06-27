import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireN8nToken } from "@/lib/n8n-auth";

export async function GET(req: NextRequest, { params }: { params: { session: string } }) {
  const unauthorized = requireN8nToken(req);
  if (unauthorized) return unauthorized;
  const tenant = await prisma.clientCompany.findUnique({ where: { wahaSessionName: params.session } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant });
}
