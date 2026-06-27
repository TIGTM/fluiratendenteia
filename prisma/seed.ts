import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@fluir.local" },
    update: { passwordHash, name: "Admin Fluir" },
    create: { email: "admin@fluir.local", passwordHash, name: "Admin Fluir" }
  });

  const tenant = await prisma.clientCompany.upsert({
    where: { wahaSessionName: "default" },
    update: {},
    create: {
      companyName: "Clínica Bella Estética",
      responsibleName: "Mariana",
      email: "contato@clinicabella.local",
      phone: "5531999999999",
      segment: "Estética",
      connectedWhatsapp: "5531999999999",
      wahaSessionName: "default",
      status: "ativo",
      plan: "profissional",
      voiceTone: "Educado, acolhedor, objetivo e levemente descontraído.",
      humanHours: "Segunda a sexta, 9h às 19h; sábado, 9h às 13h.",
      welcomeMessage: "Olá! Seja bem-vinda à Clínica Bella Estética :) Me diga como posso te ajudar: valores, horários ou agendamento?",
      outOfHoursMessage: "No momento nossa equipe humana está fora do horário, mas posso adiantar informações e registrar seu interesse.",
      internalInstructions: "Não inventar horários disponíveis. Para agendamento, coletar nome, procedimento e preferência de dia/período.",
      instagramUrl: "https://instagram.com/clinicabella",
      websiteUrl: "https://clinicabella.local",
      notes: "Cliente demo para validação do Fluir Atendente IA."
    }
  });

  const knowledge = [
    ["Qual o valor da limpeza de pele?", "A limpeza de pele custa R$120 e dura cerca de 1 hora.", "Preços"],
    ["Vocês fazem extensão de cílios?", "Sim, fazemos extensão de cílios fio a fio e volume brasileiro. Os valores começam em R$150.", "Serviços"],
    ["Qual o horário de atendimento?", "Atendemos de segunda a sexta, das 9h às 19h, e sábado das 9h às 13h.", "Atendimento"],
    ["Onde fica a clínica?", "Estamos localizados em Belo Horizonte. O endereço completo pode ser enviado por uma atendente.", "Localização"],
    ["Faz avaliação gratuita?", "Sim, a avaliação inicial é gratuita mediante agendamento.", "Serviços"],
    ["Quais formas de pagamento?", "Aceitamos Pix, dinheiro, cartão de débito e crédito.", "Pagamento"],
    ["Como faço para agendar?", "Me diga seu nome, o procedimento desejado e o melhor dia ou período para atendimento.", "Agendamento"],
    ["Posso remarcar?", "Sim, pedimos apenas que avise com antecedência para liberarmos o horário.", "Agendamento"]
  ];

  for (const [question, answer, category] of knowledge) {
    const exists = await prisma.knowledgeBaseItem.findFirst({ where: { tenantId: tenant.id, question } });
    if (!exists) {
      await prisma.knowledgeBaseItem.create({ data: { tenantId: tenant.id, question, answer, category, active: true } });
    }
  }

  const services = [
    ["Limpeza de pele", "Higienização profunda, extração e finalização calmante.", "R$120", "60 min"],
    ["Extensão de cílios", "Técnicas fio a fio e volume brasileiro.", "a partir de R$150", "120 min"],
    ["Design de sobrancelhas", "Mapeamento facial e design personalizado.", "R$45", "40 min"],
    ["Massagem relaxante", "Massagem corporal para relaxamento e bem-estar.", "R$100", "60 min"],
    ["Avaliação estética", "Avaliação inicial com orientação personalizada.", "gratuita", "30 min"]
  ];

  for (const [name, description, price, duration] of services) {
    const exists = await prisma.serviceItem.findFirst({ where: { tenantId: tenant.id, name } });
    if (!exists) {
      await prisma.serviceItem.create({ data: { tenantId: tenant.id, name, description, price, duration, active: true } });
    }
  }

  await prisma.lead.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: "5531888888888" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Cliente Demo",
      phone: "5531888888888",
      interest: "Limpeza de pele",
      status: "em_atendimento",
      lastMessage: "Queria saber se tem horário amanhã."
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
