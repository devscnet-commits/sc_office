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

## Passo 5B — Mesmo servidor de outro site (atrás do nginx/Apache)

Use este passo **em vez do Passo 5** quando o sistema vai rodar no **mesmo
servidor** onde já existe outro site (ex.: `scnet.com.br`), que já ocupa as
portas 80/443. Nesse caso, o servidor web que já existe (nginx, Apache ou
cPanel) encaminha o subdomínio para o sistema, e cuida do HTTPS.

1. **DNS:** aponte `escritorio.scnet.com.br` para o **mesmo IP** do servidor onde
   já roda o site atual (o mesmo IP do `scnet.com.br`).

2. **No `.env`:**
   ```
   SITE_ADDRESS=:8080
   PUBLIC_URL=https://escritorio.scnet.com.br
   ```

3. **No `docker-compose.prod.yml`** (serviço `caddy`): comente as portas `80`/`443`
   e deixe somente a interna:
   ```yaml
   ports:
     # - "80:80"
     # - "443:443"
     - "127.0.0.1:8080:8080"
   ```

4. **Suba o sistema** (ele passa a responder só em `127.0.0.1:8080`, sem expor nada
   direto na internet):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. **No nginx que já existe**, crie um site para o subdomínio encaminhando para o
   sistema:
   ```nginx
   server {
       server_name escritorio.scnet.com.br;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host              $host;
           proxy_set_header X-Real-IP         $remote_addr;
           proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           client_max_body_size 25m;   # uploads de documentos
       }

       listen 80;
   }
   ```
   Depois gere o HTTPS do subdomínio (Let's Encrypt):
   ```bash
   sudo certbot --nginx -d escritorio.scnet.com.br
   ```

   > **cPanel/Apache:** em vez do bloco acima, crie o subdomínio no painel e use
   > "Proxy reverso" (ou uma regra `ProxyPass / http://127.0.0.1:8080/`) apontando
   > para `127.0.0.1:8080`, e ative o **AutoSSL** para o certificado.

Pronto: o site atual continua intacto e `https://escritorio.scnet.com.br` passa a
servir o sistema.

---

## Se algo der errado

Pegue o log do serviço que falhou e me mande:

```bash
docker compose -f docker-compose.prod.yml logs api    # ou web, postgres, caddy...
```
