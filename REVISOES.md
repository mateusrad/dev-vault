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

## Revisão 2026-11-16 — Auditoria pré-deploy e etapa 6

- Material: `docs/revisoes/2026-11-16-auditoria-pre-deploy.md`
- Commit revisado: `89c782c` + CSP (D1) ainda sem commit (auditoria: visão do sistema inteiro, sem diff)

Veredito: Aprovada com ressalvas (pronta para o deploy depois do R-02)

- R-02 [P1] API key sem restrição de referenciador HTTP — **resolvido** em 16/11/2026 (Mateus, no Google Cloud Console). Referenciadores: `vault.msr-dev.com.br/*`, `http://localhost:5500/*` e `dev-vault-ee7ab.firebaseapp.com/*` (sem este, o login por popup quebra). O `localhost:*` sugerido **não funcionou**: o Google respondeu `API_KEY_HTTP_REFERRER_BLOCKED` para `http://localhost:5500/`; com o endereço exato, login e gravação voltaram. Conferir o `vault.msr-dev.com.br/*` logo depois do deploy. O `127.0.0.1:*` sugerido não é necessário: só o `localhost` está autorizado no Firebase. Observação: o referenciador pode ser falsificado fora do navegador; a restrição reduz abuso de cota, quem protege os dados continuam sendo as regras.
- R-03 [P3] Proteção contra enquadramento (clickjacking) — **resolvido**, com ajuste: o script sugerido no `<head>` seria bloqueado pela própria CSP (sem `'unsafe-inline'`), e só redirecionar a página de cima falha com iframe `sandbox`. Implementado no fim de `js/app.js`: dentro de um iframe, o app não inicia e mostra a tela "não funciona dentro de outra página". Testado com iframe normal e com `sandbox` (`ferramentas/teste-iframe.html`).
- Melhoria: checar `crypto.subtle` sem HTTPS — **descartado com justificativa**: com "Enforce HTTPS" o GitHub Pages redireciona todo `http` para `https`, e o localhost é contexto seguro; o caso não ocorre no uso real.
- Melhoria: limpar a área de transferência depois de copiar senha — **adiado** (ideias para depois). O navegador só escreve na área de transferência com a aba em foco, então a limpeza falharia em silêncio se o usuário já tiver trocado de janela.

Itens anteriores:
- R-01 — **resolvido**: teste com segunda conta Google feito em 16/11/2026 (acesso negado e logout). O registro de terceiros no Authentication virou o item C-01 da conformidade (resolvido com autoexclusão da conta). O revisor marcou "parcialmente"; a parte que faltava foi tratada no C-01.
- D1 CSP via `<meta>` — **resolvido** (revisor confirmou a política como correta e mínima).
- D2 — **adiado** (etapa 8). Q1 — **adiado**. Testes das regras no emulador — **adiado**.

Conformidade: nada novo a levar.

## Revisão 2026-11-16 — Etapa 8 e ajustes pós-auditoria

- Material: `docs/revisoes/2026-11-16-etapa-8-integracao.md`
- Commit revisado: `4d492e3` + etapa 8 ainda sem commit (arquivos novos completos; ajustes pós-auditoria como diff `89c782c..4d492e3`)

Veredito: Aprovada

- R-04 [P3] Leitura integral da coleção `itens` no script (custo de leituras) — **resolvido**. A consulta usa `where(filter=FieldFilter("projetoId", "==", id))`, então o Firestore só devolve os itens do projeto. O nome continua comparado no Python (sem maiúsculas e acentos), porque o banco não guarda o nome normalizado. O aviso de argumentos posicionais não aparece mais (gravação real conferida). Teste: `test_busca_itens_filtrando_pelo_projeto_no_banco`.
- Melhoria: passar o JSON pela entrada padrão (`- < arquivo`) na skill — **descartado com justificativa**: a skill passa só o caminho de um arquivo gerado pelo Claude (sem aspas nem espaços), e o conteúdo não passa pelo terminal. Além disso, no Windows o `sys.stdin` do Python usa cp1252 e a entrada redirecionada corromperia os acentos. Achado nessa conferência e corrigido: o modo `-` do script passou a ler UTF-8 (e os dois modos aceitam BOM; bytes que não são UTF-8 dão saída 1). Testes: `test_stdin_le_utf8_mesmo_com_entrada_cp1252` e `test_aceita_bom_e_recusa_bytes_que_nao_sao_utf8`.

Itens anteriores:
- D2 Validação dos dados no script da etapa 8 — **resolvido** (confirmado pelo revisor).
- R-03 — **resolvido** (código revisado nesta rodada).
- Q1 e testes das regras no emulador — **adiados**.

Conformidade: nada a levar (C-01 resolvido com a autoexclusão da conta, confirmado pelo revisor).
