import { createHash } from "node:crypto";

// Calcule l'empreinte (info hash) d'un fichier .torrent : SHA-1 du dictionnaire "info" brut.
export function torrentInfoHash(buf: Buffer): string {
  let i = 0;
  const fail = () => {
    throw new Error("Fichier torrent invalide");
  };

  function readLength(): number {
    const colon = buf.indexOf(0x3a, i);
    if (colon < 0) fail();
    const len = Number(buf.toString("ascii", i, colon));
    if (!Number.isInteger(len) || len < 0) fail();
    i = colon + 1;
    return len;
  }

  function skip(depth = 0): void {
    if (i >= buf.length || depth > 100) fail();
    const c = buf[i];
    if (c === 0x69) {
      // i<entier>e
      const end = buf.indexOf(0x65, i);
      if (end < 0) fail();
      i = end + 1;
    } else if (c === 0x6c || c === 0x64) {
      // l...e ou d...e
      i++;
      while (buf[i] !== 0x65) skip(depth + 1);
      i++;
    } else {
      // readLength() avance i : ne pas écrire "i += readLength()" (i serait lu avant l'appel)
      const len = readLength();
      i += len;
    }
  }

  if (buf[0] !== 0x64) fail();
  i = 1;
  while (i < buf.length && buf[i] !== 0x65) {
    const len = readLength();
    const key = buf.toString("latin1", i, i + len);
    i += len;
    const start = i;
    skip();
    if (key === "info") return createHash("sha1").update(buf.subarray(start, i)).digest("hex").toUpperCase();
  }
  return fail();
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Empreinte d'un lien magnet (hexadécimal ou base32)
export function magnetInfoHash(uri: string): string {
  const m = uri.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
  if (!m) throw new Error("Lien magnet invalide");
  const value = m[1];
  if (/^[a-fA-F0-9]{40}$/.test(value)) return value.toUpperCase();
  if (/^[A-Za-z2-7]{32}$/.test(value)) {
    let bits = "";
    for (const ch of value.toUpperCase()) bits += BASE32.indexOf(ch).toString(2).padStart(5, "0");
    let hex = "";
    for (let j = 0; j + 4 <= bits.length; j += 4) hex += parseInt(bits.slice(j, j + 4), 2).toString(16);
    return hex.toUpperCase();
  }
  throw new Error("Lien magnet invalide");
}
