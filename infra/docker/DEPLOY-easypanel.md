# Deploy do SC_OFFICE no EasyPanel

Guia para subir o sistema no **EasyPanel** (servidor `186.226.112.41`, projeto
`scnet`). No EasyPanel **não usamos o Caddy** deste repositório — o próprio
EasyPanel já faz o proxy reverso e o **HTTPS automático** (Let's Encrypt).

O sistema é composto por **5 serviços**:

| Serviço            | O que é                         | Tipo no EasyPanel |
|--------------------|---------------------------------|-------------------|
| `pg_officesc`      | Banco PostgreSQL                | Template Postgres *(já criado)* |
| `redis_officesc`   | Cache / filas                   | Template Redis    |
| `minio_officesc`   | Armazenamento de arquivos (S3)  | Template MinIO    |
| `officesc-api`     | Backend (NestJS)                | App (Dockerfile)  |
| `officesc-web`     | Frontend (Next.js)              | App (Dockerfile)  |

> Os **buckets** do MinIO são criados automaticamente pela API no primeiro boot.
> As **tabelas** do banco e o **usuário admin** também (a API roda `prisma db push`
> e o seed ao iniciar).

---

## 1) DNS

Aponte o subdomínio para o servidor do EasyPanel:

```
escritorio.scnet.com.br   A   186.226.112.41
```

---

## 2) Criar Redis e MinIO

No projeto `scnet`, **+ Serviço → Template**:

- **Redis** → nome `redis_officesc`. Anote a senha que o EasyPanel gera.
- **MinIO** → nome `minio_officesc`. Anote `MINIO_ROOT_USER` e `MINIO_ROOT_PASSWORD`
  (serão o access/secret key). Não precisa criar buckets — a API cria.

> O `pg_officesc` já existe. Abra a página dele e anote a string de conexão
> interna (host, porta, usuário, senha, database).

---

## 3) App `officesc-api` (backend)

**Source:** GitHub → repositório `devscnet-commits/sc_office`, branch padrão
(onde o código foi mesclado).

**Build:**
- Método: **Dockerfile**
- **Build context / pasta base:** `apps/api`
- **Dockerfile:** `Dockerfile` (dentro de `apps/api`)

> Importante (monorepo): o context precisa ser `apps/api` (cada app compila
> sozinho). Se a sua versão do EasyPanel só aceitar Dockerfile na raiz do repo,
> me avise que eu adapto os Dockerfiles.

**Comando de execução (run command)** — cria tabelas + admin no 1º boot:
```
npx prisma db push --skip-generate && (pnpm db:seed || echo 'seed pulado') && node dist/main
```

**Porta interna:** `3001`

**Variáveis de ambiente** (Environment):
```
NODE_ENV=production
PORT=3001

# Banco — copie os dados da página do pg_officesc
DATABASE_URL=postgres://USUARIO:SENHA@pg_officesc:5432/DATABASE

# Redis
REDIS_HOST=redis_officesc
REDIS_PORT=6379
REDIS_PASSWORD=SENHA_DO_REDIS
REDIS_DB=0

# MinIO
MINIO_ENDPOINT=minio_officesc
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=MINIO_ROOT_USER
MINIO_SECRET_KEY=MINIO_ROOT_PASSWORD
MINIO_REGION=us-east-1
MINIO_BUCKET_TEMPLATES=sc-templates
MINIO_BUCKET_DOCUMENTS=sc-documents
MINIO_BUCKET_EMPLOYEES=sc-employees
MINIO_BUCKET_DOSSIER=sc-dossier
MINIO_BUCKET_COMPANY=sc-company
MINIO_BUCKET_TEMP=sc-temp

# Segredos — gere com: openssl rand -hex 48  (rode 2x)
JWT_SECRET=COLE_UMA_STRING_ALEATORIA
REFRESH_TOKEN_SECRET=COLE_OUTRA_STRING_ALEATORIA
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Tem que ser a URL pública do site
CORS_ORIGIN=https://escritorio.scnet.com.br

# E-mail (opcional — só "esqueci a senha"); pode deixar em branco
MAIL_HOST=
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=
MAIL_PASS=
MAIL_FROM="SC Office <noreply@scnet.com.br>"
```

**Domínio (Domains):**
- Host: `escritorio.scnet.com.br`
- **Path:** `/api`
- Porta do container: `3001`
- HTTPS: ligado
- **Não** remover/strip o prefixo `/api` (a API responde em `/api/v1`).

---

## 4) App `officesc-web` (frontend)

**Source:** mesmo repositório/branch.

**Build:**
- Método: **Dockerfile**
- **Build context / pasta base:** `apps/web`
- **Dockerfile:** `Dockerfile`
- **Build Arg / variável de build:**
  ```
  NEXT_PUBLIC_API_URL=https://escritorio.scnet.com.br/api/v1
  ```
  (A URL da API fica "assada" na imagem no momento do build — por isso é build arg.)

**Porta interna:** `3000`

**Variáveis de ambiente:**
```
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
```

**Domínio (Domains):**
- Host: `escritorio.scnet.com.br`
- **Path:** `/`
- Porta do container: `3000`
- HTTPS: ligado

> Resumo do roteamento: o mesmo domínio serve os dois apps — `/api` vai para o
> backend e o resto (`/`) vai para o site. (É o mesmo desenho que o Caddy fazia.)

---

## 5) Ordem e verificação

1. Suba `redis_officesc` e `minio_officesc`.
2. Faça deploy do `officesc-api` e acompanhe os logs: deve aparecer a criação das
   tabelas, do bucket e do admin, e "API running".
3. Faça deploy do `officesc-web`.
4. Configure os domínios/paths dos dois apps e confirme o certificado HTTPS.
5. Acesse **https://escritorio.scnet.com.br**.

**Login inicial:** `admin@scoffice.com` / `Admin@12345` → troque a senha.

---

## Atualizações futuras

Como o source é o GitHub, a cada novo merge no branch é só clicar em **Deploy**
(ou ligar o auto-deploy). A API roda `prisma db push` no boot, então mudanças de
banco são aplicadas sozinhas, sem perda de dados.
