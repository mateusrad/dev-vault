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
4. Editar, excluir, etiquetas e filtro por tipo ← **próximo passo**
5. Atalhos, ordenação por mais usados e ajustes visuais
6. Senhas: senha mestra e criptografia
7. Deploy no GitHub Pages em `vault.msr-dev.com.br` (passos na especificação)
8. Integração com o Claude Code

## Pendências

- Git iniciado (branch `main`, primeiro commit `81b449a`). Falta criar o repositório no GitHub e fazer o push (antes da etapa 7).
- 🕓 Validação de campos nas regras do Firestore (tipos e campos permitidos) e testes das regras no emulador.
- Backups do Firestore exigem o plano Blaze: usar o export em JSON (ideia para depois) como backup.
