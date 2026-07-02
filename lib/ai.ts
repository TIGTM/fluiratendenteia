import OpenAI from "openai";
import type { ClientCompany, KnowledgeBaseItem, Lead, ServiceItem, ConversationMessage } from "@prisma/client";

export type AssistantInput = {
  tenant: ClientCompany;
  lead: Lead;
  currentMessage: string;
  recentHistory: ConversationMessage[];
  knowledgeBase: KnowledgeBaseItem[];
  services: ServiceItem[];
};

export type AssistantReply = {
  reply: string;
  intent: "pricing" | "booking" | "faq" | "human" | "complaint" | "greeting" | "unknown" | "optout";
  leadStatus: "novo" | "em_atendimento" | "aguardando_humano" | "orcamento_enviado" | "agendamento_solicitado" | "agendado" | "perdido" | "convertido" | "optout";
  needsHuman: boolean;
  detectedName: string | null;
  detectedInterest: string | null;
  shouldScheduleFollowUp: boolean;
  followUpMinutes: number;
};

const optOutTerms = ["parar", "cancelar", "sair", "não quero", "nao quero", "não quero receber", "nao quero receber"];

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isGreetingMessage(message: string) {
  const compact = message.trim().replace(/\s+/g, " ");
  return ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"].includes(compact);
}

function lashDemoReply(input: AssistantInput): AssistantReply | null {
  const segment = normalizeText(`${input.tenant.segment} ${input.tenant.companyName}`);
  if (!segment.includes("cilios") && !segment.includes("lash")) return null;

  const message = normalizeText(input.currentMessage);
  const asksHuman = message.includes("humano") || message.includes("falar com atendente") || message.includes("falar com uma pessoa") || message.includes("pessoa da equipe");
  if (asksHuman) {
    return {
      reply: "Perfeito, vou chamar uma pessoa da equipe para continuar seu atendimento. Só um instante :)",
      intent: "human",
      leadStatus: "aguardando_humano",
      needsHuman: true,
      detectedName: null,
      detectedInterest: null,
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  const hasRisk = ["alergia", "coceira", "irritacao", "irritada", "conjuntivite", "sensibilidade", "arde", "ardendo"].some((word) => message.includes(word));
  if (hasRisk) {
    return {
      reply: "Obrigada por avisar. Como envolve sensibilidade ou alergia na região dos olhos, prefiro chamar uma atendente para avaliar com segurança antes de agendar. Vou encaminhar para uma pessoa da equipe, combinado?",
      intent: "human",
      leadStatus: "aguardando_humano",
      needsHuman: true,
      detectedName: null,
      detectedInterest: "Avaliação de sensibilidade",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  const agenda = "Tenho estas opções na agenda demonstrativa: Ana Paula hoje às 15:30, amanhã às 10:00 ou 16:00, sexta às 14:00; Bianca Souza hoje às 17:00, amanhã às 11:30 ou 18:00, sábado às 09:30.";
  const asksSchedule = ["agendar", "agenda", "horario", "amanha", "hoje", "sexta", "sabado", "disponivel", "atendentes", "profissional"].some((word) => message.includes(word));
  const asksPrice = ["valor", "preco", "quanto custa", "custa", "precos"].some((word) => message.includes(word));
  const asksFirstApplication = ["primeira", "primeira vez", "primeira aplicacao", "aplicacao", "aplicar"].some((word) => message.includes(word));
  const asksNatural = ["natural", "nunca fiz", "discreto", "delicado"].some((word) => message.includes(word));
  const asksDifference = ["diferenca", "qual tecnica", "melhor tecnica", "fio a fio", "brasileiro", "hibrido", "russo"].some((word) => message.includes(word));
  const asksDiscount = ["caro", "desconto", "promocao", "promo"].some((word) => message.includes(word));
  const asksMaintenance = ["manutencao", "retorno", "retoque"].some((word) => message.includes(word));
  const asksRemoval = ["remover", "remocao", "tirar"].some((word) => message.includes(word));

  if (asksSchedule) {
    return {
      reply: `${agenda} Para volume brasileiro, o valor é R$ 170 e dura cerca de 2h. Você prefere Ana Paula ou Bianca Souza? Se quiser, já deixo uma pré-reserva: me diga seu nome completo, técnica desejada e o horário escolhido.`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Extensão de cílios",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (asksDiscount) {
    return {
      reply: "Entendo 😊 A extensão é um procedimento detalhado para preservar seus fios naturais e deixar um acabamento bonito. Para primeira aplicação esta semana, temos R$ 20 de desconto no fio a fio e no volume brasileiro: fio a fio fica R$ 120 e volume brasileiro R$ 150. Quer que eu veja um horário com a Ana Paula ou com a Bianca?",
      intent: "pricing",
      leadStatus: "orcamento_enviado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Promoção primeira aplicação",
      shouldScheduleFollowUp: true,
      followUpMinutes: 180
    };
  }

  if (asksPrice) {
    return {
      reply: `Os valores são: fio a fio clássico R$ 140, volume brasileiro R$ 170, volume híbrido R$ 190, volume russo R$ 230, efeito molhado R$ 180, manutenção de R$ 90 a R$ 130 e remoção R$ 50. ${agenda} Você prefere um efeito natural, marcado ou bem cheio?`,
      intent: "pricing",
      leadStatus: "orcamento_enviado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Extensão de cílios",
      shouldScheduleFollowUp: true,
      followUpMinutes: 180
    };
  }

  if (asksNatural || asksFirstApplication) {
    return {
      reply: `Para primeira vez e efeito natural, eu indicaria fio a fio clássico. Ele realça o olhar de forma leve, sem ficar artificial. O valor é R$ 140, ou R$ 120 com a condição de primeira aplicação desta semana. ${agenda} Quer que eu pré-reserve um desses horários?`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Fio a fio clássico",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (asksDifference) {
    return {
      reply: "Fio a fio é mais natural e delicado. Volume brasileiro dá mais presença sem pesar. Híbrido mistura naturalidade com volume. Volume russo é mais cheio e glamouroso. Se você quer algo discreto, eu iria de fio a fio; se quer olhar marcado para o dia a dia, volume brasileiro costuma ficar lindo. Quer ver horários?",
      intent: "faq",
      leadStatus: "em_atendimento",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Escolha de técnica",
      shouldScheduleFollowUp: true,
      followUpMinutes: 180
    };
  }

  if (asksMaintenance) {
    return {
      reply: `A manutenção é ideal entre 15 e 21 dias e fica entre R$ 90 e R$ 130, conforme a técnica e a quantidade de fios restantes. ${agenda} Me diga há quantos dias você fez a aplicação e qual horário prefere.`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Manutenção de cílios",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (asksRemoval) {
    return {
      reply: `Fazemos remoção profissional por R$ 50 e dura cerca de 30 minutos. Não recomendo puxar em casa, para não danificar seus fios naturais. ${agenda} Quer que eu pré-reserve um horário?`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Remoção profissional",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (isGreetingMessage(message)) {
    return {
      reply: input.tenant.welcomeMessage,
      intent: "greeting",
      leadStatus: "novo",
      needsHuman: false,
      detectedName: null,
      detectedInterest: null,
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  return {
    reply: `Certo. Eu consigo te ajudar com valores, escolha da técnica e agenda com a Ana Paula ou a Bianca Souza. As opções mais procuradas são fio a fio clássico para efeito natural, volume brasileiro para mais destaque e volume híbrido para equilibrar naturalidade e volume. ${agenda} Você quer ver valores, escolher a técnica ou já separar um horário?`,
    intent: "faq",
    leadStatus: "em_atendimento",
    needsHuman: false,
    detectedName: null,
    detectedInterest: "Extensão de cílios",
    shouldScheduleFollowUp: true,
    followUpMinutes: 180
  };
}

function localReply(input: AssistantInput): AssistantReply {
  const message = input.currentMessage.toLowerCase();
  if (optOutTerms.some((term) => message.includes(term))) {
    return {
      reply: "Tudo bem, não enviaremos novas mensagens por aqui. Se precisar, é só chamar.",
      intent: "optout",
      leadStatus: "optout",
      needsHuman: false,
      detectedName: null,
      detectedInterest: null,
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }
  if (message.includes("humano") || message.includes("atendente") || message.includes("pessoa")) {
    return {
      reply: "Perfeito, vou chamar uma pessoa da equipe para continuar seu atendimento. Só um instante :)",
      intent: "human",
      leadStatus: "aguardando_humano",
      needsHuman: true,
      detectedName: null,
      detectedInterest: null,
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  const matchedKb = input.knowledgeBase.find((item) => {
    const q = item.question.toLowerCase();
    return q.split(/\s+/).filter((word) => word.length > 4).some((word) => message.includes(word));
  });
  const matchedService = input.services.find((service) => message.includes(service.name.toLowerCase().split(" ")[0]));
  const asksBooking = ["agendar", "horário", "horario", "amanhã", "amanha", "agenda"].some((word) => message.includes(word));
  const asksPrice = ["valor", "preço", "preco", "quanto custa"].some((word) => message.includes(word));

  let reply = input.tenant.welcomeMessage;
  let intent: AssistantReply["intent"] = "greeting";
  let status: AssistantReply["leadStatus"] = "em_atendimento";

  if (matchedKb) {
    reply = `${matchedKb.answer} Posso te ajudar com mais alguma informação?`;
    intent = asksPrice ? "pricing" : "faq";
    status = asksPrice ? "orcamento_enviado" : "em_atendimento";
  } else if (matchedService) {
    reply = `${matchedService.name}: ${matchedService.description || "temos esse serviço disponível"}${matchedService.price ? `, valor ${matchedService.price}` : ""}${matchedService.duration ? ` e duração aproximada de ${matchedService.duration}` : ""}. Para agendar, me diga seu nome e sua preferência de dia ou período.`;
    intent = asksPrice ? "pricing" : "booking";
    status = asksBooking ? "agendamento_solicitado" : "orcamento_enviado";
  } else if (asksBooking) {
    reply = "Consigo te ajudar com o agendamento. Me diga seu nome, o serviço desejado e se prefere manhã ou tarde.";
    intent = "booking";
    status = "agendamento_solicitado";
  } else {
    reply = "Posso te ajudar com valores, serviços ou agendamento. Me diga qual procedimento você procura?";
    intent = "unknown";
  }

  return {
    reply,
    intent,
    leadStatus: status,
    needsHuman: false,
    detectedName: null,
    detectedInterest: matchedService?.name || matchedKb?.category || null,
    shouldScheduleFollowUp: status !== "agendamento_solicitado",
    followUpMinutes: 180
  };
}

function buildPrompt(input: AssistantInput) {
  return `Você é uma atendente IA para WhatsApp da empresa ${input.tenant.companyName}.
Responda em português brasileiro, de forma educada, objetiva e natural.
Tom de voz: ${input.tenant.voiceTone}
Instruções internas: ${input.tenant.internalInstructions || "Sem instruções extras."}
Regras: não invente preços, horários nem promessas. Se não souber, encaminhe para humano. Se pedirem humano, needsHuman=true. Se pedirem parar/cancelar/sair/não quero, status optout.

Base de conhecimento:
${input.knowledgeBase.map((item) => `P: ${item.question}\nR: ${item.answer}`).join("\n\n")}

Serviços:
${input.services.map((item) => `${item.name} | ${item.price || "sem preço"} | ${item.duration || "sem duração"} | ${item.description || ""}`).join("\n")}

Histórico recente:
${input.recentHistory.map((m) => `${m.direction}: ${m.content}`).join("\n")}

Mensagem atual: ${input.currentMessage}

Retorne apenas JSON válido neste formato:
{"reply":"","intent":"pricing|booking|faq|human|complaint|greeting|unknown|optout","leadStatus":"novo|em_atendimento|aguardando_humano|orcamento_enviado|agendamento_solicitado|agendado|perdido|convertido|optout","needsHuman":false,"detectedName":null,"detectedInterest":null,"shouldScheduleFollowUp":true,"followUpMinutes":180}`;
}

export async function generateAssistantReply(input: AssistantInput): Promise<AssistantReply> {
  const specializedReply = lashDemoReply(input);
  if (specializedReply) return specializedReply;

  const provider = (process.env.LLM_PROVIDER || "local").toLowerCase();
  const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY;
  if (!apiKey) return localReply(input);

  const model = process.env.LLM_MODEL || (provider === "openai" ? "gpt-4o-mini" : "llama-3.1-8b-instant");
  const baseURL = provider === "groq" ? "https://api.groq.com/openai/v1" : undefined;
  const client = new OpenAI({ apiKey, baseURL });

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(input) }]
    });
    return JSON.parse(completion.choices[0]?.message?.content || "{}") as AssistantReply;
  } catch (error) {
    console.error("AI provider failed, using local fallback", error);
    return localReply(input);
  }
}
