// Senha mestra e criptografia das senhas (Web Crypto API, nativa do navegador).
//
// - A senha mestra passa pelo PBKDF2-SHA256 (600.000 iterações, salt aleatório)
//   e vira uma chave AES-GCM de 256 bits, marcada como NÃO exportável.
// - A chave fica só na memória desta aba (variável `chave` abaixo). Nunca vai
//   para o Firestore, localStorage ou qualquer outro lugar. Recarregar a página,
//   sair da conta ou clicar em "Bloquear" apaga a chave.
// - Cada gravação usa um IV (vetor de inicialização) aleatório de 12 bytes.
// - O "verificador" é um texto fixo cifrado: se ele decifra, a senha mestra está certa.

const ITERACOES = 600000;          // recomendação atual da OWASP para PBKDF2-SHA256
const MINIMO_ITERACOES = 100000;   // recusa configurações enfraquecidas
const TEXTO_VERIFICADOR = "dev-vault:verificador:v1";

let chave = null;

// ---------- Conversões ----------

function paraBase64(bytes) {
  let binario = "";
  for (const b of new Uint8Array(bytes)) binario += String.fromCharCode(b);
  return btoa(binario);
}

function deBase64(texto) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function bytesAleatorios(tamanho) {
  return crypto.getRandomValues(new Uint8Array(tamanho));
}

// ---------- Chave ----------

async function derivarChave(senhaMestra, salt, iteracoes) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(senhaMestra),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iteracoes },
    material,
    { name: "AES-GCM", length: 256 },
    false, // não exportável: nem o próprio app consegue ler os bytes da chave
    ["encrypt", "decrypt"],
  );
}

async function cifrarCom(chaveUsada, texto) {
  const iv = bytesAleatorios(12);
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chaveUsada,
    new TextEncoder().encode(texto),
  );
  return { cifra: paraBase64(cifrado), iv: paraBase64(iv) };
}

async function decifrarCom(chaveUsada, cifra, iv) {
  const decifrado = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deBase64(iv) },
    chaveUsada,
    deBase64(cifra),
  );
  return new TextDecoder().decode(decifrado);
}

// ---------- API usada pelo app ----------

export function estaDesbloqueado() {
  return chave !== null;
}

export function bloquear() {
  chave = null;
}

// Primeiro uso: gera o salt, deriva a chave e cifra o verificador.
// Retorna o documento a gravar em users/{uid}/cofre/config. Já deixa o cofre desbloqueado.
export async function prepararCofre(senhaMestra) {
  const salt = bytesAleatorios(16);
  const novaChave = await derivarChave(senhaMestra, salt, ITERACOES);
  const verificador = await cifrarCom(novaChave, TEXTO_VERIFICADOR);
  chave = novaChave;
  return {
    salt: paraBase64(salt),
    iteracoes: ITERACOES,
    verificador: verificador.cifra,
    verificadorIv: verificador.iv,
  };
}

// Tenta desbloquear com a senha digitada. Retorna true se a senha estiver certa.
export async function desbloquear(senhaMestra, config) {
  if (!config || !(config.iteracoes >= MINIMO_ITERACOES)) {
    throw new Error("Configuração do cofre inválida.");
  }
  const tentativa = await derivarChave(senhaMestra, deBase64(config.salt), config.iteracoes);
  try {
    const texto = await decifrarCom(tentativa, config.verificador, config.verificadorIv);
    if (texto !== TEXTO_VERIFICADOR) return false;
  } catch {
    // AES-GCM recusa decifrar com a chave errada (OperationError).
    return false;
  }
  chave = tentativa;
  return true;
}

export async function cifrar(texto) {
  if (!chave) throw new Error("Cofre bloqueado.");
  return cifrarCom(chave, texto);
}

export async function decifrar(cifra, iv) {
  if (!chave) throw new Error("Cofre bloqueado.");
  return decifrarCom(chave, cifra, iv);
}
