# Progresso — Dev Vault (Gerenciador de Comandos)

Atualizado em 16/11/2026.

## Pronto

- Especificação completa: `Gerenciador de Comandos — Especificação.md` (projetos, itens com passos, senhas com senha mestra, integração com o Claude Code).
- Design de referência: canvas "Dev Vault — Telas" (artefato no claude.ai).
- Firebase configurado:
  - projeto `dev-vault-ee7ab`, plano Spark;
  - login com Google ativado;
  - Firestore em `southamerica-east1` (São Paulo), modo de produção;
  - regras por usuário publicadas (cópia em `firestore.rules`);
  - configuração do app web em `js/firebase-config.js` (SDK via CDN, sem npm).
- `CLAUDE.md` do projeto e `.gitignore`.
- Etapa 1 (código pronto): `index.html`, `css/style.css`, `js/auth.js`, `js/app.js`. Login, logout e login mantido ao recarregar testados pelo Mateus em 16/11/2026: **etapa 1 validada**.

## Etapas da especificação

1. ~~Login com Google~~ (pronta, commit `81b449a`)
2. ~~Projetos e itens com passos~~ (pronta, commit `c3d8d2d`)
3. ~~Copiar/Abrir e busca~~ (pronta e validada pelo Mateus em 16/11/2026)
4. ~~Editar, excluir, etiquetas e filtro por tipo~~ (pronta e validada pelo Mateus em 16/11/2026)
5. ~~Atalhos, ordenação por mais usados e ajustes visuais~~ (pronta e validada pelo Mateus em 16/11/2026)
6. ~~Senhas: senha mestra e criptografia~~ (pronta e validada pelo Mateus em 16/11/2026; regras com o cofre "só cria" publicadas). Testes da criptografia: `node testes/cripto.test.mjs`.
7. Deploy no GitHub Pages em `vault.msr-dev.com.br` (pronta). Auditoria pré-deploy e conformidade pré-deploy aprovadas com ressalvas (16/11/2026). Feito: CSP (D1), proteção contra iframe (R-03), aviso no login e autoexclusão de contas sem acesso (C-01), licença MIT (C-02). API key restrita por referenciador (R-02) e autoexclusão testada com uma segunda conta. **Publicado em 16/11/2026** em https://vault.msr-dev.com.br (repositório público `mateusrad/dev-vault`, GitHub Pages a partir do `main`, domínio `msr-dev.com.br` verificado no GitHub, HTTPS obrigatório, domínio autorizado no Firebase; a chave restrita aceita o domínio). Login, cofre e cópia testados pelo Mateus no site publicado. Falta só o teste fora de casa (celular no 4G).
8. Integração com o Claude Code (código pronto em 16/11/2026, falta usar no dia a dia). Script `ferramentas/guardar_comando.py` com validação (D2) e 27 testes (`python -m unittest discover -s testes`); `firebase-admin` 7.8.0 em `C:\Users\mateu\.devvault\.venv`; chave de serviço em `C:\Users\mateu\.devvault\chave-servico.json`. Gravação real testada: o item "Rodar os testes do projeto" apareceu no app com o selo "via Claude Code" (conferido pelo Mateus). Skills globais: `guardar-comando` e o passo 3 da `encerrar`. Falta: usar de verdade em outro projeto (acrescentar "Nome do projeto no Dev Vault" ao CLAUDE.md dele). Revisão técnica do script aprovada em 16/11/2026 (R-04 resolvido).

## Pendências

- Repositório remoto: `https://github.com/mateusrad/dev-vault` (público). Cada push no `main` publica o site. O TXT `_github-pages-challenge-mateusrad` no Registro.br precisa continuar lá (mantém o domínio verificado).
- Certificado HTTPS: o GitHub não começou a emitir em 30 min; resolveu removendo e cadastrando de novo o domínio no Pages.
- 🕓 Validação de campos nas regras do Firestore (tipos e campos permitidos) e testes das regras no emulador (exige instalar o `firebase-tools`).
- D2 (validação no script da etapa 8): resolvido e confirmado na revisão de 16/11/2026.
- Chave de conta de serviço: se vazar, revogar no console do Firebase (Configurações do projeto → Contas de serviço) e gerar outra.
- API key restrita a `vault.msr-dev.com.br/*`, `http://localhost:5500/*` e `dev-vault-ee7ab.firebaseapp.com/*`. Se mudar a porta do servidor local, atualizar no Google Cloud Console (Credenciais). Se o login quebrar por causa da chave, escolher "Nenhuma" em restrições desfaz.
- 🕓 Limpar a área de transferência depois de copiar uma senha (sugestão da auditoria; nas ideias para depois).
- Backups do Firestore exigem o plano Blaze: usar o export em JSON (ideia para depois) como backup.

## Melhorias depois do deploy

- **PWA instalável** (16/11/2026): `manifest.json`, ícones em `icones/` (gerados a partir do `>_` da marca) e `apple-touch-icon` para o iPhone. CSP com `manifest-src 'self'`. **Sem service worker, de propósito:** o Chrome não exige mais para instalar, e num cofre de senhas um cache de arquivos atrasaria correções de segurança sem dar uso offline (o Firestore e o SDK vêm da internet). Publicado e instalado pelo Mateus em 16/11/2026 (sem precisar de service worker).
