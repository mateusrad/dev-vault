// Leitura e gravação no Firestore. Tudo fica em users/{uid}/...
import { app } from "./firebase-config.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const db = getFirestore(app);

const colecaoProjetos = (uid) => collection(db, "users", uid, "projetos");
const colecaoItens = (uid) => collection(db, "users", uid, "itens");
const docCofre = (uid) => doc(db, "users", uid, "cofre", "config");

function paraLista(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Observa a coleção em tempo real: chama aoMudar com a lista completa a cada mudança.
// Retorna a função que para de observar.
export function observarProjetos(uid, aoMudar, aoErrar) {
  return onSnapshot(colecaoProjetos(uid), (s) => aoMudar(paraLista(s)), aoErrar);
}

export function observarItens(uid, aoMudar, aoErrar) {
  return onSnapshot(colecaoItens(uid), (s) => aoMudar(paraLista(s)), aoErrar);
}

// O id é gerado no navegador (doc sem caminho), então ele já existe antes da gravação terminar.
export async function criarProjeto(uid, nome) {
  const ref = doc(colecaoProjetos(uid));
  await setDoc(ref, { nome, criadoEm: serverTimestamp() });
  return ref.id;
}

// Campos gravados de cada tipo de item.
// - comando: passos
// - senha: usuario (aberto), cifra e iv (valor criptografado no navegador)
function camposDoItem(tipo, campos) {
  const base = {
    projetoId: campos.projetoId,
    nome: campos.nome,
    descricao: campos.descricao,
    etiquetas: campos.etiquetas,
  };
  if (tipo === "senha") {
    return { ...base, usuario: campos.usuario, cifra: campos.cifra, iv: campos.iv };
  }
  return { ...base, passos: campos.passos };
}

export async function criarItem(uid, tipo, campos) {
  const ref = doc(colecaoItens(uid));
  await setDoc(ref, {
    tipo,
    ...camposDoItem(tipo, campos),
    origem: "app",
    vezesCopiado: 0,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

// Atualiza só os campos editáveis. tipo, origem, vezesCopiado e criadoEm ficam como estão.
export function atualizarItem(uid, itemId, tipo, campos) {
  return updateDoc(doc(colecaoItens(uid), itemId), {
    ...camposDoItem(tipo, campos),
    atualizadoEm: serverTimestamp(),
  });
}

export function excluirItem(uid, itemId) {
  return deleteDoc(doc(colecaoItens(uid), itemId));
}

// Soma 1 em vezesCopiado. O increment() é feito no servidor, então duas cópias
// seguidas (ou em duas abas) não se atropelam.
export function registrarCopia(uid, itemId) {
  return updateDoc(doc(colecaoItens(uid), itemId), { vezesCopiado: increment(1) });
}

// ---------- Cofre (configuração da senha mestra) ----------

// Retorna { salt, iteracoes, verificador, verificadorIv } ou null se ainda não existe.
export async function lerCofre(uid) {
  const snap = await getDoc(docCofre(uid));
  return snap.exists() ? snap.data() : null;
}

// Grava a configuração do cofre. As regras só permitem CRIAR esse documento,
// nunca sobrescrever: trocar o salt deixaria todas as senhas ilegíveis.
export function criarCofre(uid, config) {
  return setDoc(docCofre(uid), { ...config, criadoEm: serverTimestamp() });
}
