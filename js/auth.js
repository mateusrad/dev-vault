// Login e logout com Google (Firebase Authentication).
import { app } from "./firebase-config.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// UID da única conta com acesso (o mesmo que está em firestore.rules).
// Este aviso no app é só para a tela ficar clara: quem bloqueia de verdade são as regras.
export const UID_DONO = "Q98yL89JwhMqdI2je6FxbNEKYm02";

export const auth = getAuth(app);
auth.languageCode = "pt-BR";

const provedor = new GoogleAuthProvider();
// Sempre mostra a escolha de conta, útil quando há mais de uma conta Google no navegador.
provedor.setCustomParameters({ prompt: "select_account" });

export function entrar() {
  return signInWithPopup(auth, provedor);
}

export function sair() {
  return signOut(auth);
}

// Chama o callback com o usuário logado, ou null, sempre que o estado muda
// (inclusive ao abrir a página, quando o Firebase restaura o login anterior).
export function aoMudarUsuario(callback) {
  return onAuthStateChanged(auth, callback);
}

// Traduz os erros mais comuns do login. Retorna null quando não vale mostrar nada.
export function mensagemDeErro(erro) {
  switch (erro?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.";
    case "auth/network-request-failed":
      return "Sem conexão com a internet. Verifique e tente de novo.";
    case "auth/unauthorized-domain":
      return "Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).";
    default:
      return "Não foi possível entrar. Tente de novo.";
  }
}
