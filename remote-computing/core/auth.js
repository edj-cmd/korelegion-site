// Device pairing + challenge/response authentication using WebCrypto ECDSA P-256.
// Works identically in browsers (Safari 11+) and Node 22 (globalThis.crypto).
// Threat model: tailnet is layer 1; this is layer 2 (only paired devices may connect).

const ALG = { name: "ECDSA", namedCurve: "P-256" };
const SIGN = { name: "ECDSA", hash: "SHA-256" };

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

export async function generateDeviceKey() {
  return crypto.subtle.generateKey(ALG, false, ["sign", "verify"]); // private key non-extractable
}

export async function exportPublic(key) {
  return b64.enc(await crypto.subtle.exportKey("spki", key.publicKey));
}

export async function importPublic(spkiB64) {
  return crypto.subtle.importKey("spki", b64.dec(spkiB64), ALG, true, ["verify"]);
}

export function newChallenge() {
  return b64.enc(crypto.getRandomValues(new Uint8Array(32)));
}

/** Signed payload binds the challenge to a purpose so a signature can't be replayed elsewhere. */
function payload(purpose, challenge) {
  return new TextEncoder().encode(`tether/v1/${purpose}/${challenge}`);
}

export async function sign(privateKey, purpose, challenge) {
  return b64.enc(await crypto.subtle.sign(SIGN, privateKey, payload(purpose, challenge)));
}

export async function verify(publicSpkiB64, purpose, challenge, sigB64) {
  try {
    const pub = await importPublic(publicSpkiB64);
    return await crypto.subtle.verify(SIGN, pub, b64.dec(sigB64), payload(purpose, challenge));
  } catch { return false; }
}

/** One-time pairing code: 8 digits, 5-minute life, 5 attempts, single use. */
export class PairingSession {
  constructor({ now = () => Date.now(), ttlMs = 5 * 60_000, maxAttempts = 5 } = {}) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000;
    this.code = String(n).padStart(8, "0");
    this.now = now; this.expires = now() + ttlMs;
    this.attempts = 0; this.maxAttempts = maxAttempts; this.used = false;
  }
  /** @returns {"ok"|"bad-code"|"expired"|"locked"|"used"} */
  redeem(code) {
    if (this.used) return "used";
    if (this.now() > this.expires) return "expired";
    if (this.attempts >= this.maxAttempts) return "locked";
    this.attempts++;
    if (code !== this.code) return "bad-code";
    this.used = true;
    return "ok";
  }
}

/** Host-side registry of paired device public keys. Persistence is the caller's job. */
export class DeviceRegistry {
  constructor(devices = {}) { this.devices = { ...devices }; }
  add(id, name, spki) { this.devices[id] = { name, spki, added: Date.now() }; }
  revoke(id) { delete this.devices[id]; }
  get(id) { return this.devices[id]; }
  toJSON() { return this.devices; }
}
