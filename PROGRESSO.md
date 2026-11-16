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

## Falta (etapas da especificação)

2. Projetos e itens com passos ← **próximo passo**
3. Copiar/Abrir e busca
4. Editar, excluir, etiquetas e filtro por tipo
5. Atalhos, ordenação por mais usados e ajustes visuais
6. Senhas: senha mestra e criptografia
7. Deploy no GitHub Pages (adicionar `mateusrad.github.io` aos domínios autorizados)
8. Integração com o Claude Code

## Pendências

- Iniciar o repositório Git (`git init`), com confirmação.
- 🕓 Validação de campos nas regras do Firestore (tipos e campos permitidos) e testes das regras no emulador.
- Backups do Firestore exigem o plano Blaze: usar o export em JSON (ideia para depois) como backup.
