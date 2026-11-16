"""Guarda um comando no Dev Vault a partir do Claude Code (etapa 8).

Uso (com o Python do ambiente virtual em C:\\Users\\mateu\\.devvault\\.venv):

    python ferramentas/guardar_comando.py dados.json
    python ferramentas/guardar_comando.py -  < dados.json      (lê da entrada padrão)
    python ferramentas/guardar_comando.py dados.json --validar (só valida, não acessa o Firebase)

Formato de dados.json:

    {
      "projeto": "BoxHop",
      "nome": "Acessar a VPS",
      "descricao": "opcional",
      "etiquetas": ["SSH"],
      "passos": [{"texto": "opcional", "comando": "ssh boxhop", "aviso": false}]
    }

Cuidados (o Admin SDK ignora as regras do Firestore, revisão técnica D2):
- valida tudo antes de gravar, com os mesmos limites do formulário do app;
- só grava em users/{UID do dono} e só itens do tipo "comando";
- nunca altera senhas e só atualiza um item existente se ele veio do Claude Code
  (item criado no app exige --atualizar-item-do-app, depois de perguntar ao Mateus);
- recusa textos que parecem chaves ou tokens.

A chave de conta de serviço fica só em C:\\Users\\mateu\\.devvault\\chave-servico.json
(ou no caminho da variável de ambiente DEVVAULT_CHAVE), nunca neste repositório.

Códigos de saída: 0 gravado | 1 dados inválidos | 2 erro de configuração ou do Firebase |
3 precisa de confirmação do Mateus.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

PROJETO_FIREBASE = "dev-vault-ee7ab"
# Mesmo UID de firestore.rules e js/auth.js.
UID_DONO = "Q98yL89JwhMqdI2je6FxbNEKYm02"
CHAVE_PADRAO = Path.home() / ".devvault" / "chave-servico.json"

# Mesmos limites do formulário do app (index.html e js/app.js).
LIMITES = {"projeto": 60, "nome": 120, "descricao": 300, "etiquetas": 200, "texto": 300, "comando": 5000}
MAX_PASSOS = 50
CAMPOS_PERMITIDOS = {"projeto", "nome", "descricao", "etiquetas", "passos"}
CAMPOS_PASSO = {"texto", "comando", "aviso"}

# Formatos comuns de segredos. Não pega tudo: o Claude troca segredos por marcadores
# antes de chamar o script; isto é só uma segunda barreira.
PADROES_SEGREDO = [
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "chave privada"),
    (r"\bgh[pousr]_[A-Za-z0-9]{30,}", "token do GitHub"),
    (r"\bgithub_pat_[A-Za-z0-9_]{30,}", "token do GitHub"),
    (r"\bAKIA[0-9A-Z]{16}\b", "chave de acesso da AWS"),
    (r"\bAIza[0-9A-Za-z_\-]{35}\b", "chave de API do Google"),
    (r"\bsk-[A-Za-z0-9_\-]{20,}", "chave de API (sk-...)"),
    (r"\bxox[abprs]-[A-Za-z0-9\-]{10,}", "token do Slack"),
]

SAIDA_OK, SAIDA_INVALIDO, SAIDA_ERRO, SAIDA_CONFIRMAR = 0, 1, 2, 3


class DadosInvalidos(Exception):
    def __init__(self, erros):
        super().__init__("\n".join(erros))
        self.erros = erros


class PrecisaConfirmar(Exception):
    pass


def normalizar(texto):
    """Igual à normalizar() do app: sem acentos, minúsculas e sem espaços nas pontas."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFD", texto) if not unicodedata.combining(c))
    return sem_acento.lower().strip()


def _texto(valor, campo, limite, erros, obrigatorio=False):
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        erros.append(f"{campo}: precisa ser texto.")
        return ""
    valor = valor.strip()
    if obrigatorio and not valor:
        erros.append(f"{campo}: obrigatório.")
    if len(valor) > limite:
        erros.append(f"{campo}: no máximo {limite} caracteres (tem {len(valor)}).")
    return valor


def _procurar_segredos(texto, campo, erros):
    for padrao, descricao in PADROES_SEGREDO:
        if re.search(padrao, texto):
            erros.append(f"{campo}: parece conter {descricao}. Troque por um marcador (ex.: <TOKEN>).")


def validar(dados):
    """Confere os dados e devolve uma cópia limpa. Lança DadosInvalidos com todos os erros."""
    if not isinstance(dados, dict):
        raise DadosInvalidos(["Os dados precisam ser um objeto JSON."])

    erros = []
    extras = set(dados) - CAMPOS_PERMITIDOS
    if extras:
        # Impede gravar campos como tipo, origem, cifra ou vezesCopiado.
        erros.append(f"Campos não permitidos: {', '.join(sorted(extras))}.")

    projeto = _texto(dados.get("projeto"), "projeto", LIMITES["projeto"], erros, obrigatorio=True)
    nome = _texto(dados.get("nome"), "nome", LIMITES["nome"], erros, obrigatorio=True)
    descricao = _texto(dados.get("descricao"), "descricao", LIMITES["descricao"], erros)

    etiquetas = []
    brutas = dados.get("etiquetas") or []
    if not isinstance(brutas, list) or not all(isinstance(e, str) for e in brutas):
        erros.append("etiquetas: precisa ser uma lista de textos.")
    else:
        for etiqueta in (e.strip() for e in brutas):
            if etiqueta and not any(normalizar(e) == normalizar(etiqueta) for e in etiquetas):
                etiquetas.append(etiqueta)
        if len(", ".join(etiquetas)) > LIMITES["etiquetas"]:
            erros.append(f"etiquetas: no máximo {LIMITES['etiquetas']} caracteres no total.")

    passos = []
    brutos = dados.get("passos")
    if not isinstance(brutos, list) or not brutos:
        erros.append("passos: precisa de pelo menos um passo.")
    elif len(brutos) > MAX_PASSOS:
        erros.append(f"passos: no máximo {MAX_PASSOS}.")
    else:
        for i, passo in enumerate(brutos, start=1):
            rotulo = f"passos[{i}]"
            if not isinstance(passo, dict):
                erros.append(f"{rotulo}: precisa ser um objeto.")
                continue
            extras = set(passo) - CAMPOS_PASSO
            if extras:
                erros.append(f"{rotulo}: campos não permitidos: {', '.join(sorted(extras))}.")
            texto = _texto(passo.get("texto"), f"{rotulo}.texto", LIMITES["texto"], erros)
            comando = _texto(passo.get("comando"), f"{rotulo}.comando", LIMITES["comando"], erros)
            aviso = passo.get("aviso", False)
            if not isinstance(aviso, bool):
                erros.append(f"{rotulo}.aviso: precisa ser true ou false.")
                aviso = False
            if not texto and not comando:
                erros.append(f"{rotulo}: precisa de texto ou comando.")
            passos.append({"texto": texto, "comando": comando, "aviso": aviso})

    _procurar_segredos(nome, "nome", erros)
    _procurar_segredos(descricao, "descricao", erros)
    for i, passo in enumerate(passos, start=1):
        _procurar_segredos(passo["texto"], f"passos[{i}].texto", erros)
        _procurar_segredos(passo["comando"], f"passos[{i}].comando", erros)

    if erros:
        raise DadosInvalidos(erros)
    return {"projeto": projeto, "nome": nome, "descricao": descricao, "etiquetas": etiquetas, "passos": passos}


def decidir(existentes, atualizar_item_do_app=False):
    """Decide o que fazer com os itens de mesmo nome já existentes no projeto.

    existentes: lista de dicts com id, tipo e origem.
    Devolve ("criar", None) ou ("atualizar", id). Lança PrecisaConfirmar quando o Mateus precisa decidir.
    """
    if not existentes:
        return "criar", None
    if any(item.get("tipo") == "senha" for item in existentes):
        raise PrecisaConfirmar("Já existe uma SENHA com esse nome no projeto. O script nunca altera senhas: escolha outro nome.")
    if len(existentes) > 1:
        raise PrecisaConfirmar("Há mais de um item com esse nome no projeto. Resolva no app antes de gravar.")
    item = existentes[0]
    if item.get("origem") == "claude-code" or atualizar_item_do_app:
        return "atualizar", item["id"]
    raise PrecisaConfirmar(
        "Já existe um item com esse nome criado no app. Pergunte ao Mateus se pode substituir "
        "e, se ele disser que sim, rode de novo com --atualizar-item-do-app."
    )


def conectar(caminho_chave):
    """Abre o Firestore com a chave de conta de serviço (import aqui para os testes não precisarem do SDK)."""
    if not caminho_chave.is_file():
        raise RuntimeError(f"Chave de conta de serviço não encontrada em {caminho_chave}.")
    dados_chave = json.loads(caminho_chave.read_text(encoding="utf-8"))
    if dados_chave.get("project_id") != PROJETO_FIREBASE:
        raise RuntimeError(f"A chave é do projeto {dados_chave.get('project_id')!r}, não de {PROJETO_FIREBASE!r}.")

    import firebase_admin
    from firebase_admin import credentials, firestore

    app = firebase_admin.initialize_app(credentials.Certificate(str(caminho_chave)))
    return firestore.client(app), firestore.SERVER_TIMESTAMP


def filtro_firestore(campo, op, valor):
    """Filtro de consulta do Firestore (import aqui para os testes não precisarem do SDK)."""
    from google.cloud.firestore_v1 import FieldFilter

    return FieldFilter(campo, op, valor)


def gravar(db, agora, dados, atualizar_item_do_app=False, filtro=filtro_firestore):
    """Grava o item em users/{UID_DONO}. Devolve um texto com o que foi feito.

    `filtro` monta o filtro da consulta (nos testes, um substituto sem o SDK).
    """
    usuario = db.collection("users").document(UID_DONO)
    projetos = usuario.collection("projetos")
    itens = usuario.collection("itens")

    chave_projeto = normalizar(dados["projeto"])
    projeto = next((p for p in projetos.stream() if normalizar(p.to_dict().get("nome", "")) == chave_projeto), None)

    chave_nome = normalizar(dados["nome"])
    if projeto:
        # O Firestore filtra pelo projeto (só lê os itens dele, R-04). O nome é comparado aqui,
        # sem maiúsculas nem acentos, porque o banco não guarda o nome normalizado.
        existentes = [
            {"id": d.id, **d.to_dict()}
            for d in itens.where(filter=filtro("projetoId", "==", projeto.id)).stream()
            if normalizar(d.to_dict().get("nome", "")) == chave_nome
        ]
    else:
        existentes = []

    acao, item_id = decidir(existentes, atualizar_item_do_app)  # decide antes de criar o projeto

    if projeto:
        projeto_id, nome_projeto = projeto.id, projeto.to_dict()["nome"]
    else:
        ref = projetos.document()
        ref.set({"nome": dados["projeto"], "criadoEm": agora})
        projeto_id, nome_projeto = ref.id, dados["projeto"]

    campos = {
        "projetoId": projeto_id,
        "nome": dados["nome"],
        "descricao": dados["descricao"],
        "etiquetas": dados["etiquetas"],
        "passos": dados["passos"],
        "atualizadoEm": agora,
    }
    if acao == "criar":
        itens.document().set({**campos, "tipo": "comando", "origem": "claude-code", "vezesCopiado": 0, "criadoEm": agora})
        texto = f"Criado no projeto {nome_projeto}: {dados['nome']}"
    else:
        # Só os campos editáveis (como no app): tipo, origem, vezesCopiado e criadoEm ficam como estão.
        itens.document(item_id).update(campos)
        texto = f"Atualizado no projeto {nome_projeto}: {dados['nome']}"
    if not projeto:
        texto += " (projeto novo)"
    return texto


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Guarda um comando no Dev Vault.")
    parser.add_argument("arquivo", help="arquivo JSON com o comando, ou - para ler da entrada padrão")
    parser.add_argument("--validar", action="store_true", help="só valida, sem acessar o Firebase")
    parser.add_argument("--atualizar-item-do-app", action="store_true",
                        help="substitui um item de mesmo nome criado no app (só depois de o Mateus confirmar)")
    args = parser.parse_args(argv)

    try:
        # Sempre UTF-8: no Windows a entrada padrão do Python usa cp1252 e corromperia os acentos.
        # "utf-8-sig" aceita também arquivos com BOM (comum quando gerados pelo PowerShell).
        if args.arquivo == "-":
            bruto = sys.stdin.buffer.read().decode("utf-8-sig")
        else:
            bruto = Path(args.arquivo).read_text(encoding="utf-8-sig")
        dados = validar(json.loads(bruto))
    except json.JSONDecodeError as erro:
        print(f"JSON inválido: {erro}", file=sys.stderr)
        return SAIDA_INVALIDO
    except UnicodeDecodeError:
        print("O JSON precisa estar em UTF-8.", file=sys.stderr)
        return SAIDA_INVALIDO
    except OSError as erro:
        print(f"Não foi possível ler o arquivo: {erro}", file=sys.stderr)
        return SAIDA_INVALIDO
    except DadosInvalidos as erro:
        print("Dados inválidos:\n- " + "\n- ".join(erro.erros), file=sys.stderr)
        return SAIDA_INVALIDO

    if args.validar:
        print(f"Dados válidos: {dados['projeto']} / {dados['nome']} ({len(dados['passos'])} passo(s)).")
        return SAIDA_OK

    try:
        db, agora = conectar(Path(os.environ.get("DEVVAULT_CHAVE", CHAVE_PADRAO)))
        print(gravar(db, agora, dados, args.atualizar_item_do_app))
        return SAIDA_OK
    except PrecisaConfirmar as erro:
        print(f"Precisa de confirmação: {erro}", file=sys.stderr)
        return SAIDA_CONFIRMAR
    except Exception as erro:  # noqa: BLE001 (qualquer falha do Firebase vira mensagem clara)
        print(f"Erro: {erro}", file=sys.stderr)
        return SAIDA_ERRO


if __name__ == "__main__":
    sys.exit(main())
