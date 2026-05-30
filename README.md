# Smart Agro — Frontend

Sistema de Gestão da Informação para Produção Agropecuária Familiar.

Interface web do Smart Agro, com foco em Mobile First para atender agricultores familiares em campo.

## Stack Tecnológica

- **Framework:** Next.js 16 (TypeScript)
- **UI:** React 19 + Tailwind CSS 4
- **PWA:** Serwist
- **Gerenciador de pacotes:** npm

## 🚀 Rodando em Desenvolvimento

A estratégia de desenvolvimento é: **frontend e backend rodam direto na máquina** para ter hot reload e debug rápido; só o banco do backend roda em Docker.

> Para subir o frontend em container (cenário de produção), veja [DEPLOYMENT.md](DEPLOYMENT.md).

### Pré-requisitos

- **Node.js 20+** e **npm**
- Backend rodando em `http://localhost:8080` (ver [agro-backend](../agro-backend))

### 1. Clonar e preparar

```bash
git clone <url-do-repositorio>
cd agro-frontend
cp .env.example .env.local
```

O `.env.local` já vem com os valores padrão apontando para `http://localhost:8080`.

### 2. Instalar dependências

```bash
npm install
```

### 3. Rodar a aplicação

```bash
npm run dev
```

O frontend fica disponível em `http://localhost:3000`.

### Outros comandos úteis

```bash
npm run build    # build de produção local
npm run lint     # verificar estilo de código
```

## 🌿 Branches

| Branch | Descrição |
|--------|-----------|
| `main` | Código em produção, estável e revisado |
| `staging` | Ambiente de homologação, pré-produção |
| `develop` | Branch principal de desenvolvimento |

> Novas funcionalidades devem ser criadas a partir de `develop` seguindo o padrão `feature/nome-da-funcionalidade`

## Padrão de Commits

Adotar o padrão Conventional Commits.

- **feat:** nova funcionalidade
- **fix:** correção de bug
- **refactor:** refatoração de código
- **docs:** documentação
- **test:** testes
- **chore:** tarefas gerais/configuração

## 🚢 Deploy

Para subir o frontend em container, ver [DEPLOYMENT.md](DEPLOYMENT.md).
