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
const assistantIntents: AssistantReply["intent"][] = ["pricing", "booking", "faq", "human", "complaint", "greeting", "unknown", "optout"];
const leadStatuses: AssistantReply["leadStatus"][] = ["novo", "em_atendimento", "aguardando_humano", "orcamento_enviado", "agendamento_solicitado", "agendado", "perdido", "convertido", "optout"];

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isAssistantIntent(value: unknown): value is AssistantReply["intent"] {
  return typeof value === "string" && assistantIntents.includes(value as AssistantReply["intent"]);
}

function isLeadStatus(value: unknown): value is AssistantReply["leadStatus"] {
  return typeof value === "string" && leadStatuses.includes(value as AssistantReply["leadStatus"]);
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncateText(value: unknown, maxLength: number) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeAssistantReply(value: unknown): AssistantReply | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const reply = nullableString(data.reply);
  if (!reply) return null;
  let intent: AssistantReply["intent"] = isAssistantIntent(data.intent) ? data.intent : "unknown";
  let leadStatus: AssistantReply["leadStatus"] = isLeadStatus(data.leadStatus) ? data.leadStatus : "em_atendimento";
  const needsHuman = data.needsHuman === true || intent === "human";

  if (needsHuman) {
    intent = "human";
    leadStatus = "aguardando_humano";
  } else if (leadStatus === "aguardando_humano") {
    leadStatus = intent === "booking" ? "agendamento_solicitado" : intent === "pricing" ? "orcamento_enviado" : "em_atendimento";
  }

  return {
    reply,
    intent,
    leadStatus,
    needsHuman,
    detectedName: nullableString(data.detectedName),
    detectedInterest: nullableString(data.detectedInterest),
    shouldScheduleFollowUp: data.shouldScheduleFollowUp === true,
    followUpMinutes: typeof data.followUpMinutes === "number" && Number.isFinite(data.followUpMinutes) ? Math.max(0, Math.round(data.followUpMinutes)) : 180
  };
}

function isLashDemo(input: AssistantInput) {
  const segment = normalizeText(`${input.tenant.segment} ${input.tenant.companyName}`);
  return segment.includes("cilios") || segment.includes("lash");
}

function isGreetingMessage(message: string) {
  const compact = message.trim().replace(/\s+/g, " ");
  return ["oi", "ola", "olá", "bom dia", "boa tarde", "boa noite"].includes(compact);
}

function findLashSlot(message: string) {
  const slots = [
    { tokens: ["15:30", "15h30"], professional: "Ana Paula", label: "hoje às 15:30" },
    { tokens: ["10:00", "10h", "10h00"], professional: "Ana Paula", label: "amanhã às 10:00" },
    { tokens: ["16:00", "16h", "16h00"], professional: "Ana Paula", label: "amanhã às 16:00" },
    { tokens: ["14:00", "14h", "14h00"], professional: "Ana Paula", label: "sexta às 14:00" },
    { tokens: ["17:00", "17h", "17h00"], professional: "Bianca Souza", label: "hoje às 17:00" },
    { tokens: ["11:30", "11h30"], professional: "Bianca Souza", label: "amanhã às 11:30" },
    { tokens: ["18:00", "18h", "18h00"], professional: "Bianca Souza", label: "amanhã às 18:00" },
    { tokens: ["09:30", "9:30", "09h30", "9h30"], professional: "Bianca Souza", label: "sábado às 09:30" }
  ];
  return slots.find((slot) => slot.tokens.some((token) => message.includes(token))) || null;
}

function findLashTechnique(message: string) {
  if (message.includes("brasileir")) return { name: "volume brasileiro", price: "R$ 170", duration: "cerca de 2h" };
  if (message.includes("russo")) return { name: "volume russo", price: "R$ 230", duration: "cerca de 2h30" };
  if (message.includes("hibrid")) return { name: "volume híbrido", price: "R$ 190", duration: "cerca de 2h a 2h15" };
  if (message.includes("molhado")) return { name: "efeito molhado", price: "R$ 180", duration: "cerca de 2h" };
  if (message.includes("fio a fio") || message.includes("classico")) return { name: "fio a fio clássico", price: "R$ 140", duration: "cerca de 1h30 a 2h" };
  if (message.includes("lifting")) return { name: "lash lifting", price: "R$ 120", duration: "cerca de 1h" };
  if (message.includes("manutencao")) return { name: "manutenção de cílios", price: "de R$ 90 a R$ 130", duration: "cerca de 60 a 90 min" };
  return null;
}

function inferLashName(rawMessage: string) {
  const explicitName = rawMessage.match(/(?:meu nome\s+(?:é|e)|me chamo|sou)\s+([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,3})/i)?.[1]?.trim();
  if (explicitName) {
    return explicitName.split(/\s+/).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join(" ");
  }

  const firstChunk = rawMessage.split(",")[0]?.trim();
  if (!firstChunk || firstChunk.length > 45) return null;
  if (!/^[A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){1,3}$/.test(firstChunk)) return null;
  if (["quero hoje", "bem cheio", "volume brasileiro", "fio a fio"].includes(normalizeText(firstChunk))) return null;
  return firstChunk;
}

function lashSafetyReply(input: AssistantInput): AssistantReply | null {
  if (!isLashDemo(input)) return null;
  const message = normalizeText(input.currentMessage);
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

  const selectedSlot = findLashSlot(message);
  const selectedTechnique = findLashTechnique(message);
  const isSimpleTechniqueChoice = selectedTechnique && !selectedSlot && message.split(/\s+/).length <= 4;
  if (isSimpleTechniqueChoice) {
    return {
      reply: `${selectedTechnique.name} fica ${selectedTechnique.price} e dura ${selectedTechnique.duration}. Tenho horários com a Ana Paula hoje às 15:30, amanhã às 10:00 ou 16:00, e com a Bianca Souza hoje às 17:00, amanhã às 11:30 ou 18:00. Qual horário você prefere?`,
      intent: "pricing",
      leadStatus: "orcamento_enviado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: selectedTechnique.name,
      shouldScheduleFollowUp: true,
      followUpMinutes: 180
    };
  }

  return null;
}

function lashDemoReply(input: AssistantInput): AssistantReply | null {
  if (!isLashDemo(input)) return null;

  const rawMessage = String(input.currentMessage || "").trim();
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
  const selectedSlot = findLashSlot(message);
  const selectedTechnique = findLashTechnique(message);
  const savedTechnique = findLashTechnique(normalizeText(input.lead.interest));
  const effectiveTechnique = selectedTechnique || savedTechnique;
  const selectedProfessional = message.includes("ana") ? "Ana Paula" : message.includes("bianca") ? "Bianca Souza" : null;
  const inferredName = inferLashName(rawMessage);
  const wantsFullEffect = ["bem cheio", "cheio", "cheia", "marcado", "marcada", "destacado", "destacada", "glamouroso", "glamourosa"].some((word) => message.includes(word));

  if (selectedSlot && effectiveTechnique) {
    return {
      reply: `Perfeito${inferredName ? `, ${inferredName}` : ""}. Vou deixar uma pré-reserva demonstrativa para ${effectiveTechnique.name} com ${selectedSlot.professional}, ${selectedSlot.label}. O valor é ${effectiveTechnique.price} e a duração é ${effectiveTechnique.duration}. Para finalizar, posso encaminhar para a atendente confirmar endereço, preparo antes do procedimento e forma de pagamento?`,
      intent: "booking",
      leadStatus: "agendado",
      needsHuman: false,
      detectedName: inferredName,
      detectedInterest: effectiveTechnique.name,
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (selectedSlot) {
    return {
      reply: `Esse horário está disponível com ${selectedSlot.professional}: ${selectedSlot.label}. Para eu deixar pré-reservado, me envie seu nome completo e a técnica desejada. Para primeira aplicação, as mais escolhidas são fio a fio clássico por R$ 140, volume brasileiro por R$ 170 e volume híbrido por R$ 190.`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Horário escolhido",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (wantsFullEffect) {
    return {
      reply: `Para um efeito bem cheio, eu indicaria volume russo se você quiser um olhar mais glamouroso, por R$ 230, ou volume brasileiro se quiser cheio mas mais leve para o dia a dia, por R$ 170. ${agenda} Quer que eu separe um horário com a Ana Paula ou com a Bianca Souza?`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: "Volume para efeito cheio",
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

  if (selectedTechnique) {
    return {
      reply: `${selectedTechnique.name} fica ${selectedTechnique.price} e dura ${selectedTechnique.duration}. ${agenda} Se quiser, já deixo uma pré-reserva: me diga o horário escolhido e seu nome completo.`,
      intent: "pricing",
      leadStatus: "orcamento_enviado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: selectedTechnique.name,
      shouldScheduleFollowUp: true,
      followUpMinutes: 180
    };
  }

  if (selectedProfessional) {
    const slots = selectedProfessional === "Ana Paula" ? "A Ana Paula tem hoje às 15:30, amanhã às 10:00 ou 16:00 e sexta às 14:00." : "A Bianca Souza tem hoje às 17:00, amanhã às 11:30 ou 18:00 e sábado às 09:30.";
    return {
      reply: `${slots} Qual desses horários você quer pré-reservar? Também me diga a técnica desejada: fio a fio, volume brasileiro, híbrido, russo ou efeito molhado.`,
      intent: "booking",
      leadStatus: "agendamento_solicitado",
      needsHuman: false,
      detectedName: null,
      detectedInterest: selectedProfessional,
      shouldScheduleFollowUp: false,
      followUpMinutes: 0
    };
  }

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

function buildLashPrompt(input: AssistantInput) {
  const query = normalizeText(`${input.currentMessage} ${input.recentHistory.slice(-6).map((m) => m.content).join(" ")}`);
  const history = input.recentHistory.slice(-8).map((m) => `${m.direction === "inbound" ? "Cliente" : "Atendente"}: ${truncateText(m.content, 180)}`).join("\n");
  const services = input.services.map((item) => `${item.name} | ${item.price || "sem preço"} | ${item.duration || "sem duração"}`).join("\n");
  const relevantKnowledge = input.knowledgeBase
    .map((item) => {
      const text = normalizeText(`${item.question} ${item.answer} ${item.category || ""}`);
      const score = query.split(/\s+/).filter((word) => word.length > 4 && text.includes(word)).length;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => `P: ${truncateText(item.question, 90)}\nR: ${truncateText(item.answer, 180)}`)
    .join("\n\n");

  return `Você é uma atendente IA de WhatsApp do Studio Bella Lash, especialista em extensão de cílios.
Objetivo: conduzir orçamento, escolha da técnica e pré-reserva usando o histórico.

Agenda fixa:
- Ana Paula: hoje às 15:30, amanhã às 10:00, amanhã às 16:00, sexta às 14:00.
- Bianca Souza: hoje às 17:00, amanhã às 11:30, amanhã às 18:00, sábado às 09:30.

Serviços:
${services}

Base relevante:
${relevantKnowledge || "Sem item relevante além dos serviços e agenda."}

Histórico recente:
${history || "Sem histórico anterior."}

Interesse salvo no lead: ${input.lead.interest || "nenhum"}
Mensagem atual: ${input.currentMessage}

Regras de atendimento:
- Seja natural, consultiva e comercial. Não repita boas-vindas se a conversa já começou.
- Junte informações do histórico: técnica, horário, profissional e nome podem aparecer em mensagens diferentes.
- Se houver interesse salvo no lead e a mensagem atual trouxer horário/nome, use esse interesse como técnica escolhida.
- Se a cliente disser "primeira" ou "primeira aplicação", recomende uma técnica antes de tentar marcar: fio a fio para natural, volume brasileiro para marcado leve.
- Nunca invente nome da cliente. Só use detectedName e chame pelo nome se o nome apareceu literalmente na mensagem atual, no histórico ou já estiver no cadastro do lead.
- Se faltar nome, técnica ou horário, peça só o que falta. Se houver nome+técnica+horário, confirme pré-reserva demonstrativa.
- Natural: fio a fio. Cheio/marcado: volume brasileiro ou russo. Indecisa: compare no máximo 3 opções.
- Não invente horários/preços/descontos/endereço. Risco nos olhos ou pedido de humano: needsHuman=true.
- Resposta curta, 2 a 4 frases, uma pergunta final no máximo.

Retorne apenas JSON válido neste formato:
{"reply":"","intent":"pricing|booking|faq|human|complaint|greeting|unknown|optout","leadStatus":"novo|em_atendimento|aguardando_humano|orcamento_enviado|agendamento_solicitado|agendado|perdido|convertido|optout","needsHuman":false,"detectedName":null,"detectedInterest":null,"shouldScheduleFollowUp":true,"followUpMinutes":180}`;
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
  const safetyReply = lashSafetyReply(input);
  if (safetyReply) return safetyReply;

  const provider = (process.env.LLM_PROVIDER || "local").toLowerCase();
  const apiKey = provider === "openai" ? process.env.OPENAI_API_KEY : provider === "groq" ? process.env.GROQ_API_KEY : undefined;
  const fallbackReply = lashDemoReply(input) || localReply(input);
  if (!apiKey) return fallbackReply;

  const model = process.env.LLM_MODEL || (provider === "openai" ? "gpt-4o-mini" : "llama-3.1-8b-instant");
  const baseURL = provider === "groq" ? "https://api.groq.com/openai/v1" : undefined;
  const client = new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: 10000 });
  const prompt = isLashDemo(input) ? buildLashPrompt(input) : buildPrompt(input);

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: isLashDemo(input) ? 0.45 : 0.3,
      max_tokens: isLashDemo(input) ? 450 : 700,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return normalizeAssistantReply(parsed) || fallbackReply;
  } catch (error) {
    console.error("AI provider failed, using local fallback", error);
    return fallbackReply;
  }
}
