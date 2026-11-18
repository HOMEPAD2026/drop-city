// grind-worker.js — finds a Solana key whose address ends with the launchpad's suffix, inside the visitor's browser
// (the key never leaves it). Native Ed25519 (WebCrypto) when the browser has it — about 10× faster — else the
// pump.fun kit's Keypair. The address's last k base58 letters are its value mod 58^k, so no full base58 per try.
// in:  { suffix }    out: { tries } every 0.5 s, then { secret: number[64], pub: base58, tries }
const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (u8) => { let n = 0n; for (const b of u8) n = n * 256n + BigInt(b); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const b of u8) { if (b) break; s = "1" + s; } return s; };
self.onmessage = async (e) => {
  const suffix = String(e.data.suffix || ""), k = suffix.length, M = 58 ** k;
  let T = 0; for (const ch of suffix) T = T * 58 + A.indexOf(ch);
  const hit = (pub) => { let r = 0; for (let i = 0; i < 32; i++) r = (r * 256 + pub[i]) % M; return r === T; };
  let tries = 0, last = Date.now();
  const tick = () => { if (Date.now() - last > 500) { last = Date.now(); self.postMessage({ tries }); tries = 0; } };
  const S = self.crypto && self.crypto.subtle;
  let native = false;
  try { await S.generateKey({ name: "Ed25519" }, true, ["sign"]); native = true; } catch { native = false; }
  if (native) {
    for (;;) {
      const keys = await Promise.all(Array.from({ length: 96 }, () => S.generateKey({ name: "Ed25519" }, true, ["sign"])));
      const pubs = await Promise.all(keys.map((x) => S.exportKey("raw", x.publicKey)));
      for (let i = 0; i < pubs.length; i++) {
        const pub = new Uint8Array(pubs[i]); tries++;
        if (k === 0 || hit(pub)) {
          const pk = new Uint8Array(await S.exportKey("pkcs8", keys[i].privateKey)), seed = pk.slice(pk.length - 32);
          const secret = new Uint8Array(64); secret.set(seed); secret.set(pub, 32);
          self.postMessage({ secret: Array.from(secret), pub: b58(pub), tries, native: true }); return;
        }
      }
      tick();
    }
  }
  importScripts("/vendor/pump-kit.js");
  const K = self.ArcPumpKit;
  for (;;) {
    for (let j = 0; j < 200; j++) {
      const kp = K.Keypair.generate(), pub = kp.publicKey.toBytes(); tries++;
      if (k === 0 || hit(pub)) { self.postMessage({ secret: Array.from(kp.secretKey), pub: b58(pub), tries, native: false }); return; }
    }
    tick();
  }
};
