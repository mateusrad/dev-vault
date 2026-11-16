// Interface: troca de telas e eventos.
import { entrar, sair, aoMudarUsuario, mensagemDeErro } from "./auth.js";

const el = (id) => document.getElementById(id);

const telas = {
  carregando: el("carregando"),
  login: el("tela-login"),
  app: el("tela-app"),
};

function mostrarTela(nome) {
  for (const [chave, tela] of Object.entries(telas)) {
    tela.hidden = chave !== nome;
  }
}

function preencherUsuario(usuario) {
  const nome = usuario.displayName || usuario.email || "Usuário";
  el("usuario-nome").textContent = nome;
  el("usuario-email").textContent = usuario.email || "";
  el("boas-vindas-email").textContent = usuario.email || nome;

  const avatar = el("usuario-avatar");
  const inicial = el("usuario-inicial");
  inicial.textContent = nome.charAt(0).toUpperCase();

  if (usuario.photoURL) {
    avatar.src = usuario.photoURL;
    avatar.hidden = false;
    inicial.hidden = true;
    // Se a foto não carregar, volta para a inicial.
    avatar.onerror = () => {
      avatar.hidden = true;
      inicial.hidden = false;
    };
  } else {
    avatar.hidden = true;
    inicial.hidden = false;
  }
}

el("btn-entrar").addEventListener("click", async () => {
  const botao = el("btn-entrar");
  const erro = el("erro-login");
  erro.hidden = true;
  botao.disabled = true;
  try {
    await entrar();
    // A troca de tela acontece em aoMudarUsuario.
  } catch (e) {
    const mensagem = mensagemDeErro(e);
    if (mensagem) {
      erro.textContent = mensagem;
      erro.hidden = false;
    }
    console.error("Erro no login:", e.code || e);
  } finally {
    botao.disabled = false;
  }
});

el("btn-sair").addEventListener("click", () => {
  // Na etapa 6, sair também vai apagar a chave do cofre da memória.
  sair();
});

aoMudarUsuario((usuario) => {
  if (usuario) {
    preencherUsuario(usuario);
    mostrarTela("app");
  } else {
    mostrarTela("login");
  }
});
