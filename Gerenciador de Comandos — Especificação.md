# Gerenciador de Comandos — Especificação

## Objetivo

App web pessoal pra guardar comandos de terminal (VPN, deploy, SSH etc.) e senhas, com nome e descrição, e achar e copiar rápido. Substitui as anotações na conversa do WhatsApp. **Não executa comandos**, só guarda e copia. As **senhas são criptografadas no navegador** com uma senha mestra antes de irem para o Firestore (decisão de 15/11/2026; antes a especificação dizia "não guarda senhas").

## Stack

- HTML, CSS e JavaScript puro (sem framework na primeira versão)
- Firebase Authentication com login do Google
- Cloud Firestore como banco
- Hospedagem no GitHub Pages (repositório do mateusrad), com o subdomínio próprio **`vault.msr-dev.com.br`** (decisão de 16/11/2026). Motivo: no endereço padrão, o app dividiria a origem com os outros sites do GitHub Pages (inclusive o portfólio, que já usa `portfolio.msr-dev.com.br`), e qualquer script desses sites poderia ler a sessão do Firebase guardada no navegador. Com o subdomínio, o Dev Vault tem origem própria.
- Firebase SDK modular (v10 ou mais recente) importado via CDN
- Web Crypto API (nativa do navegador, sem biblioteca extra) para criptografar as senhas

## Funcionalidades da versão 1

1. **Login com Google.** Sem login, só aparece a tela de entrar.
2. **Projetos:** a sidebar lista os projetos (ex.: BoxHop, EscalaPro, Geral) com a contagem de itens; dá para criar projeto novo. "Todos os projetos" mostra tudo.
3. **Lista de itens** do projeto escolhido, em cards: nome, descrição, etiquetas e os **passos**.
4. **Passos:** cada item de comando tem um ou mais passos, em ordem. Cada passo tem texto opcional (o que fazer ou onde rodar) e comando opcional (em fonte monoespaçada), e pode ser marcado como **aviso** (destaque amarelo). Cada comando tem o seu botão **Copiar** (Clipboard API), com aviso rápido de "Copiado!". Se o comando for uma URL (`http://` ou `https://`), aparece também o botão **Abrir**.
5. **Busca instantânea** no topo, em todos os projetos, filtrando por nome, descrição, projeto, etiquetas e texto/comando dos passos enquanto digita, sem diferenciar maiúsculas nem acentos.
6. **Novo item:** formulário com tipo (comando ou senha), projeto, nome (obrigatório), passos (pelo menos um, com adicionar, reordenar, remover e marcar como aviso), etiquetas e descrição (opcionais).
7. **Editar e excluir**, com confirmação antes de excluir.
8. **Filtro por tipo** (Todos, Comandos, Senhas) dentro do projeto.
9. **Atalho de teclado:** `/` ou `Ctrl+K` foca a busca; setas mudam o item selecionado; `Enter` copia o primeiro comando do item selecionado.
10. Tema escuro, layout responsivo (funciona no celular também).
11. **Senhas:** item do tipo "senha", com usuário/identificador opcional (visível, ex.: Access Key ID) e o valor mascarado na lista, com botões de mostrar e copiar. O valor e o usuário não entram na busca.
12. **Senha mestra:** criada no primeiro uso (com confirmação e aviso de que não há recuperação). Para mostrar ou copiar senhas é preciso desbloquear; os comandos funcionam sem desbloquear. O cofre volta a bloquear ao recarregar a página, ao sair da conta ou pelo botão "Bloquear".

Design de referência: canvas "Dev Vault — Telas" (artefato no claude.ai).

## Modelo de dados (Firestore)

Coleção de projetos: `users/{uid}/projetos/{id}`

| Campo | Tipo | Observação |
| --- | --- | --- |
| nome | string | obrigatório, único por usuário (ex.: BoxHop). É por ele que a integração com o Claude Code acha o projeto |
| criadoEm | timestamp | serverTimestamp |

Coleção de itens: `users/{uid}/itens/{id}`

| Campo | Tipo | Observação |
| --- | --- | --- |
| tipo | string | `comando` ou `senha` |
| projetoId | string | id do documento em `projetos` (por id, para renomear o projeto sem mexer nos itens) |
| nome | string | obrigatório |
| descricao | string | opcional |
| etiquetas | array de string | opcional, ex.: `["Docker", "SSH"]` |
| passos | array de map | só em comandos, pelo menos um. Cada passo: `{ texto, comando, aviso }`, com `texto` e `comando` strings opcionais (pelo menos um dos dois) e `aviso` booleano |
| usuario | string | só em senhas, opcional e **não** criptografado (ex.: e-mail da conta, Access Key ID) |
| cifra | string | só em senhas: valor criptografado (AES-GCM), em base64 |
| iv | string | só em senhas: vetor de inicialização de 12 bytes, em base64, novo a cada gravação |
| origem | string | `app` ou `claude-code` (quem criou o item) |
| vezesCopiado | number | incrementa ao copiar, pra ordenar os mais usados |
| criadoEm | timestamp | serverTimestamp |
| atualizadoEm | timestamp | serverTimestamp |

Documento do cofre: `users/{uid}/cofre/config`

| Campo | Tipo | Observação |
| --- | --- | --- |
| salt | string | 16 bytes aleatórios, em base64, gerados ao criar a senha mestra |
| iteracoes | number | iterações do PBKDF2 (600.000, recomendação atual da OWASP para PBKDF2-SHA256) |
| verificador | string | um texto fixo criptografado, usado para saber se a senha mestra digitada está certa |
| verificadorIv | string | IV do verificador |

### Como a criptografia funciona

1. A senha mestra passa pelo PBKDF2-SHA256 com o `salt` e gera uma chave AES-GCM de 256 bits, marcada como não exportável.
2. A chave fica **só na memória** da aba. Nunca vai para o Firestore, `localStorage` ou qualquer outro lugar.
3. Para desbloquear, o app tenta decifrar o `verificador`. Se falhar, a senha mestra está errada.
4. Nome, descrição, etiquetas e usuário das senhas **não** são criptografados, para a busca funcionar. A interface avisa para não colocar segredos nesses campos.
5. Não há recuperação: esqueceu a senha mestra, as senhas ficam ilegíveis. Trocar a senha mestra exige decifrar e cifrar tudo de novo (fica para depois da versão 1).

## Regras de segurança do Firestore

Só a conta do dono lê e grava, e só na própria pasta. A versão em vigor está em `firestore.rules`: a função `ehDono(uid)` exige `request.auth.uid == uid` **e** que esse `uid` seja o UID fixo da conta do Mateus. Outras contas Google conseguem fazer login, mas o banco recusa tudo, e o app mostra a mensagem "não tem acesso" e apaga na hora o registro dessa conta no Firebase Authentication (conformidade C-01; a tela de login avisa isso) (revisão técnica R-01, 16/11/2026: sem isso, qualquer pessoa poderia gastar a cota gratuita). O UID é usado no lugar do e-mail porque o arquivo vai para um repositório público.

## Estrutura de arquivos

- `index.html`
- `css/style.css`
- `js/firebase-config.js` (configuração do projeto Firebase)
- `js/auth.js` (login e logout)
- `js/db.js` (CRUD no Firestore)
- `js/cripto.js` (senha mestra, derivação da chave, cifrar e decifrar senhas)
- `js/app.js` (interface, busca, copiar, atalhos)

## Configuração no Firebase (passo a passo)

Feito em 16/11/2026: projeto `dev-vault` (ID `dev-vault-ee7ab`), plano **Spark** (gratuito, sem cartão), Firestore `(default)` em **`southamerica-east1` (São Paulo)**, login Google ativado, app Web `dev-vault-web` registrado e regras publicadas (cópia em `firestore.rules`). Backups programados do Firestore exigem o Blaze e ficaram desativados. Falta só o passo 3 (domínio do GitHub Pages), que fica para a etapa 7.

1. Criar projeto no console do Firebase.
2. Ativar Authentication com o provedor Google.
3. Em Authentication, Domínios autorizados, adicionar `vault.msr-dev.com.br`.
4. Criar o Firestore em modo produção e colar as regras acima.
5. Registrar um app Web e copiar o objeto de configuração para `firebase-config.js`.

## Etapas de desenvolvimento (validar cada uma antes de seguir)

1. Estrutura de arquivos e tela de login funcionando com Google.
2. Projetos e itens: criar projeto, cadastrar e listar itens com passos.
3. Botões Copiar e Abrir por passo, e busca instantânea.
4. Editar, excluir, etiquetas e filtro por tipo.
5. Atalhos de teclado, ordenação por mais usados e ajustes visuais.
6. Senhas: senha mestra, criptografia, desbloqueio e bloqueio.
7. Deploy no GitHub Pages com o subdomínio `vault.msr-dev.com.br` e teste fora de casa. Ordem: verificar o domínio `msr-dev.com.br` na conta do GitHub (registro TXT, evita que outra conta "sequestre" o subdomínio), criar o repositório e ativar o Pages, adicionar o domínio personalizado no repositório, criar o CNAME `vault` → `mateusrad.github.io` no Registro.br, ativar "Enforce HTTPS" e autorizar o domínio no Firebase.
8. Integração com o Claude Code (abaixo).

## Integração com o Claude Code (etapa 8)

Objetivo: os comandos úteis que aparecem enquanto trabalho num projeto com o Claude Code vão para o Dev Vault, no projeto certo, sem eu precisar copiar à mão.

- **Quando:** no fim da sessão, a skill `encerrar` lista os comandos novos que apareceram (como rodar, deploy, acesso, scripts) e eu marco quais guardar. Também posso pedir na hora ("guarda esse comando"). Nada é gravado sem a minha confirmação. Se a lista no `encerrar` não funcionar bem, ajustamos depois.
- **Como grava:** o script `ferramentas/guardar_comando.py`, versionado neste repositório (assim tem histórico e passa pelas revisões), usando o `firebase-admin` instalado num ambiente virtual fora do repositório (`C:\Users\mateu\.devvault\.venv`) e uma chave de conta de serviço guardada só em `C:\Users\mateu\.devvault\chave-servico.json` (nunca no Git nem no frontend). O script recebe projeto, nome, passos, etiquetas e descrição. Ele acha o projeto pelo nome (ou cria, se não existir) e grava com `origem: "claude-code"`. Se já houver um item com o mesmo nome no projeto, atualiza em vez de duplicar.
- **Projeto:** o nome vem do CLAUDE.md do projeto aberto no Claude Code.
- **Cuidados:**
  - Antes de gravar, o Claude troca por marcadores ou descarta comandos com tokens, chaves, e-mails ou IPs reais.
  - **Senhas nunca passam por esse caminho**, porque só o navegador, com a senha mestra, consegue cifrá-las.
  - O Admin SDK ignora as regras do Firestore, então a chave de serviço precisa de cuidado. Mesmo que vaze, as senhas continuam cifradas.
  - Como as regras não protegem esse caminho, **o próprio script valida os dados antes de gravar** (revisão técnica 1, item D2): `tipo` sempre `comando`, pelo menos um passo, cada passo com `texto`/`comando` string e `aviso` booleano, limites de tamanho iguais aos do formulário, e só grava em `users/{UID do dono}`. Nunca altera itens com `tipo: "senha"` e só atualiza um item existente se ele tiver `origem: "claude-code"`; se o item com o mesmo nome veio do app, pergunta antes.
- **No app:** itens com `origem: "claude-code"` mostram o selo "via Claude Code".
- **Projeto no CLAUDE.md:** cada projeto pode ter a linha "Nome do projeto no Dev Vault: **Nome**", que a skill usa para achar o projeto sempre com o mesmo nome.
- **Skills (globais, em `C:\Users\mateu\.claude\skills\`):** `guardar-comando` (grava na hora, com confirmação) e o passo 3 da `encerrar` (lista os comandos da sessão para marcar quais guardar).
- **Códigos de saída do script:** 0 gravado, 1 dados inválidos, 2 erro de configuração ou rede, 3 precisa da confirmação do Mateus.

## Ideias para depois (fora da versão 1)

- Exportar e importar em JSON (backup)
- Variáveis no comando, ex.: `ssh {{usuario}}@{{ip}}`, preenchidas antes de copiar
- ~~Transformar em PWA instalável~~ (feito em 16/11/2026: manifest e ícones, sem service worker; ver `PROGRESSO.md`)
- Importar as anotações atuais do WhatsApp
- Ligar um item a outro como pré-requisito (ex.: "Deploy na VPS" depende de "Acessar a VPS"); por enquanto, isso vai no texto do passo
- Bloqueio automático das senhas após um tempo sem uso
- Trocar a senha mestra
- Limpar a área de transferência um tempo depois de copiar uma senha (auditoria pré-deploy; só funciona com a aba em foco)
