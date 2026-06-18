# Como subir o SC_OFFICE com Docker

Guia passo a passo. Tudo roda em conjunto (banco, cache, armazenamento, API e
site) com **um comando**. Você não precisa instalar banco de dados na mão — o
Docker cria tudo.

> Todos os comandos abaixo são executados **dentro da pasta `infra/docker`**.

---

## Pré-requisito

- Docker Desktop (ou Docker + Docker Compose) instalado e aberto.
- Porta **80** livre na máquina (é por onde o site responde).

---

## Passo 1 — Gerar os segredos

Você precisa de 2 senhas aleatórias longas (`JWT_SECRET` e `REFRESH_TOKEN_SECRET`).
Rode **duas vezes** e guarde os resultados:

```bash
openssl rand -hex 48
```

> No Windows, use o **Git Bash** (vem com o Git). Se preferir Node:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## Passo 2 — Criar o arquivo `.env`

```bash
cp .env.prod.example .env
```

Abra o `.env` e preencha:

- `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_SECRET_KEY` → invente senhas fortes.
- `JWT_SECRET` e `REFRESH_TOKEN_SECRET` → cole as duas strings do Passo 1.
- Para testar no seu PC, **deixe** `SITE_ADDRESS=:80` e `PUBLIC_URL=http://localhost`.

---

## Passo 3 — Subir tudo

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

A primeira vez demora alguns minutos (ele baixa e constrói as imagens). Ao
final, no **primeiro boot** a API cria as tabelas do banco e o usuário
administrador automaticamente.

Acompanhe os logs (opcional):

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Passo 4 — Acessar

Abra no navegador: **http://localhost**

Login inicial:

- **E-mail:** `admin@scoffice.com`
- **Senha:** `Admin@12345`

> ⚠️ Troque essa senha assim que entrar. Existe também um usuário de RH:
> `rh@scoffice.com` / `Rh@12345`.

---

## Comandos úteis

```bash
# parar tudo (sem apagar os dados)
docker compose -f docker-compose.prod.yml down

# parar e APAGAR os dados (banco, arquivos) — recomeça do zero
docker compose -f docker-compose.prod.yml down -v

# ver o que está rodando
docker compose -f docker-compose.prod.yml ps

# recriar o admin / dados de base manualmente (se precisar)
docker compose -f docker-compose.prod.yml exec api pnpm db:seed
```

---

## Passo 5 — Colocar no domínio (no servidor)

Quando for para o servidor de verdade (em `escritorio.scnet.com.br`):

1. Garanta que o DNS de `escritorio.scnet.com.br` aponta para o servidor e que
   as portas **80 e 443** estão abertas para a internet.
2. No `.env`, troque para:
   ```
   SITE_ADDRESS=escritorio.scnet.com.br
   PUBLIC_URL=https://escritorio.scnet.com.br
   ```
3. Suba de novo (o `--build` é necessário porque a URL fica embutida no site):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

O Caddy detecta o domínio e **gera o certificado HTTPS sozinho** (Let's Encrypt).
Não precisa configurar certificado na mão.

---

## Se algo der errado

Pegue o log do serviço que falhou e me mande:

```bash
docker compose -f docker-compose.prod.yml logs api    # ou web, postgres, caddy...
```
