# 🚢 Deploy em Produção — Frontend

Sobe o Next.js em container. O backend precisa estar rodando e acessível antes de iniciar.

Para o fluxo de **desenvolvimento** (sem Docker), ver [README.md](README.md).

---

## Pré-requisitos

- **Docker** ≥ 24 e **Docker Compose v2**
- Backend rodando e acessível na URL que você vai configurar em `PUBLIC_API_URL`

---

## 1. Configurar variáveis de ambiente

```bash
cp .env.example .env.prod
chmod 600 .env.prod
```

Editar `.env.prod`:

```bash
# URL pública do backend — o browser vai chamar esse endereço diretamente
PUBLIC_API_URL=https://api.seu-dominio.com
NEXT_PUBLIC_API_URL=https://api.seu-dominio.com
```

> `NEXT_PUBLIC_API_URL` é embutida no bundle durante o build (valor fixo). `PUBLIC_API_URL` é lida pelo compose pra passar como build-arg. Ambas precisam ter o mesmo valor.

---

## 2. Build e subida

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Verificar:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
# frontend (healthy)

curl -I http://localhost:3000   # HTTP/1.1 200 OK
```

---

## 3. Ver logs

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
```

---

## 4. Atualizar para nova versão

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

---

## 5. Parar

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```
