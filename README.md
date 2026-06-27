# Fluir Atendente IA

Plataforma SaaS operacional para vender e operar uma Atendente IA para WhatsApp para pequenas empresas. O projeto usa Next.js, TypeScript, Tailwind, PostgreSQL, Prisma, WAHA, n8n e integração com IA via Groq ou OpenAI.

## Funcionalidades

- Landing page comercial em `/`
- Demo visual de WhatsApp em `/demo`
- Painel administrativo em `/admin`
- Login simples com usuário seed
- CRUD de clientes, base de conhecimento, serviços e leads
- Registro de conversas inbound/outbound
- APIs internas para n8n com token obrigatório
- Motor de IA em `lib/ai.ts` com suporte a Groq, OpenAI e fallback local
- Workflows n8n importáveis em `n8n/workflows`
- Docker Compose com app, PostgreSQL e perfis opcionais para n8n/WAHA

## Requisitos

- Node.js 20+
- npm
- Docker Desktop ou PostgreSQL local

## Configurar ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
DATABASE_URL="postgresql://fluir:fluir@localhost:5432/fluir_atendente_ia?schema=public"
APP_URL=http://localhost:3000
N8N_INTERNAL_TOKEN=troque-este-token
ADMIN_SESSION_SECRET=troque-este-segredo
LLM_PROVIDER=groq
LLM_MODEL=
GROQ_API_KEY=
OPENAI_API_KEY=
WAHA_BASE_URL=http://localhost:3001
WAHA_SESSION=default
```

Use `LLM_PROVIDER=groq` ou `LLM_PROVIDER=openai`. Se nenhuma chave for informada, o sistema usa uma resposta local de fallback para facilitar testes.

## Instalar dependências

```bash
npm install
```

## Subir PostgreSQL com Docker

```bash
docker compose up -d postgres
```

## Rodar migrations e seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

O seed cria:

- Admin: `admin@fluir.local`
- Senha: `admin123`
- Cliente demo: Clínica Bella Estética
- 8 itens de base de conhecimento
- 5 serviços demo

## Iniciar app

```bash
npm run dev
```

Acesse:

- Landing: `http://localhost:3000`
- Demo: `http://localhost:3000/demo`
- Admin: `http://localhost:3000/admin`

Se a porta 3000 conflitar, rode:

```bash
npm run dev -- -p 3002
```

Também ajuste `APP_URL` no `.env` e no ambiente do n8n.

## Docker Compose completo

Para app e PostgreSQL:

```bash
docker compose up -d postgres app
```

Para subir também n8n e WAHA internos:

```bash
docker compose --profile automation up -d
```

Se você já tem n8n ou WAHA rodando, use apenas `postgres` e `app`, apontando `WAHA_BASE_URL` e `APP_URL` para os serviços externos.

## Deploy em produção

O domínio planejado para produção é:

```text
https://atendenteia.fluirtecnologia.com.br
```

Arquivos prontos para deploy:

- `docker-compose.prod.yml`
- `.env.production.example`
- `deploy/DEPLOY.md`
- `deploy/nginx-atendenteia.conf`
- `deploy/n8n-docker-env.example`

Resumo no servidor:

```bash
git clone https://github.com/TIGTM/fluiratendenteia.git
cd fluiratendenteia
cp .env.production.example .env
nano .env
docker compose -f docker-compose.prod.yml up -d --build postgres app
```

Depois configure o proxy reverso para `127.0.0.1:3000` e emita SSL para `atendenteia.fluirtecnologia.com.br`.

O healthcheck do app fica em:

```text
https://atendenteia.fluirtecnologia.com.br/api/health
```

Veja o passo a passo completo em `deploy/DEPLOY.md`.

## Importar workflows no n8n

No n8n:

1. Acesse Workflows.
2. Clique em Import from File.
3. Importe os arquivos:
   - `n8n/workflows/atendente-ia-inbound.json`
   - `n8n/workflows/atendente-ia-followup.json`
   - `n8n/workflows/atendente-ia-relatorio-diario.json`
4. Configure variáveis de ambiente no n8n:
   - `APP_URL`
   - `N8N_INTERNAL_TOKEN`
   - `WAHA_BASE_URL`
   - `WAHA_SESSION`
   - `GROQ_API_KEY`
   - `OPENAI_API_KEY`

Os workflows usam HTTP Request nodes com headers por env e não exigem credenciais internas para o básico funcionar.

## Configurar webhook no WAHA

Configure o webhook do WAHA apontando para:

```text
https://MEU-N8N/webhook/atendente-ia/inbound
```

Localmente:

```text
http://localhost:5678/webhook/atendente-ia/inbound
```

A sessão WAHA precisa estar conectada. O session name deve bater com o cadastro do cliente no painel. O cliente demo usa `default`.

O workflow envia mensagens usando:

```text
POST {{$env.WAHA_BASE_URL}}/api/sendText
```

Body:

```json
{
  "session": "default",
  "chatId": "5531999999999@c.us",
  "text": "mensagem"
}
```

Se sua versão do WAHA exigir outro formato, ajuste o node "Enviar via WAHA" no n8n.

## Testar conversa inbound sem WAHA

Com o app rodando:

```bash
curl -X POST http://localhost:3000/api/n8n/message/inbound \
  -H "Authorization: Bearer troque-este-token" \
  -H "Content-Type: application/json" \
  -d "{\"session\":\"default\",\"from\":\"5531888888888@c.us\",\"phone\":\"5531888888888\",\"name\":\"Cliente Teste\",\"message\":\"Qual o valor da limpeza de pele?\",\"timestamp\":\"2026-06-25T18:00:00.000Z\"}"
```

Depois teste a IA:

```bash
curl -X POST http://localhost:3000/api/n8n/ai/reply \
  -H "Authorization: Bearer troque-este-token" \
  -H "Content-Type: application/json" \
  -d @payload-retornado-do-inbound.json
```

## API interna para n8n

Todas exigem:

```text
Authorization: Bearer ${N8N_INTERNAL_TOKEN}
```

Rotas:

- `GET /api/n8n/tenant/by-session/:session`
- `GET /api/n8n/tenant/by-phone/:phone`
- `POST /api/n8n/message/inbound`
- `POST /api/n8n/message/outbound`
- `POST /api/n8n/lead/update`
- `GET /api/n8n/followups/due`
- `POST /api/n8n/followups/mark-sent`
- `GET /api/n8n/reports/daily`
- `POST /api/n8n/log`
- `POST /api/n8n/ai/reply`

## Cadastrar novo cliente

1. Entre em `/admin`.
2. Preencha "Clientes/empresas".
3. Informe `Session WAHA` igual ao nome da sessão no WAHA.
4. Marque status `ativo`.
5. Cadastre base de conhecimento e serviços para esse cliente.

## Ativar ou desativar cliente

No painel, o campo `status` controla se o cliente pode receber mensagens. Tenants inativos não são processados pela rota inbound.

## Ajustar base de conhecimento

No bloco "Base de conhecimento", cadastre perguntas e respostas objetivas. A IA usa esses dados como fonte principal e é instruída a não inventar preços ou horários.

## LGPD, opt-out e anti-spam

- Mensagens com `parar`, `cancelar`, `sair`, `não quero` ou equivalentes mudam o lead para `optout`.
- Follow-up não é enviado para `convertido`, `perdido`, `optout` ou `aguardando_humano`.
- O limite é de 2 follow-ups por lead.
- O bot pausa quando o lead entra em modo humano.
- O painel permite excluir lead e, por cascata, dados relacionados de clientes.
- Chaves secretas são mascaradas na tela de configuração.

## Erros comuns

`Unauthorized` nas APIs:
verifique se o header `Authorization` está exatamente como `Bearer valor-do-N8N_INTERNAL_TOKEN`.

Tenant não encontrado:
confira se `session` recebido do WAHA é igual ao `Session WAHA` cadastrado no painel.

Prisma não conecta:
confira `DATABASE_URL`, se o container `postgres` está rodando e se a porta 5432 está livre.

WAHA não envia:
confira `WAHA_BASE_URL`, sessão conectada e formato do endpoint `/api/sendText`.

n8n importa mas workflow falha:
confira variáveis de ambiente do n8n e se `APP_URL` é acessível a partir do container do n8n. Em Docker Compose, use `http://app:3000`, não `localhost`.
