// Leitura e gravação no Firestore. Tudo fica em users/{uid}/...
import { app } from "./firebase-config.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  increment,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const db = getFirestore(app);

const colecaoProjetos = (uid) => collection(db, "users", uid, "projetos");
const colecaoItens = (uid) => collection(db, "users", uid, "itens");

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

// Soma 1 em vezesCopiado. O increment() é feito no servidor, então duas cópias
// seguidas (ou em duas abas) não se atropelam.
export function registrarCopia(uid, itemId) {
  return updateDoc(doc(colecaoItens(uid), itemId), { vezesCopiado: increment(1) });
}

// Por enquanto só itens do tipo "comando". As senhas chegam na etapa 6.
export async function criarItem(uid, { projetoId, nome, descricao, etiquetas, passos }) {
  const ref = doc(colecaoItens(uid));
  await setDoc(ref, {
    tipo: "comando",
    projetoId,
    nome,
    descricao,
    etiquetas,
    passos,
    origem: "app",
    vezesCopiado: 0,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}
