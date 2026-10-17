// Génère la valeur de AUTH_PASSWORD_HASH pour le .env
// Usage : npm run hash-password -- "mon mot de passe"
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage : npm run hash-password -- "mot de passe" (8 caractères minimum)');
  process.exit(1);
}

const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
console.log(`AUTH_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${hash.toString("base64url")}`);
