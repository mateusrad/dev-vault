# Histórico de revisões técnicas
Revisor: Gemini (Gem "Revisor Técnico"). Quem decide e aplica: Mateus, com o Claude Code.
Status possíveis: pendente | resolvido | parcialmente resolvido | adiado | descartado com justificativa | não verificável

## Revisão 2026-11-16 — Etapas 1 a 5

- Material: `docs/revisoes/2026-11-16-etapas-1-a-5.md`
- Commit revisado: `a11006b` (primeira revisão: arquivos completos, sem diff)

Veredito: Aprovada com ressalvas

- R-01 [P1] Risco de exaustão de cota no plano gratuito por usuários terceiros — **parcialmente resolvido**. Regras restritas ao UID da conta do dono (e não ao e-mail sugerido pelo revisor, porque `firestore.rules` vai para repositório público; o e-mail sugerido também não era o da conta usada) e aviso + logout no app para outras contas. Falta: testar com uma segunda conta Google e verificar se dá para impedir que logins de terceiros fiquem registrados no Authentication (etapa 7).
- D1 Content-Security-Policy via `<meta>` — **adiado** para a etapa 7 (deploy). Provável ajuste na sugestão: incluir `https://apis.google.com` em `script-src` (script do login por popup).
- D2 Validar os dados no script local da etapa 8 (o Admin SDK ignora as regras) — **adiado** para a etapa 8. Regras de validação já anotadas na especificação.
- Q1 Validar campos e tipos nas regras do Firestore — **adiado** (prioridade baixa para um usuário só, como o revisor concordou).
- Testes das regras no emulador — **adiado** (exige instalar o `firebase-tools`; pedir autorização antes).

Conformidade: levar ao agente de conformidade: o app aceitava o login e a criação de perfil de qualquer conta Google. Mitigado pelo R-01 (ninguém além do dono usa o app); resta o registro de logins de terceiros no Authentication. Anotado no PROGRESSO.md para decidir antes do deploy.
