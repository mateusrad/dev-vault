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
7. Deploy no GitHub Pages em `vault.msr-dev.com.br` (passos na especificação) ← **próximo passo**. Auditoria pré-deploy e conformidade pré-deploy aprovadas com ressalvas (16/11/2026). Feito: CSP (D1), proteção contra iframe (R-03), aviso no login e autoexclusão de contas sem acesso (C-01), licença MIT (C-02). API key restrita por referenciador (R-02) e autoexclusão testada com uma segunda conta. Falta: criar o repositório no GitHub e seguir a ordem do deploy na especificação; depois do deploy, conferir que a chave aceita `vault.msr-dev.com.br`.
8. Integração com o Claude Code

## Pendências

- Git iniciado (branch `main`, primeiro commit `81b449a`). Falta criar o repositório no GitHub e fazer o push (antes da etapa 7).
- 🕓 Validação de campos nas regras do Firestore (tipos e campos permitidos) e testes das regras no emulador (exige instalar o `firebase-tools`).
- 🕓 Revisão 1 (ver `REVISOES.md`): validação dos dados no script da etapa 8 (D2).
- API key restrita a `vault.msr-dev.com.br/*`, `http://localhost:5500/*` e `dev-vault-ee7ab.firebaseapp.com/*`. Se mudar a porta do servidor local, atualizar no Google Cloud Console (Credenciais). Se o login quebrar por causa da chave, escolher "Nenhuma" em restrições desfaz.
- 🕓 Limpar a área de transferência depois de copiar uma senha (sugestão da auditoria; nas ideias para depois).
- Backups do Firestore exigem o plano Blaze: usar o export em JSON (ideia para depois) como backup.
