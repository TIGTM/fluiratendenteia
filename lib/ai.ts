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
