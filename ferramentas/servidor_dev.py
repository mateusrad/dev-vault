"""Servidor local de desenvolvimento do Dev Vault.

Igual ao `python -m http.server`, mas manda o navegador não guardar cache,
para cada recarregada pegar o HTML, CSS e JS mais recentes.

Uso (na raiz do projeto):  python ferramentas/servidor_dev.py
Depois abra http://localhost:5500
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORTA = 5500
RAIZ = Path(__file__).resolve().parent.parent


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    # Só escuta no próprio computador (127.0.0.1), não na rede.
    servidor = ThreadingHTTPServer(("127.0.0.1", PORTA), partial(SemCache, directory=str(RAIZ)))
    print(f"Dev Vault em http://localhost:{PORTA} (Ctrl+C para parar)")
    servidor.serve_forever()
