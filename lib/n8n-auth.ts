import { NextRequest, NextResponse } from "next/server";

export function requireN8nToken(req: NextRequest) {
  const expected = process.env.N8N_INTERNAL_TOKEN;
  const auth = req.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
