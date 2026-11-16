"""Testes do script da etapa 8 (ferramentas/guardar_comando.py).

Rodar (só biblioteca padrão, sem Firebase nem internet):
    python -m unittest discover -s testes -v
"""
import itertools
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ferramentas"))

import guardar_comando as gc  # noqa: E402

AGORA = "SERVER_TIMESTAMP"


def dados_validos(**mudancas):
    base = {
        "projeto": "BoxHop",
        "nome": "Acessar a VPS",
        "descricao": "Entra no servidor",
        "etiquetas": ["SSH"],
        "passos": [{"texto": "Abra o terminal", "comando": "ssh boxhop", "aviso": False}],
    }
    base.update(mudancas)
    return base


# ---------- Firestore falso (só o que o script usa) ----------

_ids = itertools.count(1)


class Doc:
    def __init__(self, colecao, doc_id):
        self.colecao, self.id = colecao, doc_id

    def set(self, dados):
        self.colecao.docs[self.id] = dict(dados)

    def update(self, dados):
        self.colecao.docs[self.id].update(dados)

    def to_dict(self):
        return dict(self.colecao.docs[self.id])

    def collection(self, nome):
        return self.colecao.banco.colecao(f"{self.colecao.caminho}/{self.id}/{nome}")


class Colecao:
    def __init__(self, banco, caminho):
        self.banco, self.caminho, self.docs = banco, caminho, {}

    def document(self, doc_id=None):
        return Doc(self, doc_id or f"id{next(_ids)}")

    def stream(self):
        return [Doc(self, i) for i in list(self.docs)]

    def where(self, *, filter):  # noqa: A002 (mesmo nome do parâmetro do SDK)
        campo, op, valor = filter  # o filtro falso dos testes é só uma tupla
        assert op == "=="
        self.banco.consultas.append((self.caminho, campo, valor))
        origem = self

        class Consulta:
            def stream(self_inner):
                return [Doc(origem, i) for i, d in list(origem.docs.items()) if d.get(campo) == valor]
        return Consulta()


def filtro_falso(campo, op, valor):
    return (campo, op, valor)


class Banco:
    def __init__(self):
        self.colecoes = {}
        self.consultas = []  # (coleção, campo, valor) de cada where()

    def colecao(self, caminho):
        return self.colecoes.setdefault(caminho, Colecao(self, caminho))

    def collection(self, nome):
        return self.colecao(nome)

    def itens(self, uid=gc.UID_DONO):
        return self.colecao(f"users/{uid}/itens").docs

    def projetos(self, uid=gc.UID_DONO):
        return self.colecao(f"users/{uid}/projetos").docs


# ---------- Validação ----------

class TestValidar(unittest.TestCase):
    def test_dados_validos_sao_limpos(self):
        limpo = gc.validar(dados_validos(nome="  Acessar a VPS  ", etiquetas=["SSH", " ssh ", "Docker", ""]))
        self.assertEqual(limpo["nome"], "Acessar a VPS")
        self.assertEqual(limpo["etiquetas"], ["SSH", "Docker"])  # duplicada (sem diferenciar maiúsculas) e vazia saem

    def test_campos_opcionais_podem_faltar(self):
        limpo = gc.validar({"projeto": "Geral", "nome": "Listar", "passos": [{"comando": "ls"}]})
        self.assertEqual(limpo["descricao"], "")
        self.assertEqual(limpo["etiquetas"], [])
        self.assertEqual(limpo["passos"], [{"texto": "", "comando": "ls", "aviso": False}])

    def test_recusa_campos_que_o_script_nao_pode_gravar(self):
        for campo in ("tipo", "origem", "cifra", "vezesCopiado"):
            with self.subTest(campo=campo), self.assertRaises(gc.DadosInvalidos):
                gc.validar(dados_validos(**{campo: "x"}))

    def test_recusa_campo_extra_no_passo(self):
        with self.assertRaises(gc.DadosInvalidos):
            gc.validar(dados_validos(passos=[{"comando": "ls", "senha": "x"}]))

    def test_obrigatorios(self):
        for mudanca in ({"projeto": ""}, {"nome": "   "}, {"passos": []}, {"passos": [{"texto": "", "comando": ""}]}):
            with self.subTest(mudanca=mudanca), self.assertRaises(gc.DadosInvalidos):
                gc.validar(dados_validos(**mudanca))

    def test_tipos_errados(self):
        for mudanca in ({"nome": 123}, {"etiquetas": "SSH"}, {"passos": [{"comando": "ls", "aviso": "sim"}]},
                        {"passos": ["ls"]}):
            with self.subTest(mudanca=mudanca), self.assertRaises(gc.DadosInvalidos):
                gc.validar(dados_validos(**mudanca))
        with self.assertRaises(gc.DadosInvalidos):
            gc.validar(["não", "é", "objeto"])

    def test_limites_iguais_ao_formulario(self):
        gc.validar(dados_validos(nome="n" * 120, passos=[{"comando": "c" * 5000}]))
        for mudanca in ({"projeto": "p" * 61}, {"nome": "n" * 121}, {"descricao": "d" * 301},
                        {"passos": [{"texto": "t" * 301}]}, {"passos": [{"comando": "c" * 5001}]},
                        {"passos": [{"comando": "ls"}] * 51}, {"etiquetas": [f"{i}" * 50 for i in range(5)]}):
            with self.subTest(mudanca=list(mudanca)), self.assertRaises(gc.DadosInvalidos):
                gc.validar(dados_validos(**mudanca))

    def test_recusa_textos_que_parecem_segredos(self):
        segredos = [
            "export GH=ghp_" + "a" * 36,
            "aws configure set aws_access_key_id AKIA" + "A" * 16,
            "curl ...?key=AIza" + "b" * 35,
            "-----BEGIN RSA PRIVATE KEY-----",
            "OPENAI=sk-" + "c" * 30,
        ]
        for comando in segredos:
            with self.subTest(comando=comando[:20]), self.assertRaises(gc.DadosInvalidos):
                gc.validar(dados_validos(passos=[{"comando": comando}]))

    def test_marcador_no_lugar_do_segredo_passa(self):
        gc.validar(dados_validos(passos=[{"comando": "export GH=<TOKEN_GITHUB>"}]))

    def test_mostra_todos_os_erros_de_uma_vez(self):
        with self.assertRaises(gc.DadosInvalidos) as ctx:
            gc.validar({"projeto": "", "nome": "", "passos": []})
        self.assertEqual(len(ctx.exception.erros), 3)


# ---------- Decisão ----------

class TestDecidir(unittest.TestCase):
    def test_sem_item_cria(self):
        self.assertEqual(gc.decidir([]), ("criar", None))

    def test_item_do_claude_code_atualiza(self):
        self.assertEqual(gc.decidir([{"id": "a", "tipo": "comando", "origem": "claude-code"}]), ("atualizar", "a"))

    def test_item_do_app_pede_confirmacao(self):
        with self.assertRaises(gc.PrecisaConfirmar):
            gc.decidir([{"id": "a", "tipo": "comando", "origem": "app"}])
        self.assertEqual(gc.decidir([{"id": "a", "tipo": "comando", "origem": "app"}], atualizar_item_do_app=True),
                         ("atualizar", "a"))

    def test_nunca_mexe_em_senha_nem_com_confirmacao(self):
        with self.assertRaises(gc.PrecisaConfirmar):
            gc.decidir([{"id": "a", "tipo": "senha", "origem": "app"}], atualizar_item_do_app=True)

    def test_nome_repetido_pede_para_resolver_no_app(self):
        with self.assertRaises(gc.PrecisaConfirmar):
            gc.decidir([{"id": "a", "tipo": "comando", "origem": "claude-code"},
                        {"id": "b", "tipo": "comando", "origem": "claude-code"}])


# ---------- Gravação (Firestore falso) ----------

class TestGravar(unittest.TestCase):
    def setUp(self):
        self.banco = Banco()

    def gravar(self, dados, **kw):
        return gc.gravar(self.banco, AGORA, gc.validar(dados), filtro=filtro_falso, **kw)

    def test_busca_itens_filtrando_pelo_projeto_no_banco(self):
        # R-04: os itens são filtrados pelo projeto no Firestore, sem ler o cofre inteiro.
        self.banco.projetos()["p1"] = {"nome": "BoxHop"}
        self.gravar(dados_validos())
        self.assertEqual(self.banco.consultas, [(f"users/{gc.UID_DONO}/itens", "projetoId", "p1")])

    def test_cria_projeto_e_item_na_pasta_do_dono(self):
        texto = self.gravar(dados_validos())
        self.assertIn("projeto novo", texto)
        gravadas = [c for c, col in self.banco.colecoes.items() if col.docs]
        self.assertEqual(sorted(gravadas), [f"users/{gc.UID_DONO}/itens", f"users/{gc.UID_DONO}/projetos"])
        (item,) = self.banco.itens().values()
        self.assertEqual(item["tipo"], "comando")
        self.assertEqual(item["origem"], "claude-code")
        self.assertEqual(item["vezesCopiado"], 0)
        (projeto_id,) = self.banco.projetos()
        self.assertEqual(item["projetoId"], projeto_id)

    def test_acha_projeto_sem_diferenciar_maiusculas_e_acentos(self):
        self.banco.projetos()["p1"] = {"nome": "Configuração"}
        self.gravar(dados_validos(projeto="configuracao"))
        self.assertEqual(len(self.banco.projetos()), 1)
        (item,) = self.banco.itens().values()
        self.assertEqual(item["projetoId"], "p1")

    def test_atualiza_item_do_claude_code_preservando_contagem(self):
        self.banco.projetos()["p1"] = {"nome": "BoxHop"}
        self.banco.itens()["i1"] = {"tipo": "comando", "origem": "claude-code", "projetoId": "p1",
                                    "nome": "acessar a vps", "vezesCopiado": 7, "criadoEm": "antes"}
        texto = self.gravar(dados_validos())
        self.assertTrue(texto.startswith("Atualizado"))
        item = self.banco.itens()["i1"]
        self.assertEqual((item["vezesCopiado"], item["criadoEm"], item["origem"]), (7, "antes", "claude-code"))
        self.assertEqual(item["passos"][0]["comando"], "ssh boxhop")

    def test_item_do_app_nao_e_alterado_sem_confirmacao(self):
        self.banco.projetos()["p1"] = {"nome": "BoxHop"}
        original = {"tipo": "comando", "origem": "app", "projetoId": "p1", "nome": "Acessar a VPS", "passos": []}
        self.banco.itens()["i1"] = dict(original)
        with self.assertRaises(gc.PrecisaConfirmar):
            self.gravar(dados_validos())
        self.assertEqual(self.banco.itens()["i1"], original)

    def test_mesmo_nome_em_outro_projeto_cria_item_novo(self):
        self.banco.projetos()["p1"] = {"nome": "Outro"}
        self.banco.itens()["i1"] = {"tipo": "comando", "origem": "app", "projetoId": "p1", "nome": "Acessar a VPS"}
        self.gravar(dados_validos())
        self.assertEqual(len(self.banco.itens()), 2)

    def test_recusa_sem_criar_projeto_quando_precisa_confirmar(self):
        # Se a gravação for recusada, nada é criado (nem o projeto).
        self.banco.projetos()["p1"] = {"nome": "BoxHop"}
        self.banco.itens()["i1"] = {"tipo": "senha", "origem": "app", "projetoId": "p1", "nome": "Acessar a VPS"}
        with self.assertRaises(gc.PrecisaConfirmar):
            self.gravar(dados_validos())
        self.assertEqual(len(self.banco.projetos()), 1)


# ---------- Linha de comando ----------

class TestMain(unittest.TestCase):
    def rodar(self, conteudo, *args):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            f.write(conteudo)
        try:
            return gc.main([f.name, *args])
        finally:
            Path(f.name).unlink()

    def test_validar_nao_acessa_o_firebase(self):
        import json
        self.assertEqual(self.rodar(json.dumps(dados_validos()), "--validar"), gc.SAIDA_OK)

    def test_json_invalido(self):
        self.assertEqual(self.rodar("{não é json", "--validar"), gc.SAIDA_INVALIDO)

    def rodar_stdin(self, bruto, *args):
        import io
        from unittest import mock
        entrada = io.TextIOWrapper(io.BytesIO(bruto), encoding="cp1252")  # como o Windows abre o stdin
        with mock.patch.object(sys, "stdin", entrada), mock.patch.object(gc, "validar", wraps=gc.validar) as v:
            saida = gc.main(["-", *args])
        return saida, v

    def test_stdin_le_utf8_mesmo_com_entrada_cp1252(self):
        import json
        bruto = json.dumps(dados_validos(projeto="Configuração"), ensure_ascii=False).encode("utf-8")
        saida, validar = self.rodar_stdin(bruto, "--validar")
        self.assertEqual(saida, gc.SAIDA_OK)
        self.assertEqual(validar.call_args.args[0]["projeto"], "Configuração")

    def test_aceita_bom_e_recusa_bytes_que_nao_sao_utf8(self):
        import json
        bruto = json.dumps(dados_validos()).encode("utf-8")
        self.assertEqual(self.rodar_stdin(b"\xef\xbb\xbf" + bruto, "--validar")[0], gc.SAIDA_OK)
        self.assertEqual(self.rodar_stdin("{\"nome\": \"ação\"}".encode("cp1252"), "--validar")[0],
                         gc.SAIDA_INVALIDO)

    def test_sem_chave_da_erro_de_configuracao(self):
        import json
        import os
        os.environ["DEVVAULT_CHAVE"] = str(Path(__file__).parent / "nao-existe.json")
        try:
            self.assertEqual(self.rodar(json.dumps(dados_validos())), gc.SAIDA_ERRO)
        finally:
            del os.environ["DEVVAULT_CHAVE"]


if __name__ == "__main__":
    unittest.main()
