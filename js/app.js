// Interface: telas, sidebar de projetos, lista de itens e formulário de novo item.
import { entrar, sair, aoMudarUsuario, mensagemDeErro, UID_DONO } from "./auth.js";
import {
  observarProjetos,
  observarItens,
  criarProjeto,
  criarItem,
  atualizarItem,
  excluirItem,
  registrarCopia,
  lerCofre,
  criarCofre,
} from "./db.js";
import { estaDesbloqueado, bloquear, prepararCofre, desbloquear, cifrar, decifrar } from "./cripto.js";

// ---------- Estado ----------

const TODOS = "todos";

const estado = {
  uid: null,
  projetos: [],          // [{ id, nome, ... }] em ordem alfabética
  itens: [],             // [{ id, nome, passos, ... }]
  projetosCarregados: false,
  itensCarregados: false,
  projetoAtual: TODOS,   // id do projeto ou "todos"
  busca: "",             // texto da busca (vazio = sem busca)
  filtroTipo: "todos",   // "todos", "comando" ou "senha"
  selecionado: null,     // id do item selecionado pelas setas (Enter copia)
  visiveis: [],          // itens na tela, na ordem mostrada
};

// Botões "Copiar" que acabaram de ser usados ("itemId:indice"), para manter o
// ícone de check mesmo se a lista for redesenhada nesses 2 segundos.
const copiadosAgora = new Set();

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
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  abrir: '<path d="M14 4h6v6"></path><path d="M20 4l-9 9"></path><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>',
  lupa: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  olhoFechado: '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path>',
  cadeado: '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  lixeira: '<path d="M4 7h16"></path><path d="M10 11v6M14 11v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path>',
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

// Mais copiados primeiro; empate (ou nunca copiados) em ordem alfabética.
function ordenarPorUso(lista) {
  return [...lista].sort((a, b) =>
    (b.vezesCopiado || 0) - (a.vezesCopiado || 0)
    || a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
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
  // Escolher um projeto sai da busca.
  estado.busca = "";
  el("campo-busca").value = "";
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
  const buscando = estado.busca.trim() !== "";
  // A busca vale para todos os projetos, então ignora o projeto aberto.
  const projeto = buscando ? null : (projetoPorId(estado.projetoAtual) || null);
  const emTodos = !projeto;

  let tituloTexto;
  if (buscando) tituloTexto = `Resultados para “${estado.busca.trim()}”`;
  else tituloTexto = emTodos ? "Todos os projetos" : projeto.nome;

  let itens;
  if (buscando) itens = buscarItens(estado.busca);
  else if (emTodos) itens = estado.itens;
  else itens = estado.itens.filter((i) => i.projetoId === estado.projetoAtual);

  // Filtro por tipo (Todos, Comandos, Senhas), aplicado depois do projeto ou da busca.
  renderizarFiltroTipo(itens);
  const totalAntesDoFiltro = itens.length;
  if (estado.filtroTipo !== TODOS) itens = itens.filter((i) => tipoDo(i) === estado.filtroTipo);
  itens = ordenarPorUso(itens);

  // Seleção (setas e Enter). Na busca, o primeiro resultado já vem selecionado,
  // então digitar e apertar Enter copia o comando do melhor resultado.
  estado.visiveis = itens;
  if (!itens.some((i) => i.id === estado.selecionado)) {
    estado.selecionado = buscando && itens.length ? itens[0].id : null;
  }

  el("titulo-mobile").textContent = buscando ? "Busca" : tituloTexto;
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

  // Redesenhar a lista apaga o elemento com foco (ex.: o botão Copiar que acabou
  // de ser clicado). Guardamos qual era e devolvemos o foco depois.
  const foco = document.activeElement?.dataset?.foco;

  if (itens.length === 0) {
    let vazio;
    if (totalAntesDoFiltro > 0) vazio = semItensDoTipo();
    else if (buscando) vazio = semResultados();
    else vazio = estadoVazio(projeto);
    lista.replaceChildren(vazio);
  } else {
    lista.replaceChildren(...itens.map((item) => cardItem(item, emTodos)));
  }

  if (foco) lista.querySelector(`[data-foco="${CSS.escape(foco)}"]`)?.focus();
}

// ---------- Busca ----------

// Texto pesquisável de um item: nome, descrição, projeto, etiquetas e passos.
// (Nas senhas, da etapa 6, o valor e o usuário NÃO entram aqui.)
function textoDoItem(item) {
  const partes = [
    item.nome,
    item.descricao,
    projetoPorId(item.projetoId)?.nome,
    ...(item.etiquetas || []),
    ...(item.passos || []).flatMap((p) => [p.texto, p.comando]),
  ];
  return normalizar(partes.filter(Boolean).join(" \n "));
}

// Cada palavra digitada precisa aparecer no item, em qualquer ordem:
// "boxhop admin" acha "Acessar o admin do Django" do projeto BoxHop.
function buscarItens(busca) {
  const palavras = normalizar(busca).split(/\s+/).filter(Boolean);
  return estado.itens.filter((item) => {
    const texto = textoDoItem(item);
    return palavras.every((p) => texto.includes(p));
  });
}

function semResultados() {
  return h("div", { class: "estado-vazio" },
    h("div", { class: "estado-vazio-icone" }, icone("lupa", 36)),
    h("h2", {}, "Nada encontrado"),
    h("p", {}, "Tente outra palavra. A busca olha nome, descrição, projeto, etiquetas e o texto e o comando dos passos."),
    h("div", { class: "estado-vazio-acoes" },
      h("button", { type: "button", class: "btn btn-fantasma", onclick: limparBusca }, "Limpar busca"),
    ),
  );
}

// Clicar numa etiqueta busca por ela.
function buscarPor(texto) {
  estado.busca = texto;
  el("campo-busca").value = texto;
  renderizarLista();
  window.scrollTo({ top: 0 });
}

// ---------- Filtro por tipo ----------

const TIPOS = [
  { valor: TODOS, rotulo: "Todos" },
  { valor: "comando", rotulo: "Comandos" },
  { valor: "senha", rotulo: "Senhas" },
];

// Itens antigos sem o campo "tipo" contam como comando.
function tipoDo(item) {
  return item.tipo || "comando";
}

function renderizarFiltroTipo(itens) {
  const contagem = { [TODOS]: itens.length, comando: 0, senha: 0 };
  for (const item of itens) contagem[tipoDo(item)] = (contagem[tipoDo(item)] || 0) + 1;

  el("filtro-tipo").replaceChildren(...TIPOS.map(({ valor, rotulo }) =>
    h("button", {
      type: "button",
      class: "filtro-opcao",
      "aria-pressed": estado.filtroTipo === valor ? "true" : "false",
      "data-foco": `filtro:${valor}`,
      onclick: () => {
        estado.filtroTipo = valor;
        renderizarLista();
      },
    }, rotulo, h("span", { class: "filtro-contagem" }, contagem[valor])),
  ));
}

function semItensDoTipo() {
  const rotulo = estado.filtroTipo === "senha" ? "Nenhuma senha aqui" : "Nenhum comando aqui";
  return h("div", { class: "estado-vazio" },
    h("div", { class: "estado-vazio-icone" }, icone("pasta", 36)),
    h("h2", {}, rotulo),
    h("p", {}, estado.filtroTipo === "senha"
      ? "As senhas chegam numa próxima etapa, com criptografia pela senha mestra."
      : "Os itens desta lista são de outro tipo."),
    h("div", { class: "estado-vazio-acoes" },
      h("button", {
        type: "button",
        class: "btn btn-fantasma",
        onclick: () => { estado.filtroTipo = TODOS; renderizarLista(); },
      }, "Mostrar todos os tipos"),
    ),
  );
}

// ---------- Exclusão ----------

const dialogoExcluir = el("dlg-excluir");
let itemParaExcluir = null;

function pedirExclusao(item) {
  itemParaExcluir = item;
  el("excluir-nome").textContent = item.nome;
  dialogoExcluir.showModal();
  // O foco começa em "Cancelar": apertar Enter por engano não apaga nada.
  el("btn-cancelar-exclusao").focus();
}

el("btn-cancelar-exclusao").addEventListener("click", () => dialogoExcluir.close());

el("btn-confirmar-exclusao").addEventListener("click", async () => {
  const item = itemParaExcluir;
  if (!item) return;
  const botao = el("btn-confirmar-exclusao");
  botao.disabled = true;
  try {
    await excluirItem(estado.uid, item.id);
    dialogoExcluir.close();
    mostrarToast(`"${item.nome}" excluído`);
  } catch (erro) {
    console.error(erro);
    mostrarToast("Não foi possível excluir. Tente de novo.", "erro");
  } finally {
    botao.disabled = false;
  }
});

dialogoExcluir.addEventListener("close", () => {
  // Cancelou: o foco volta para o botão Excluir do item.
  // Excluiu: o botão não existe mais, então o foco vai para o título da lista
  // (e não para a busca, que no celular abriria o teclado).
  const botaoDoItem = itemParaExcluir
    && document.querySelector(`[data-foco="${CSS.escape(`excluir:${itemParaExcluir.id}`)}"]`);
  itemParaExcluir = null;
  (botaoDoItem || el("titulo-lista")).focus({ preventScroll: true });
});

function limparBusca() {
  estado.busca = "";
  el("campo-busca").value = "";
  renderizarLista();
  el("campo-busca").focus();
}

el("campo-busca").addEventListener("input", (e) => {
  estado.busca = e.target.value;
  // Busca nova: a seleção volta para o primeiro resultado.
  estado.selecionado = null;
  renderizarLista();
});

// ---------- Seleção com setas e Enter ----------

function selecionarItem(id, rolar = true) {
  if (estado.selecionado === id) return;
  estado.selecionado = id;
  renderizarLista();
  if (rolar && id) {
    document.querySelector(`[data-item-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
  }
}

function moverSelecao(direcao) {
  const lista = estado.visiveis;
  if (lista.length === 0) return;
  const atual = lista.findIndex((i) => i.id === estado.selecionado);
  let proximo;
  if (atual === -1) proximo = direcao > 0 ? 0 : lista.length - 1;
  else proximo = Math.min(Math.max(atual + direcao, 0), lista.length - 1);
  selecionarItem(lista[proximo].id);
}

function copiarSelecionado() {
  const item = estado.visiveis.find((i) => i.id === estado.selecionado);
  if (!item) return false;
  if (tipoDo(item) === "senha") {
    copiarSenha(item);
    return true;
  }
  const indice = (item.passos || []).findIndex((p) => p.comando);
  if (indice === -1) {
    mostrarToast("Este item não tem comando para copiar.", "erro");
    return true;
  }
  copiar(item, indice, item.passos[indice].comando);
  return true;
}

document.addEventListener("keydown", (e) => {
  if (telas.app.hidden || document.querySelector("dialog[open]")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const naBusca = e.target === el("campo-busca");
  // Fora da busca, só age quando o foco não está num campo, botão ou link,
  // para não roubar as setas e o Enter de quem está usando esses elementos.
  const emElementoInterativo = e.target.closest("input, textarea, select, button, a, [contenteditable]");
  if (!naBusca && emElementoInterativo) return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    moverSelecao(e.key === "ArrowDown" ? 1 : -1);
  } else if (e.key === "Enter") {
    if (copiarSelecionado()) e.preventDefault();
  }
});

el("campo-busca").addEventListener("keydown", (e) => {
  if (e.key === "Escape" && estado.busca) {
    e.stopPropagation();
    limparBusca();
  }
});

// "/" ou Ctrl+K (Cmd+K no Mac) levam para a busca de qualquer lugar.
document.addEventListener("keydown", (e) => {
  if (telas.app.hidden || document.querySelector("dialog[open]")) return;
  const digitando = e.target.closest("input, textarea, [contenteditable]");
  const atalhoK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
  if (atalhoK || (e.key === "/" && !digitando)) {
    e.preventDefault();
    fecharMenu();
    el("campo-busca").focus();
    el("campo-busca").select();
  }
});

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
    ...(item.etiquetas || []).map((t) => h("button", {
      type: "button",
      class: "etiqueta",
      title: `Buscar "${t}"`,
      "data-foco": `etiqueta:${item.id}:${t}`,
      onclick: () => buscarPor(t),
    }, t)),
    item.vezesCopiado > 0
      ? h("span", { class: "contagem-copias" }, `copiado ${item.vezesCopiado}×`)
      : null,
  ].filter(Boolean);

  const selecionado = estado.selecionado === item.id;
  const temComando = tipoDo(item) === "senha" || (item.passos || []).some((p) => p.comando);

  return h("article", {
    class: `card${selecionado ? " e-selecionado" : ""}`,
    "data-item-id": item.id,
    // Clicar no card (fora dos botões e sem selecionar texto) também seleciona.
    onclick: (e) => {
      if (e.target.closest("button, a") || String(window.getSelection())) return;
      selecionarItem(item.id, false);
    },
  },
    h("div", { class: "card-info" },
      h("div", { class: "card-titulo" },
        h("h2", { class: "card-nome" }, item.nome),
        tipoDo(item) === "senha"
          ? h("span", { class: "selo selo-senha" }, icone("cadeado", 12), "Senha")
          : null,
        item.origem === "claude-code"
          ? h("span", { class: "selo" }, icone("terminal", 12), "via Claude Code")
          : null,
        selecionado && temComando
          ? h("span", { class: "selo-enter", title: "Enter copia o primeiro comando" },
            h("span", { "aria-hidden": "true" }, "Enter ↵"),
            h("span", { class: "sr-only" }, "Selecionado. Enter copia o primeiro comando."))
          : null,
      ),
      item.descricao ? h("p", { class: "card-descricao" }, item.descricao) : null,
      h("div", { class: "card-marcadores" },
        ...marcadores,
        h("span", { class: "espacador" }),
        h("button", {
          type: "button",
          class: "btn-icone btn-icone-pequeno",
          "aria-label": `Editar "${item.nome}"`,
          title: "Editar",
          "data-foco": `editar:${item.id}`,
          onclick: () => editarItem(item),
        }, icone("editar")),
        h("button", {
          type: "button",
          class: "btn-icone btn-icone-pequeno btn-perigo",
          "aria-label": `Excluir "${item.nome}"`,
          title: "Excluir",
          "data-foco": `excluir:${item.id}`,
          onclick: () => pedirExclusao(item),
        }, icone("lixeira")),
      ),
    ),
    tipoDo(item) === "senha"
      ? conteudoSenha(item)
      : h("ol", { class: "card-passos" },
        ...passos.map((passo, i) => passoNoCard(item, passo, i, numerar ? i + 1 : null)),
      ),
  );
}

// Lado direito do card de senha: usuário (aberto) e valor (mascarado até mostrar).
function conteudoSenha(item) {
  const revelada = reveladas.get(item.id);
  const chaveCopia = `${item.id}:senha`;
  const copiado = copiadosAgora.has(chaveCopia);

  const linhaUsuario = item.usuario
    ? h("div", { class: "linha-senha" },
      h("span", { class: "linha-senha-rotulo" }, "Usuário"),
      h("div", { class: "bloco-codigo" },
        h("pre", {}, h("code", {}, item.usuario)),
        h("div", { class: "bloco-acoes" },
          botaoCopiar(`${item.id}:usuario`, "Copiar usuário", () => copiar(item, "usuario", item.usuario, false)),
        ),
      ),
    )
    : null;

  const linhaValor = h("div", { class: "linha-senha" },
    h("span", { class: "linha-senha-rotulo" }, "Senha"),
    h("div", { class: "bloco-codigo" },
      revelada !== undefined
        ? h("pre", {}, h("code", {}, revelada))
        : h("pre", { class: "senha-mascarada", "aria-label": "Senha oculta" }, "••••••••••••"),
      h("div", { class: "bloco-acoes" },
        h("button", {
          type: "button",
          class: "btn-icone",
          "aria-label": revelada !== undefined ? "Ocultar senha" : "Mostrar senha",
          "aria-pressed": revelada !== undefined ? "true" : "false",
          title: revelada !== undefined ? "Ocultar" : "Mostrar",
          "data-foco": `mostrar:${item.id}`,
          onclick: () => alternarSenha(item),
        }, icone(revelada !== undefined ? "olhoFechado" : "olho", 18)),
        h("button", {
          type: "button",
          class: `btn-icone btn-copiar${copiado ? " e-copiado" : ""}`,
          "aria-label": copiado ? "Copiado" : "Copiar senha",
          title: "Copiar",
          "data-foco": `copiar:${chaveCopia}`,
          onclick: () => copiarSenha(item),
        }, icone(copiado ? "check" : "copiar", 18)),
      ),
    ),
  );

  return h("div", { class: "card-senha" }, linhaUsuario, linhaValor);
}

function botaoCopiar(chave, rotulo, acao) {
  const copiado = copiadosAgora.has(chave);
  return h("button", {
    type: "button",
    class: `btn-icone btn-copiar${copiado ? " e-copiado" : ""}`,
    "aria-label": copiado ? "Copiado" : rotulo,
    title: "Copiar",
    "data-foco": `copiar:${chave}`,
    onclick: acao,
  }, icone(copiado ? "check" : "copiar", 18));
}

// Só http e https viram link. Assim um "javascript:..." salvo como comando nunca é aberto.
function ehLink(texto) {
  return /^https?:\/\/\S+$/i.test(texto);
}

function blocoComando(item, indice, comando) {
  const chave = `${item.id}:${indice}`;
  const copiado = copiadosAgora.has(chave);
  const link = ehLink(comando);

  return h("div", { class: "bloco-codigo" },
    h("pre", {}, h("code", {}, comando)),
    h("div", { class: "bloco-acoes" },
      link
        ? h("a", {
          class: "btn-icone",
          href: comando,
          target: "_blank",
          rel: "noopener noreferrer",
          "aria-label": "Abrir link em nova aba",
          title: "Abrir",
          "data-foco": `abrir:${chave}`,
        }, icone("abrir", 18))
        : null,
      h("button", {
        type: "button",
        class: `btn-icone btn-copiar${copiado ? " e-copiado" : ""}`,
        "aria-label": copiado ? "Copiado" : (link ? "Copiar link" : "Copiar comando"),
        title: "Copiar",
        "data-foco": `copiar:${chave}`,
        onclick: () => copiar(item, indice, comando),
      }, icone(copiado ? "check" : "copiar", 18)),
    ),
  );
}

// parte: índice do passo, "usuario" ou "senha". contar: soma em vezesCopiado.
async function copiar(item, parte, texto, contar = true) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (erro) {
    console.error(erro);
    mostrarToast("Não foi possível copiar. Clique de novo no botão Copiar.", "erro");
    return;
  }

  const chave = `${item.id}:${parte}`;
  copiadosAgora.add(chave);
  renderizarLista();
  mostrarToast("Copiado!");
  setTimeout(() => {
    copiadosAgora.delete(chave);
    renderizarLista();
  }, 2000);

  // A contagem não é essencial: se falhar (ex.: sem internet), só registra no console.
  if (contar) {
    registrarCopia(estado.uid, item.id).catch((erro) => console.error("Erro ao contar cópia:", erro));
  }
}

function passoNoCard(item, passo, indice, numero) {
  let texto = null;
  if (passo.texto && passo.aviso) {
    texto = h("div", { class: "passo-aviso", role: "note" },
      icone("aviso"),
      h("p", {}, h("strong", {}, "Atenção: "), passo.texto),
    );
  } else if (passo.texto) {
    texto = h("p", { class: "passo-texto" }, passo.texto);
  }

  const comando = passo.comando ? blocoComando(item, indice, passo.comando) : null;

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

// id do item em edição, ou null quando o formulário é de item novo.
let itemEditando = null;
// Tipo escolhido no formulário: "comando" ou "senha".
let tipoForm = "comando";

function textoBotaoSalvar() {
  if (itemEditando !== null) return "Salvar alterações";
  return tipoForm === "senha" ? "Salvar senha" : "Salvar comando";
}

function definirTipoForm(tipo) {
  tipoForm = tipo;
  const senha = tipo === "senha";
  el("f-tipo").querySelectorAll("[data-tipo]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.tipo === tipo ? "true" : "false");
  });
  el("campos-senha").hidden = !senha;
  el("campo-passos").hidden = senha;
  el("ajuda-comando").hidden = senha;
  const editando = itemEditando !== null;
  el("titulo-dlg-item").textContent = `${editando ? "Editar" : "Nova"} ${senha ? "senha" : "comando"}`
    .replace("Nova comando", "Novo comando");
  el("btn-salvar-item").textContent = textoBotaoSalvar();
  limparErrosItem();
}

// Escolher "Senha" exige o cofre desbloqueado (ou criar a senha mestra no primeiro uso).
el("f-tipo").addEventListener("click", async (e) => {
  const botao = e.target.closest("[data-tipo]");
  if (!botao || botao.disabled || botao.dataset.tipo === tipoForm) return;
  if (botao.dataset.tipo === "senha" && !(await garantirDesbloqueio())) return;
  definirTipoForm(botao.dataset.tipo);
  el(botao.dataset.tipo === "senha" ? "f-valor" : "passo-1-texto")?.focus();
});

// Mostrar/ocultar o valor da senha no formulário.
el("btn-mostrar-valor").addEventListener("click", () => {
  const campo = el("f-valor");
  const mostrar = campo.type === "password";
  campo.type = mostrar ? "text" : "password";
  el("btn-mostrar-valor").setAttribute("aria-pressed", mostrar ? "true" : "false");
  el("btn-mostrar-valor").setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
});

// Sem argumento: item novo. Com um item: edição, com os campos já preenchidos.
// valorSenha: o valor já decifrado, quando é a edição de uma senha.
function abrirFormItem(item = null, { tipo = "comando", valorSenha = "" } = {}) {
  fecharMenu();
  el("form-item").reset();
  el("f-valor").type = "password";
  el("btn-mostrar-valor").setAttribute("aria-pressed", "false");
  itemEditando = item ? item.id : null;
  const tipoInicial = item ? tipoDo(item) : tipo;

  // Na edição não dá para trocar o tipo do item.
  el("f-tipo").querySelectorAll("[data-tipo]").forEach((b) => { b.disabled = Boolean(item); });

  let projeto;
  if (item) {
    projeto = projetoPorId(item.projetoId);
    el("f-nome").value = item.nome || "";
    el("f-descricao").value = item.descricao || "";
    el("f-etiquetas").value = (item.etiquetas || []).join(", ");
    el("f-usuario").value = item.usuario || "";
    el("f-valor").value = valorSenha;
    // Cópia dos passos: editar no formulário não mexe no item até salvar.
    passosForm = (item.passos || []).map((p) => ({
      texto: p.texto || "",
      comando: p.comando || "",
      aviso: Boolean(p.aviso),
    }));
    if (passosForm.length === 0) passosForm = [passoVazio()];
  } else {
    // Já vem com o projeto aberto (ou o único projeto, se só houver um).
    projeto = projetoPorId(estado.projetoAtual)
      || (estado.projetos.length === 1 ? estado.projetos[0] : null);
    passosForm = [passoVazio()];
  }
  el("f-projeto").value = projeto ? projeto.nome : "";
  renderizarPassosForm();
  definirTipoForm(tipoInicial);

  dialogo.showModal();
  (projeto ? el("f-nome") : el("f-projeto")).focus();
}

// Novo item: com o filtro "Senhas" ativo, já começa como senha (pede o desbloqueio antes).
async function novoItem() {
  if (estado.filtroTipo === "senha") {
    if (!(await garantirDesbloqueio())) return;
    abrirFormItem(null, { tipo: "senha" });
  } else {
    abrirFormItem();
  }
}

// Editar: uma senha precisa ser decifrada antes de abrir o formulário.
async function editarItem(item) {
  if (tipoDo(item) !== "senha") {
    abrirFormItem(item);
    return;
  }
  if (!(await garantirDesbloqueio())) return;
  try {
    const valor = await decifrar(item.cifra, item.iv);
    abrirFormItem(item, { valorSenha: valor });
  } catch (erro) {
    console.error(erro);
    mostrarToast("Não foi possível abrir esta senha para edição.", "erro");
  }
}

dialogo.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => dialogo.close()));
// Ao fechar, apaga a senha digitada do campo (não fica no HTML da página).
dialogo.addEventListener("close", () => { el("f-valor").value = ""; });
el("btn-novo-item").addEventListener("click", novoItem);
el("btn-novo-item-mobile").addEventListener("click", novoItem);

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

el("f-valor").addEventListener("input", () => limparErro("f-valor", "f-valor-erro"));

function limparErrosItem() {
  for (const id of ["f-projeto-erro", "f-nome-erro", "f-passos-erro", "f-valor-erro"]) el(id).hidden = true;
  for (const id of ["f-projeto", "f-nome", "f-valor"]) el(id).removeAttribute("aria-invalid");
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
  // A senha não leva trim: espaços no começo ou no fim podem fazer parte dela.
  const usuario = el("f-usuario").value.trim();
  const valor = el("f-valor").value;

  if (tipoForm === "comando" && passos.length === 0) {
    mostrarErroCampo(null, "f-passos-erro", "Preencha o texto ou o comando de pelo menos um passo.");
    primeiroErro ??= "passo-1-texto";
  }
  if (tipoForm === "senha" && !valor) {
    mostrarErroCampo("f-valor", "f-valor-erro", "Digite a senha.");
    primeiroErro ??= "f-valor";
  }

  if (primeiroErro) {
    el(primeiroErro)?.focus();
    return null;
  }

  return { nomeProjeto, nome, descricao, etiquetas, passos, usuario, valor };
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

    const campos = {
      projetoId,
      nome: dados.nome,
      descricao: dados.descricao,
      etiquetas: dados.etiquetas,
    };
    if (tipoForm === "senha") {
      // Cifra no navegador, com IV novo a cada gravação. O valor em texto puro nunca sai daqui.
      if (!estaDesbloqueado()) throw new Error("Cofre bloqueado.");
      const { cifra, iv } = await cifrar(dados.valor);
      Object.assign(campos, { usuario: dados.usuario, cifra, iv });
    } else {
      campos.passos = dados.passos;
    }

    const editando = itemEditando !== null;
    if (editando) {
      await atualizarItem(estado.uid, itemEditando, tipoForm, campos);
      reveladas.delete(itemEditando);
    } else {
      await criarItem(estado.uid, tipoForm, campos);
    }

    dialogo.close();
    // Ao editar, fica onde estava (inclusive na busca). Item novo leva ao projeto dele.
    if (editando) renderizarTudo();
    else selecionarProjeto(projetoId);
    let mensagem = tipoForm === "senha" ? "Senha salva" : "Comando salvo";
    if (editando) mensagem = "Alterações salvas";
    mostrarToast(mensagem);
  } catch (erroFirestore) {
    console.error(erroFirestore);
    mostrarToast("Não foi possível salvar. Verifique a conexão e tente de novo.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = textoBotaoSalvar();
  }
});

// ---------- Cofre: senha mestra, desbloqueio e senhas ----------

// Configuração do cofre lida do Firestore: undefined = ainda não lida; null = não existe.
let configCofre;
// Senhas decifradas na tela agora (itemId -> texto). Somem ao ocultar, bloquear ou sair.
const reveladas = new Map();
const TEMPO_REVELADA_MS = 30000;
// Quem pediu o desbloqueio espera esta promessa (true = liberado, false = cancelou).
let respostaCofre = null;

const dialogoDesbloquear = el("dlg-desbloquear");
const dialogoCriarMestra = el("dlg-criar-mestra");

async function obterConfigCofre() {
  if (configCofre === undefined) configCofre = await lerCofre(estado.uid);
  return configCofre;
}

// Garante o cofre desbloqueado. Se precisar, abre o diálogo de desbloquear
// ou, no primeiro uso, o de criar a senha mestra.
async function garantirDesbloqueio() {
  if (estaDesbloqueado()) return true;
  // Já há um diálogo de desbloqueio aberto (ex.: clique duplo): não abre outro.
  if (respostaCofre) return false;
  let config;
  try {
    config = await obterConfigCofre();
  } catch (erro) {
    console.error(erro);
    mostrarToast("Não foi possível ler o cofre. Verifique a conexão.", "erro");
    return false;
  }
  return new Promise((resolve) => {
    respostaCofre = resolve;
    if (config) abrirDesbloquear();
    else abrirCriarMestra();
  });
}

function responderPedidoCofre() {
  const resolver = respostaCofre;
  respostaCofre = null;
  resolver?.(estaDesbloqueado());
}

function atualizarIndicadorCofre() {
  el("btn-bloquear").hidden = !estaDesbloqueado();
}

function bloquearCofre({ avisar = true } = {}) {
  bloquear();
  reveladas.clear();
  atualizarIndicadorCofre();
  renderizarLista();
  if (avisar) mostrarToast("Senhas bloqueadas");
}

el("btn-bloquear").addEventListener("click", () => bloquearCofre());

// Desbloquear

function abrirDesbloquear() {
  el("form-desbloquear").reset();
  el("d-erro").hidden = true;
  el("d-senha").removeAttribute("aria-invalid");
  dialogoDesbloquear.showModal();
  el("d-senha").focus();
}

el("form-desbloquear").addEventListener("submit", async (e) => {
  e.preventDefault();
  const campo = el("d-senha");
  const erro = el("d-erro");
  if (!campo.value) {
    erro.textContent = "Digite a senha mestra.";
    erro.hidden = false;
    campo.focus();
    return;
  }

  const botao = el("btn-desbloquear");
  botao.disabled = true;
  botao.textContent = "Desbloqueando…";
  try {
    const certa = await desbloquear(campo.value, configCofre);
    if (certa) {
      campo.value = "";
      atualizarIndicadorCofre();
      dialogoDesbloquear.close();
      renderizarLista();
    } else {
      erro.textContent = "Senha mestra incorreta.";
      erro.hidden = false;
      campo.setAttribute("aria-invalid", "true");
      campo.select();
    }
  } catch (erroCripto) {
    console.error(erroCripto);
    erro.textContent = "Não foi possível desbloquear. Recarregue a página e tente de novo.";
    erro.hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = "Desbloquear";
  }
});

// Criar a senha mestra (primeiro uso)

const MINIMO_SENHA_MESTRA = 12;

// Estimativa simples: tamanho e variedade de caracteres. Só orienta, não bloqueia.
function forcaDaSenha(senha) {
  if (!senha) return { nivel: 0, texto: "" };
  let pontos = 0;
  if (senha.length >= MINIMO_SENHA_MESTRA) pontos++;
  if (senha.length >= 16) pontos++;
  if (senha.length >= 20) pontos++;
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(senha)).length;
  if (tipos >= 3) pontos++;
  if (senha.length < MINIMO_SENHA_MESTRA) return { nivel: 1, texto: `Curta demais: faltam ${MINIMO_SENHA_MESTRA - senha.length} caracteres.` };
  return [
    null,
    { nivel: 1, texto: "Fraca. Use uma frase mais longa." },
    { nivel: 2, texto: "Razoável. Uma frase mais longa fica melhor." },
    { nivel: 3, texto: "Boa." },
    { nivel: 4, texto: "Forte." },
  ][Math.max(1, pontos)];
}

function abrirCriarMestra() {
  el("form-criar-mestra").reset();
  for (const id of ["m-nova-erro", "m-confirma-erro", "m-entendi-erro"]) el(id).hidden = true;
  el("m-forca-barra").dataset.nivel = "0";
  el("m-forca").textContent = "Use uma frase longa, fácil de lembrar e que você não use em outro lugar.";
  dialogoCriarMestra.showModal();
  el("m-nova").focus();
}

el("m-nova").addEventListener("input", (e) => {
  const { nivel, texto } = forcaDaSenha(e.target.value);
  el("m-forca-barra").dataset.nivel = String(nivel);
  el("m-forca").textContent = texto || "Use uma frase longa, fácil de lembrar e que você não use em outro lugar.";
  el("m-nova-erro").hidden = true;
});
el("m-confirma").addEventListener("input", () => { el("m-confirma-erro").hidden = true; });
el("m-entendi").addEventListener("change", () => { el("m-entendi-erro").hidden = true; });

el("form-criar-mestra").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senha = el("m-nova").value;
  const confirma = el("m-confirma").value;

  let primeiroErro = null;
  const erroEm = (idErro, mensagem, idCampo) => {
    el(idErro).textContent = mensagem;
    el(idErro).hidden = false;
    primeiroErro ??= idCampo;
  };
  if (senha.length < MINIMO_SENHA_MESTRA) erroEm("m-nova-erro", `Use pelo menos ${MINIMO_SENHA_MESTRA} caracteres.`, "m-nova");
  else if (confirma !== senha) erroEm("m-confirma-erro", "As duas senhas não são iguais.", "m-confirma");
  if (!el("m-entendi").checked) erroEm("m-entendi-erro", "Marque para confirmar que entendeu.", "m-entendi");
  if (primeiroErro) {
    el(primeiroErro).focus();
    return;
  }

  const botao = el("btn-criar-mestra");
  botao.disabled = true;
  botao.textContent = "Criando…";
  try {
    const config = await prepararCofre(senha);
    await criarCofre(estado.uid, config);
    configCofre = config;
    el("form-criar-mestra").reset();
    atualizarIndicadorCofre();
    dialogoCriarMestra.close();
    mostrarToast("Senha mestra criada");
  } catch (erro) {
    // Se não gravou, não deixa a chave na memória: a senha mestra não existe no banco.
    bloquear();
    console.error(erro);
    configCofre = undefined;
    erroEm("m-nova-erro", "Não foi possível criar o cofre. Verifique a conexão e tente de novo.", "m-nova");
  } finally {
    botao.disabled = false;
    botao.textContent = "Criar e desbloquear";
  }
});

// Os dois diálogos respondem a quem pediu o desbloqueio ao fechar (inclusive com Esc ou Cancelar).
for (const d of [dialogoDesbloquear, dialogoCriarMestra]) {
  d.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => d.close()));
  d.addEventListener("close", () => {
    // Não deixa a senha mestra digitada nos campos.
    d.querySelector("form").reset();
    responderPedidoCofre();
  });
}

// Mostrar, ocultar e copiar senhas

async function alternarSenha(item) {
  if (reveladas.has(item.id)) {
    reveladas.delete(item.id);
    renderizarLista();
    return;
  }
  if (!(await garantirDesbloqueio())) return;
  try {
    const texto = await decifrar(item.cifra, item.iv);
    reveladas.set(item.id, texto);
    renderizarLista();
    // Esconde sozinha depois de um tempo.
    setTimeout(() => {
      if (reveladas.get(item.id) === texto) {
        reveladas.delete(item.id);
        renderizarLista();
      }
    }, TEMPO_REVELADA_MS);
  } catch (erro) {
    console.error(erro);
    mostrarToast("Não foi possível decifrar esta senha.", "erro");
  }
}

async function copiarSenha(item) {
  if (!(await garantirDesbloqueio())) return;
  let texto;
  try {
    texto = await decifrar(item.cifra, item.iv);
  } catch (erro) {
    console.error(erro);
    mostrarToast("Não foi possível decifrar esta senha.", "erro");
    return;
  }
  copiar(item, "senha", texto);
}

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
  pararObservadores();
  bloquearCofre({ avisar: false });
  sair();
});

aoMudarUsuario((usuario) => {
  // Conta sem acesso: desconecta e explica na tela de login.
  if (usuario && usuario.uid !== UID_DONO) {
    const erro = el("erro-login");
    erro.textContent = `A conta ${usuario.email || "escolhida"} não tem acesso a este cofre.`;
    erro.hidden = false;
    sair();
    return;
  }

  if (usuario) {
    estado.uid = usuario.uid;
    estado.projetoAtual = TODOS;
    preencherUsuario(usuario);
    renderizarTudo();
    mostrarTela("app");
    iniciarObservadores(usuario.uid);
  } else {
    pararObservadores();
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    // Apaga a chave da memória e esquece a configuração do cofre.
    bloquear();
    reveladas.clear();
    configCofre = undefined;
    atualizarIndicadorCofre();
    Object.assign(estado, {
      uid: null,
      projetos: [],
      itens: [],
      projetosCarregados: false,
      itensCarregados: false,
      projetoAtual: TODOS,
      busca: "",
      filtroTipo: TODOS,
      selecionado: null,
      visiveis: [],
    });
    el("campo-busca").value = "";
    mostrarTela("login");
  }
});
