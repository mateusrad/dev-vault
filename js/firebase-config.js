// Configuração do app web do Firebase (projeto dev-vault-ee7ab).
// Estes valores NÃO são segredo: identificam o projeto e sempre vão para o navegador.
// Quem protege os dados são as regras do Firestore (firestore.rules).
// O SDK é importado via CDN, sem npm.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyBoK1PQ-r9epHDMKtrD3Q8Y3vwP3c7IYNw",
  authDomain: "dev-vault-ee7ab.firebaseapp.com",
  projectId: "dev-vault-ee7ab",
  storageBucket: "dev-vault-ee7ab.firebasestorage.app",
  messagingSenderId: "372259901693",
  appId: "1:372259901693:web:6a71a97b536078c4b5ee94",
};

export const app = initializeApp(firebaseConfig);
