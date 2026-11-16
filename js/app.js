// Interface: telas, sidebar de projetos, lista de itens e formulário de novo item.
import { entrar, sair, aoMudarUsuario, mensagemDeErro } from "./auth.js";
import { observarProjetos, observarItens, criarProjeto, criarItem } from "./db.js";

// ---------- Estado ----------

const TODOS = "todos";

const estado = {
  uid: null,
  projetos: [],          // [{ id, nome, ... }] em ordem alfabética
  itens: [],             // [{ id, nome, passos, ... }]
  projetosCarregados: false,
  itensCarregados: false,
  projetoAtual: TODOS,   // id do projeto ou "todos"
};

let pararDeObservar = [];

// ---------- Utilitários ----------

const el = (id) => document.getElementById(id);

// Cria um elemento. Textos entram sempre como texto (nunca como HTML),
// então um comando com "<script>" aparece escrito, sem ser executado.
function h(tag, props = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (chave === "class") elemento.className = valor;
    else if (chave.startsWith("on")) elemento.addEventListener(chave.slice(2), valor);
    else elemento.setAttribute(chave, valor === true ? "" : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : String(filho));
  }
  return elemento;
}

// Ícones fixos (texto nosso, não vem do usuário).
const ICONES = {
  pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>',
  terminal: '<path d="M4 17l6-5-6-5"></path><path d="M12 19h8"></path>',
  mais: '<path d="M12 5v14M5 12h14"></path>',
  aviso: '<path d="M12 4l9 16H3l9-16z"></path><path d="M12 10v4M12 17v.01"></path>',
  subir: '<path d="M12 19V5M6 11l6-6 6 6"></path>',
  descer: '<path d="M12 5v14M6 13l6 6 6-6"></path>',
  remover: '<path d="M6 6l12 12M18 6L6 18"></path>',
};

function icone(nome, tamanho = 16) {
  const span = document.createElement("span");
  span.innerHTML = `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;
  return span.firstChild;
}

// "Ação" e "acao" viram a mesma chave: compara sem maiúsculas e sem acentos.
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function ordenarPorNome(lista) {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

function plural(n, singular, pluralTexto) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

let temporizadorToast;
function mostrarToast(mensagem, tipo = "sucesso") {
  const toast = el("toast");
  toast.textContent = mensagem;
  toast.classList.toggle("e-erro", tipo === "erro");
  toast.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => { toast.hidden = true; }, tipo === "erro" ? 5000 : 2000);
}

function projetoPorId(id) {
  return estado.projetos.find((p) => p.id === id);
}

function projetoPorNome(nome) {
  const chave = normalizar(nome);
  return estado.projetos.find((p) => normalizar(p.nome) === chave);
}

// ---------- Telas ----------

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

  const avatar = el("usuario-avatar");
  const inicial = el("usuario-inicial");
  inicial.textContent = nome.charAt(0).toUpperCase();

  if (usuario.photoURL) {
    avatar.src = usuario.photoURL;
    avatar.hidden = false;
    inicial.hidden = true;
    avatar.onerror = () => {
      avatar.hidden = true;
      inicial.hidden = false;
    };
  } else {
    avatar.hidden = true;
    inicial.hidden = false;
  }
}

// ---------- Sidebar ----------

function renderizarSidebar() {
  const contagem = {};
  for (const item of estado.itens) {
    contagem[item.projetoId] = (contagem[item.projetoId] || 0) + 1;
  }

  const botao = (id, nome, total) =>
    h("button", {
      type: "button",
      class: "item-projeto",
      "aria-current": estado.projetoAtual === id ? "page" : null,
      onclick: () => selecionarProjeto(id),
    },
      h("span", { class: "item-projeto-nome" }, nome),
      h("span", { class: "item-projeto-contagem", "aria-label": plural(total, "item", "itens") }, total),
    );

  el("lista-projetos").replaceChildren(
    botao(TODOS, "Todos os projetos", estado.itens.length),
    ...estado.projetos.map((p) => botao(p.id, p.nome, contagem[p.id] || 0)),
  );

  el("nomes-projetos").replaceChildren(...estado.projetos.map((p) => h("option", { value: p.nome })));
}

function selecionarProjeto(id) {
  estado.projetoAtual = id;
  fecharMenu();
  renderizarTudo();
}

// Formulário "Novo projeto" dentro da sidebar
function abrirFormProjeto() {
  el("btn-novo-projeto").hidden = true;
  el("form-novo-projeto").hidden = false;
  el("erro-novo-projeto").hidden = true;
  el("campo-novo-projeto").value = "";
  el("campo-novo-projeto").removeAttribute("aria-invalid");
  el("campo-novo-projeto").focus();
}

function fecharFormProjeto() {
  el("form-novo-projeto").hidden = true;
  el("btn-novo-projeto").hidden = false;
}

el("btn-novo-projeto").addEventListener("click", abrirFormProjeto);
el("btn-cancelar-projeto").addEventListener("click", fecharFormProjeto);
el("campo-novo-projeto").addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharFormProjeto();
});

el("form-novo-projeto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const campo = el("campo-novo-projeto");
  const erro = el("erro-novo-projeto");
  const nome = campo.value.trim();

  let mensagem = "";
  if (!nome) mensagem = "Dê um nome ao projeto.";
  else if (projetoPorNome(nome)) mensagem = "Já existe um projeto com esse nome.";

  if (mensagem) {
    erro.textContent = mensagem;
    erro.hidden = false;
    campo.setAttribute("aria-invalid", "true");
    campo.focus();
    return;
  }

  try {
    const id = await criarProjeto(estado.uid, nome);
    fecharFormProjeto();
    selecionarProjeto(id);
    mostrarToast(`Projeto "${nome}" criado`);
  } catch (erroFirestore) {
    console.error(erroFirestore);
    mostrarToast("Não foi possível criar o projeto. Tente de novo.", "erro");
  }
});

// Menu lateral no celular
function abrirMenu() {
  el("sidebar").classList.add("aberta");
  el("fundo-menu").hidden = false;
  el("btn-menu").setAttribute("aria-expanded", "true");
  el("lista-projetos").querySelector("button")?.focus();
}

function fecharMenu() {
  if (!el("sidebar").classList.contains("aberta")) return;
  el("sidebar").classList.remove("aberta");
  el("fundo-menu").hidden = true;
  el("btn-menu").setAttribute("aria-expanded", "false");
}

el("btn-menu").addEventListener("click", abrirMenu);
el("fundo-menu").addEventListener("click", fecharMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharMenu();
});

// ---------- Lista de itens ----------

function renderizarLista() {
  const projeto = projetoPorId(estado.projetoAtual) || null;
  const emTodos = !projeto;
  const tituloTexto = emTodos ? "Todos os projetos" : projeto.nome;

  const itens = ordenarPorNome(
    emTodos ? estado.itens : estado.itens.filter((i) => i.projetoId === estado.projetoAtual),
  );

  el("titulo-mobile").textContent = tituloTexto;
  const carregado = estado.projetosCarregados && estado.itensCarregados;
  el("titulo-lista").replaceChildren(
    h("span", { class: "titulo-lista-nome" }, tituloTexto),
    carregado ? h("span", { class: "titulo-lista-contagem" }, plural(itens.length, "item", "itens")) : null,
  );

  const lista = el("lista-itens");

  if (!carregado) {
    lista.setAttribute("aria-busy", "true");
    lista.replaceChildren(
      h("div", { class: "esqueleto" }),
      h("div", { class: "esqueleto" }),
      h("div", { class: "esqueleto" }),
    );
    return;
  }
  lista.removeAttribute("aria-busy");

  if (itens.length === 0) {
    lista.replaceChildren(estadoVazio(projeto));
    return;
  }

  lista.replaceChildren(...itens.map((item) => cardItem(item, emTodos)));
}

function estadoVazio(projeto) {
  const semProjetos = estado.projetos.length === 0;

  let titulo, texto, acoes;
  if (projeto) {
    titulo = "Nada salvo neste projeto ainda";
    texto = ["Guarde aqui os comandos do ", h("strong", {}, projeto.nome), "."];
    acoes = [
      h("button", { type: "button", class: "btn btn-primario", onclick: () => abrirFormItem() },
        icone("mais"), "Novo item neste projeto"),
      h("button", { type: "button", class: "btn btn-fantasma", onclick: () => selecionarProjeto(TODOS) },
        "Ver todos os projetos"),
    ];
  } else if (semProjetos) {
    titulo = "Seu cofre está vazio";
    texto = ["Cadastre o primeiro comando. O projeto pode ser criado no próprio formulário."];
    acoes = [
      h("button", { type: "button", class: "btn btn-primario", onclick: () => abrirFormItem() },
        icone("mais"), "Novo item"),
    ];
  } else {
    titulo = "Nenhum item salvo ainda";
    texto = ["Escolha um projeto na lista ou cadastre um item novo."];
    acoes = [
      h("button", { type: "button", class: "btn btn-primario", onclick: () => abrirFormItem() },
        icone("mais"), "Novo item"),
    ];
  }

  return h("div", { class: "estado-vazio" },
    h("div", { class: "estado-vazio-icone" }, icone("pasta", 36)),
    h("h2", {}, titulo),
    h("p", {}, ...texto),
    h("div", { class: "estado-vazio-acoes" }, ...acoes),
  );
}

function cardItem(item, mostrarProjeto) {
  const passos = item.passos || [];
  const numerar = passos.length > 1;
  const projeto = projetoPorId(item.projetoId);

  const marcadores = [
    mostrarProjeto && projeto ? h("span", { class: "etiqueta-projeto" }, projeto.nome) : null,
    ...(item.etiquetas || []).map((t) => h("span", { class: "etiqueta" }, t)),
  ].filter(Boolean);

  return h("article", { class: "card" },
    h("div", { class: "card-info" },
      h("div", { class: "card-titulo" },
        h("h2", { class: "card-nome" }, item.nome),
        item.origem === "claude-code"
          ? h("span", { class: "selo" }, icone("terminal", 12), "via Claude Code")
          : null,
      ),
      item.descricao ? h("p", { class: "card-descricao" }, item.descricao) : null,
      marcadores.length ? h("div", { class: "card-marcadores" }, ...marcadores) : null,
    ),
    h("ol", { class: "card-passos" },
      ...passos.map((passo, i) => passoNoCard(passo, numerar ? i + 1 : null)),
    ),
  );
}

function passoNoCard(passo, numero) {
  let texto = null;
  if (passo.texto && passo.aviso) {
    texto = h("div", { class: "passo-aviso", role: "note" },
      icone("aviso"),
      h("p", {}, h("strong", {}, "Atenção: "), passo.texto),
    );
  } else if (passo.texto) {
    texto = h("p", { class: "passo-texto" }, passo.texto);
  }

  const comando = passo.comando
    ? h("div", { class: "bloco-codigo" }, h("pre", {}, h("code", {}, passo.comando)))
    : null;

  return h("li", { class: "passo" },
    numero ? h("span", { class: "passo-numero", "aria-hidden": "true" }, numero) : null,
    h("div", { class: "passo-corpo" }, texto, comando),
  );
}

function renderizarTudo() {
  // Se o projeto aberto deixou de existir, volta para "Todos".
  if (estado.projetoAtual !== TODOS && estado.projetosCarregados && !projetoPorId(estado.projetoAtual)) {
    estado.projetoAtual = TODOS;
  }
  renderizarSidebar();
  renderizarLista();
}

// ---------- Formulário de novo item ----------

const dialogo = el("dlg-item");
let passosForm = [];

function passoVazio() {
  return { texto: "", comando: "", aviso: false };
}

function abrirFormItem() {
  fecharMenu();
  el("form-item").reset();
  limparErrosItem();
  passosForm = [passoVazio()];
  renderizarPassosForm();

  // Já vem com o projeto aberto (ou o único projeto, se só houver um).
  const projeto = projetoPorId(estado.projetoAtual)
    || (estado.projetos.length === 1 ? estado.projetos[0] : null);
  el("f-projeto").value = projeto ? projeto.nome : "";

  dialogo.showModal();
  (projeto ? el("f-nome") : el("f-projeto")).focus();
}

dialogo.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => dialogo.close()));
el("btn-novo-item").addEventListener("click", abrirFormItem);
el("btn-novo-item-mobile").addEventListener("click", abrirFormItem);

// O textarea do comando cresce conforme o texto.
function ajustarAltura(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

function renderizarPassosForm(focarIndice = null) {
  const total = passosForm.length;

  const linhas = passosForm.map((passo, i) => {
    const n = i + 1;
    const idTexto = `passo-${n}-texto`;
    const idComando = `passo-${n}-comando`;

    const campoTexto = h("input", {
      id: idTexto,
      type: "text",
      maxlength: "300",
      autocomplete: "off",
      placeholder: passo.aviso ? "Ex.: Guarde a senha do zip antes de continuar" : "Ex.: Abra o túnel SSH:",
      oninput: (e) => { passo.texto = e.target.value; },
    });
    campoTexto.value = passo.texto;

    const campoComando = h("textarea", {
      id: idComando,
      rows: "1",
      maxlength: "5000",
      spellcheck: "false",
      autocapitalize: "off",
      placeholder: "Ex.: ssh boxhop",
      oninput: (e) => { passo.comando = e.target.value; ajustarAltura(e.target); },
    });
    campoComando.value = passo.comando;

    const botaoAcao = (nomeIcone, rotulo, acao, extra = {}) =>
      h("button", { type: "button", class: "btn-icone", "aria-label": rotulo, title: rotulo, onclick: acao, ...extra },
        icone(nomeIcone));

    return h("div", { class: `passo-form${passo.aviso ? " e-aviso" : ""}` },
      h("span", { class: "passo-numero", "aria-hidden": "true" }, n),
      h("div", { class: "passo-form-campos" },
        h("label", { for: idTexto, class: "rotulo-passo" },
          passo.aviso ? "Aviso" : "Instrução", h("span", { class: "sr-only" }, ` do passo ${n}`),
          h("span", { class: "opcional" }, " (opcional)")),
        campoTexto,
        h("label", { for: idComando, class: "rotulo-passo" },
          "Comando ou link", h("span", { class: "sr-only" }, ` do passo ${n}`),
          h("span", { class: "opcional" }, " (opcional, em fonte de código)")),
        campoComando,
      ),
      h("div", { class: "passo-form-acoes" },
        botaoAcao("aviso", `Marcar passo ${n} como aviso`, () => {
          passo.aviso = !passo.aviso;
          renderizarPassosForm(i);
        }, { "aria-pressed": passo.aviso ? "true" : "false" }),
        i > 0 ? botaoAcao("subir", `Subir passo ${n}`, () => moverPasso(i, -1)) : null,
        i < total - 1 ? botaoAcao("descer", `Descer passo ${n}`, () => moverPasso(i, 1)) : null,
        total > 1 ? botaoAcao("remover", `Remover passo ${n}`, () => removerPasso(i)) : null,
      ),
    );
  });

  el("lista-passos-form").replaceChildren(...linhas);
  el("lista-passos-form").querySelectorAll("textarea").forEach(ajustarAltura);

  if (focarIndice != null) {
    el(`passo-${focarIndice + 1}-texto`)?.focus();
  }
}

function moverPasso(i, direcao) {
  const destino = i + direcao;
  [passosForm[i], passosForm[destino]] = [passosForm[destino], passosForm[i]];
  renderizarPassosForm(destino);
}

function removerPasso(i) {
  passosForm.splice(i, 1);
  renderizarPassosForm(Math.min(i, passosForm.length - 1));
}

el("btn-add-passo").addEventListener("click", () => {
  passosForm.push(passoVazio());
  renderizarPassosForm(passosForm.length - 1);
});

function mostrarErroCampo(idCampo, idErro, mensagem) {
  const erro = el(idErro);
  erro.textContent = mensagem;
  erro.hidden = false;
  el(idCampo)?.setAttribute("aria-invalid", "true");
}

// O erro de um campo some assim que ele é editado.
function limparErro(idCampo, idErro) {
  el(idErro).hidden = true;
  if (idCampo) el(idCampo).removeAttribute("aria-invalid");
}
el("f-projeto").addEventListener("input", () => limparErro("f-projeto", "f-projeto-erro"));
el("f-nome").addEventListener("input", () => limparErro("f-nome", "f-nome-erro"));
el("lista-passos-form").addEventListener("input", () => limparErro(null, "f-passos-erro"));

function limparErrosItem() {
  for (const id of ["f-projeto-erro", "f-nome-erro", "f-passos-erro"]) el(id).hidden = true;
  for (const id of ["f-projeto", "f-nome"]) el(id).removeAttribute("aria-invalid");
}

// Lê e valida o formulário. Retorna os dados limpos ou null (e mostra os erros).
function lerFormItem() {
  limparErrosItem();

  const nomeProjeto = el("f-projeto").value.trim();
  const nome = el("f-nome").value.trim();
  const descricao = el("f-descricao").value.trim();

  // Etiquetas: separa por vírgula, tira espaços e repetidas.
  const etiquetas = [];
  for (const t of el("f-etiquetas").value.split(",")) {
    const etiqueta = t.trim();
    if (etiqueta && !etiquetas.some((e) => normalizar(e) === normalizar(etiqueta))) etiquetas.push(etiqueta);
  }

  // Passos totalmente vazios são ignorados. O comando não leva trim no meio,
  // só no começo e no fim, para manter quebras de linha e indentação.
  const passos = passosForm
    .map((p) => ({ texto: p.texto.trim(), comando: p.comando.trim(), aviso: p.aviso }))
    .filter((p) => p.texto || p.comando);

  let primeiroErro = null;
  if (!nomeProjeto) {
    mostrarErroCampo("f-projeto", "f-projeto-erro", "Escolha ou digite um projeto.");
    primeiroErro ??= "f-projeto";
  }
  if (!nome) {
    mostrarErroCampo("f-nome", "f-nome-erro", "Dê um nome ao item.");
    primeiroErro ??= "f-nome";
  }
  if (passos.length === 0) {
    mostrarErroCampo(null, "f-passos-erro", "Preencha o texto ou o comando de pelo menos um passo.");
    primeiroErro ??= "passo-1-texto";
  }

  if (primeiroErro) {
    el(primeiroErro)?.focus();
    return null;
  }

  return { nomeProjeto, nome, descricao, etiquetas, passos };
}

el("form-item").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = lerFormItem();
  if (!dados) return;

  const botao = el("btn-salvar-item");
  botao.disabled = true;
  botao.textContent = "Salvando…";

  try {
    let projeto = projetoPorNome(dados.nomeProjeto);
    const projetoId = projeto ? projeto.id : await criarProjeto(estado.uid, dados.nomeProjeto);

    await criarItem(estado.uid, {
      projetoId,
      nome: dados.nome,
      descricao: dados.descricao,
      etiquetas: dados.etiquetas,
      passos: dados.passos,
    });

    dialogo.close();
    estado.projetoAtual = projetoId;
    renderizarTudo();
    mostrarToast("Comando salvo");
  } catch (erroFirestore) {
    console.error(erroFirestore);
    mostrarToast("Não foi possível salvar. Verifique a conexão e tente de novo.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar comando";
  }
});

// ---------- Login e dados ----------

el("btn-entrar").addEventListener("click", async () => {
  const botao = el("btn-entrar");
  const erro = el("erro-login");
  erro.hidden = true;
  botao.disabled = true;
  try {
    await entrar();
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

function pararObservadores() {
  pararDeObservar.forEach((parar) => parar());
  pararDeObservar = [];
}

function erroAoLer(erroFirestore) {
  console.error(erroFirestore);
  mostrarToast("Não foi possível carregar seus dados. Recarregue a página.", "erro");
}

function iniciarObservadores(uid) {
  pararObservadores();
  pararDeObservar = [
    observarProjetos(uid, (projetos) => {
      estado.projetos = ordenarPorNome(projetos);
      estado.projetosCarregados = true;
      renderizarTudo();
    }, erroAoLer),
    observarItens(uid, (itens) => {
      estado.itens = itens;
      estado.itensCarregados = true;
      renderizarTudo();
    }, erroAoLer),
  ];
}

el("btn-sair").addEventListener("click", () => {
  // Para de ouvir o Firestore antes de sair, para não dar erro de permissão.
  // Na etapa 6, sair também vai apagar a chave do cofre da memória.
  pararObservadores();
  sair();
});

aoMudarUsuario((usuario) => {
  if (usuario) {
    estado.uid = usuario.uid;
    estado.projetoAtual = TODOS;
    preencherUsuario(usuario);
    renderizarTudo();
    mostrarTela("app");
    iniciarObservadores(usuario.uid);
  } else {
    pararObservadores();
    if (dialogo.open) dialogo.close();
    Object.assign(estado, {
      uid: null,
      projetos: [],
      itens: [],
      projetosCarregados: false,
      itensCarregados: false,
      projetoAtual: TODOS,
    });
    mostrarTela("login");
  }
});
