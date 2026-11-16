# Histórico de avaliações de conformidade legal
Revisor: Gemini (Gem "Revisor de Conformidade Legal"). Quem decide e aplica: Mateus, com o Claude Code.
Esta avaliação não substitui orientação jurídica.
Status possíveis: pendente | resolvido | parcialmente resolvido | adiado | depende de terceiro | descartado com justificativa | não verificável

## Conformidade 2026-11-16 — Pré-deploy

- Material: `docs/revisoes/2026-11-16-conformidade-pre-deploy.md`

Cenário: uso exclusivamente pessoal (art. 4º, I, "a" da LGPD, segundo o revisor), com a página exposta publicamente.

Veredito: Com pendências (baixa complexidade). Política de privacidade e termos de uso não se aplicam; o aviso na tela de login basta. CDNs (Google Fonts, SDK do Firebase) não exigem aviso nem banner de cookies.

- C-01 [P2] Coleta de dados de terceiros sem finalidade (Firebase Authentication) — **resolvido**, com ajuste: (1) aviso na tela de login, antes do botão, com texto mais exato que o sugerido (o registro fica no Firebase Authentication do projeto, com e-mail, nome e foto); (2) no lugar da limpeza manual periódica, o app apaga na hora a conta que entra sem acesso (`deleteUser`, em `js/auth.js`), nunca a do dono. Se o Firebase recusar (login antigo restaurado), só desconecta e o registro fica para limpar no console. Confirmado em 16/11/2026: depois do login com uma segunda conta Google, só a conta do dono aparece em Authentication → Usuários.
- C-02 [P3] Ausência de licença no repositório público — **resolvido**: decisão do Mateus pela licença MIT (arquivo `LICENSE`). SDK (Apache-2.0) e fontes (OFL-1.1) são carregados por CDN, sem redistribuição.

Itens anteriores: primeira avaliação.

A confirmar com profissional: nada. Não verificado: bloqueio de cadastro de contas novas pelo Identity Platform no plano gratuito (deixou de ser necessário com a autoexclusão).
