# Deploy em produção

URL do app:

```text
https://atendenteia.fluirtecnologia.com.br
```

## 1. No servidor

```bash
git clone https://github.com/TIGTM/fluiratendenteia.git
cd fluiratendenteia
cp .env.production.example .env
```

Edite `.env` e preencha:

- `POSTGRES_PASSWORD`
- `N8N_INTERNAL_TOKEN`
- `ADMIN_SESSION_SECRET`
- `GROQ_API_KEY` ou `OPENAI_API_KEY`
- `WAHA_BASE_URL`
- `WAHA_API_KEY`

Gere segredos fortes:

```bash
openssl rand -hex 32
```

## 2. Subir app e banco

```bash
docker compose -f docker-compose.prod.yml up -d --build postgres app
```

Ver logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Testar saúde:

```bash
curl http://localhost:3010/api/health
```

## 3. Nginx e HTTPS

Crie um proxy reverso para `127.0.0.1:3010`.

Exemplo:

```bash
sudo cp deploy/nginx-atendenteia.conf /etc/nginx/sites-available/atendenteia.fluirtecnologia.com.br
sudo ln -s /etc/nginx/sites-available/atendenteia.fluirtecnologia.com.br /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Certificado:

```bash
sudo certbot --nginx -d atendenteia.fluirtecnologia.com.br
```

## 4. Plugar no n8n Docker existente

No `docker-compose.yml` do seu n8n, adicione:

```yaml
environment:
  APP_URL: https://atendenteia.fluirtecnologia.com.br
  N8N_INTERNAL_TOKEN: mesmo-token-do-env-do-atendente
  WAHA_BASE_URL: https://waha.fluirtecnologia.com.br
  WAHA_SESSION: default
  WAHA_API_KEY: mesma-chave-do-waha
  GROQ_API_KEY: sua-chave
  OPENAI_API_KEY: sua-chave
```

Reinicie:

```bash
docker compose up -d
```

Importe os workflows da pasta `n8n/workflows` no painel do n8n.

Webhook WAHA para produção:

```text
https://n8n.gtmalimentos.com.br/webhook/atendente-ia/inbound
```

## 5. Login inicial

Depois do primeiro deploy, rode o seed se o banco estiver vazio:

```bash
docker compose -f docker-compose.prod.yml exec app npx prisma db seed
```

Login:

```text
admin@fluir.local
admin123
```

Troque essa senha depois que criar gestão de usuários.
