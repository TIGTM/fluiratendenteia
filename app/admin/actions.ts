"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, verifyLogin, createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LeadStatus, PlanType, TenantStatus } from "@prisma/client";

function value(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

export async function loginAction(formData: FormData) {
  const user = await verifyLogin(value(formData, "email"), value(formData, "password"));
  if (!user) redirect("/admin/login?error=1");
  await createSession(user.id);
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/admin/login");
}

export async function upsertTenant(formData: FormData) {
  const id = value(formData, "id");
  const data = {
    companyName: value(formData, "companyName"),
    responsibleName: value(formData, "responsibleName"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    segment: value(formData, "segment"),
    connectedWhatsapp: value(formData, "connectedWhatsapp") || null,
    wahaSessionName: value(formData, "wahaSessionName"),
    status: value(formData, "status") as TenantStatus,
    plan: value(formData, "plan") as PlanType,
    voiceTone: value(formData, "voiceTone"),
    humanHours: value(formData, "humanHours") || null,
    welcomeMessage: value(formData, "welcomeMessage"),
    outOfHoursMessage: value(formData, "outOfHoursMessage") || null,
    internalInstructions: value(formData, "internalInstructions") || null,
    instagramUrl: value(formData, "instagramUrl") || null,
    websiteUrl: value(formData, "websiteUrl") || null,
    notes: value(formData, "notes") || null
  };
  if (id) await prisma.clientCompany.update({ where: { id }, data });
  else await prisma.clientCompany.create({ data });
  revalidatePath("/admin");
}

export async function deleteTenant(formData: FormData) {
  await prisma.clientCompany.delete({ where: { id: value(formData, "id") } });
  revalidatePath("/admin");
}

export async function upsertKnowledge(formData: FormData) {
  const id = value(formData, "id");
  const data = {
    tenantId: value(formData, "tenantId"),
    question: value(formData, "question"),
    answer: value(formData, "answer"),
    category: value(formData, "category") || null,
    active: formData.get("active") === "on"
  };
  if (id) await prisma.knowledgeBaseItem.update({ where: { id }, data });
  else await prisma.knowledgeBaseItem.create({ data });
  revalidatePath("/admin");
}

export async function deleteKnowledge(formData: FormData) {
  await prisma.knowledgeBaseItem.delete({ where: { id: value(formData, "id") } });
  revalidatePath("/admin");
}

export async function upsertService(formData: FormData) {
  const id = value(formData, "id");
  const data = {
    tenantId: value(formData, "tenantId"),
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    price: value(formData, "price") || null,
    duration: value(formData, "duration") || null,
    notes: value(formData, "notes") || null,
    active: formData.get("active") === "on"
  };
  if (id) await prisma.serviceItem.update({ where: { id }, data });
  else await prisma.serviceItem.create({ data });
  revalidatePath("/admin");
}

export async function deleteService(formData: FormData) {
  await prisma.serviceItem.delete({ where: { id: value(formData, "id") } });
  revalidatePath("/admin");
}

export async function updateLead(formData: FormData) {
  await prisma.lead.update({
    where: { id: value(formData, "id") },
    data: {
      name: value(formData, "name") || null,
      interest: value(formData, "interest") || null,
      status: value(formData, "status") as LeadStatus,
      humanPaused: formData.get("humanPaused") === "on"
    }
  });
  revalidatePath("/admin");
}

export async function deleteLead(formData: FormData) {
  await prisma.lead.delete({ where: { id: value(formData, "id") } });
  revalidatePath("/admin");
}
