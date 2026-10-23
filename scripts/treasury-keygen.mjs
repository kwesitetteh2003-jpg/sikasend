// Generates a fresh NEAR implicit account (ed25519). The account id is the 64-hex public key.
// It prints the account id and the secret key in NEAR's `ed25519:<base58>` format.
//
//   node scripts/treasury-keygen.mjs
//
// Put ONLY the account id into NEAR_TREASURY_ACCOUNT. Keep the secret key in a password manager.
// Never commit it. Import it into a NEAR wallet if you want to control the account.
import { generateKeyPairSync } from 'node:crypto';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) {
  let n = BigInt('0x' + buf.toString('hex'));
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of buf) { if (b === 0) out = '1' + out; else break; }
  return out;
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
const accountId = pub.toString('hex');
const secret = 'ed25519:' + base58(Buffer.concat([seed, pub]));

console.log(`NEAR_TREASURY_ACCOUNT=${accountId}`);
console.log(`public key : ed25519:${base58(pub)}`);
console.log(`secret key : ${secret}   <-- keep private, do not commit`);
