// Testes do js/cripto.js. Rodar na raiz do projeto: node testes/cripto.test.mjs
// (o Node tem a mesma Web Crypto API do navegador; não precisa instalar nada)
import * as c from "../js/cripto.js";
const ok = (cond, msg) => { console.log((cond ? "ok   " : "FALHA") + " " + msg); if (!cond) process.exitCode = 1; };

const t0 = Date.now();
const config = await c.prepararCofre("senha mestra de teste 123");
console.log(`     prepararCofre levou ${Date.now() - t0} ms`);
ok(c.estaDesbloqueado(), "fica desbloqueado depois de criar");
ok(config.iteracoes === 600000 && config.salt.length === 24, "config com 600k iterações e salt de 16 bytes");

const a = await c.cifrar("minha-senha-secreta");
const b = await c.cifrar("minha-senha-secreta");
ok(a.cifra !== b.cifra && a.iv !== b.iv, "mesma senha cifrada 2x dá resultados diferentes (IV novo)");
ok(await c.decifrar(a.cifra, a.iv) === "minha-senha-secreta", "decifra de volta");
ok(await c.decifrar((await c.cifrar("áç 😀 \n x")).cifra, (await c.cifrar("x")).iv).then(() => false, () => true), "IV trocado é recusado");

c.bloquear();
ok(!c.estaDesbloqueado(), "bloquear apaga a chave");
ok(await c.decifrar(a.cifra, a.iv).then(() => false, () => true), "bloqueado não decifra");

ok(await c.desbloquear("senha errada", config) === false, "senha mestra errada é recusada");
ok(!c.estaDesbloqueado(), "continua bloqueado após senha errada");
ok(await c.desbloquear("senha mestra de teste 123", config) === true, "senha mestra certa desbloqueia");
ok(await c.decifrar(a.cifra, a.iv) === "minha-senha-secreta", "decifra depois de desbloquear de novo");

const u = await c.cifrar("áç 😀 \n x");
ok(await c.decifrar(u.cifra, u.iv) === "áç 😀 \n x", "acentos, emoji e quebra de linha");

const adulterada = a.cifra.slice(0, -4) + (a.cifra.endsWith("AAAA") ? "BBBB" : "AAAA");
ok(await c.decifrar(adulterada, a.iv).then(() => false, () => true), "cifra adulterada é recusada (AES-GCM)");

ok(await c.desbloquear("x", { ...config, iteracoes: 1 }).then(() => false, () => true), "recusa config com poucas iterações");
