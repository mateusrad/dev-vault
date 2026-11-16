# CLAUDE.md — Dev Vault (Gerenciador de Comandos)

## Tipo de projeto

**Projeto pessoal**, de uso próprio. Não há cliente nem venda. O Mateus é o único usuário previsto. O site fica público no GitHub Pages, mas cada conta Google só enxerga os próprios dados (regras do Firestore).

Nome do projeto no Dev Vault (usado pela integração com o Claude Code, etapa 8): **Dev Vault**.

## Objetivo

App web para guardar comandos de terminal (organizados por projeto e em passos) e senhas (criptografadas no navegador com senha mestra), com busca rápida e botão de copiar. Substitui as anotações no WhatsApp.

A especificação completa (funcionalidades, modelo de dados, criptografia, etapas) está em `Gerenciador de Comandos — Especificação.md`. **Ela é a fonte da verdade:** em caso de dúvida sobre escopo, siga a especificação.
O design de referência é o canvas "Dev Vault — Telas" (artefato no claude.ai): tema One Dark, Inter na interface e JetBrains Mono no código.

## Stack

- HTML, CSS e JavaScript puro, com módulos ES (`type="module"`). **Sem framework, sem npm e sem build.**
- Firebase SDK modular via CDN (`https://www.gstatic.com/firebasejs/<versão>/...`). Todos os imports usam a **mesma versão** (hoje 12.0.0). Para atualizar, troque o número em todos os arquivos de `js/`.
- Firebase Authentication (Google) e Cloud Firestore.
- Web Crypto API para as senhas (etapa 6).
- Hospedagem: GitHub Pages no subdomínio próprio `vault.msr-dev.com.br` (origem separada dos outros sites do GitHub Pages; ver a especificação). O DNS do domínio fica no Registro.br.

## Firebase

- Projeto: `dev-vault-ee7ab`, plano **Spark** (gratuito).
- Firestore `(default)` em `southamerica-east1` (São Paulo).
- Regras: `firestore.rules`. É só uma cópia: as regras valem quando são **publicadas no console** (Firestore → Regras). Ao mudar o arquivo, publique de novo.
- A configuração em `js/firebase-config.js` **não é segredo**. Já a chave de conta de serviço (etapa 8) **é segredo** e fica só em `C:\Users\mateu\.devvault\`, nunca neste repositório.

## Como rodar localmente

Módulos ES não funcionam abrindo o arquivo direto (`file://`). É preciso um servidor local. Use o servidor de desenvolvimento, que desliga o cache do navegador (com o `python -m http.server`, o navegador às vezes mostra CSS e JS antigos):

```
python ferramentas/servidor_dev.py
```

Depois, abra **http://localhost:5500** (use `localhost`, não `127.0.0.1`: só o `localhost` está nos domínios autorizados do Firebase).

## Estrutura

- `index.html`: telas de carregamento, login e app.
- `favicon.svg`, `manifest.json` e `icones/`: favicon e PWA instalável (sem service worker).
- `CNAME`: criado pelo GitHub Pages para o domínio `vault.msr-dev.com.br`. Não apagar.
- `css/style.css`: tokens de cor (variáveis CSS) e estilos.
- `js/firebase-config.js`: inicializa o app Firebase.
- `js/auth.js`: login, logout e observador do usuário.
- `js/db.js`: CRUD no Firestore (etapa 2).
- `js/cripto.js`: senha mestra e criptografia (etapa 6).
- `js/app.js`: interface e eventos.

## Regras específicas

- Textos da interface em português do Brasil.
- Não adicionar bibliotecas. Se algo parecer exigir uma, pergunte antes.
- Nunca colocar segredos em nome, descrição, etiquetas ou usuário de um item: esses campos não são criptografados.
- A chave da criptografia fica só na memória, nunca em `localStorage` ou no Firestore.
- Testes e lint: ainda não configurados (o projeto não usa npm). Os testes de regras no emulador estão anotados como pendência no `PROGRESSO.md`.
