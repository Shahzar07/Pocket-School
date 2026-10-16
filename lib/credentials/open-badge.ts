/**
 * Open Badges 3.0 signing.
 *
 * Proofs use the W3C Data Integrity cryptosuite eddsa-jcs-2022: JSON
 * Canonicalization Scheme (RFC 8785) and an Ed25519 signature over
 * SHA-256(proof config) concatenated with SHA-256(credential).
 * The signature is multibase base58btc. The public key is a Multikey.
 */

import crypto, { type KeyObject } from 'node:crypto';
import { buildOpenBadge, type BadgeSource } from './badge-model';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function jcsCanonicalize(value: unknown): string {
  return jcsValue(value);
}

function jcsString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

function jcsValue(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Open Badge numbers must be finite.');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return jcsString(value);
  if (Array.isArray(value)) return `[${value.map((item) => jcsValue(item)).join(',')}]`;
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).filter((key) => source[key] !== undefined).sort();
    return `{${keys.map((key) => `${jcsString(key)}:${jcsValue(source[key])}`).join(',')}}`;
  }
  throw new Error('Open Badge values must be JSON.');
}

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i] ?? 0;
    for (let j = 0; j < digits.length; j += 1) {
      carry += (digits[j] ?? 0) << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) out += BASE58[digits[i] ?? 0];
  return out || '1';
}

export function base58Decode(value: string): Uint8Array {
  const bytes = [0];
  for (const ch of value) {
    const index = BASE58.indexOf(ch);
    if (index < 0) throw new Error('Invalid base58 character.');
    let carry = index;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += (bytes[j] ?? 0) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') zeros += 1;
  const decoded = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) decoded[decoded.length - 1 - i] = bytes[i] ?? 0;
  return decoded;
}

export function multibase58(bytes: Uint8Array): string {
  return `z${base58Encode(bytes)}`;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i] ?? 0;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

export function identityHash(studentId: string): string {
  return `sha256$${crypto.createHash('sha256').update(studentId).digest('hex')}`;
}

export function generateBadgeKey(): { publicKey: KeyObject; privateKey: KeyObject } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { publicKey, privateKey };
}

export function privateKeyToPem(key: KeyObject): string {
  return key.export({ type: 'pkcs8', format: 'pem' }).toString();
}

export function publicKeyToPem(key: KeyObject): string {
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

export function privateKeyFromPem(pem: string): KeyObject {
  return crypto.createPrivateKey(pem);
}

export function publicKeyFromPem(pem: string): KeyObject {
  return crypto.createPublicKey(pem);
}

export function publicFromPrivate(privateKey: KeyObject): KeyObject {
  const jwk = privateKey.export({ format: 'jwk' }) as { x?: string };
  if (!jwk.x) throw new Error('Ed25519 private key is missing a public coordinate.');
  return crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' });
}

export function publicKeyMultibase(publicKey: KeyObject): string {
  const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
  if (!jwk.x) throw new Error('Ed25519 public key is missing.');
  const raw = Buffer.from(jwk.x, 'base64url');
  return multibase58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
}

export function publicKeyFromMultibase(value: string): KeyObject {
  if (!value.startsWith('z')) throw new Error('Expected a base58btc public key.');
  const bytes = base58Decode(value.slice(1));
  if (bytes[0] !== 0xed || bytes[1] !== 0x01 || bytes.length !== 34) {
    throw new Error('Expected an Ed25519 Multikey.');
  }
  return crypto.createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(bytes.subarray(2)).toString('base64url') },
    format: 'jwk',
  });
}

function proofConfig(document: Record<string, unknown>, proof: Record<string, unknown>): Record<string, unknown> {
  const context = document['@context'];
  return {
    '@context': context,
    type: proof.type,
    cryptosuite: proof.cryptosuite,
    created: proof.created,
    verificationMethod: proof.verificationMethod,
    proofPurpose: proof.proofPurpose,
  };
}

export function signCredential(
  document: Record<string, unknown>,
  privateKey: KeyObject,
  verificationMethod: string,
  created: string,
): Record<string, unknown> {
  const proof = {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    created,
    verificationMethod,
    proofPurpose: 'assertionMethod',
  };
  const hashConfig = crypto.createHash('sha256').update(jcsCanonicalize(proofConfig(document, proof))).digest();
  const hashDoc = crypto.createHash('sha256').update(jcsCanonicalize(document)).digest();
  const signature = crypto.sign(null, Buffer.concat([hashConfig, hashDoc]), privateKey);
  return {
    ...document,
    proof: { ...proof, proofValue: multibase58(signature) },
  };
}

export function verifyCredential(document: Record<string, unknown>, publicKey: KeyObject): boolean {
  const proof = document.proof;
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return false;
  const proofValue = (proof as { proofValue?: unknown }).proofValue;
  if (typeof proofValue !== 'string' || !proofValue.startsWith('z')) return false;
  if ((proof as { cryptosuite?: unknown }).cryptosuite !== 'eddsa-jcs-2022') return false;
  const { proof: _proof, ...rest } = document;
  try {
    const signature = base58Decode(proofValue.slice(1));
    const hashConfig = crypto.createHash('sha256').update(jcsCanonicalize(proofConfig(rest, proof as Record<string, unknown>))).digest();
    const hashDoc = crypto.createHash('sha256').update(jcsCanonicalize(rest)).digest();
    return crypto.verify(null, Buffer.concat([hashConfig, hashDoc]), publicKey, signature);
  } catch {
    return false;
  }
}

export function signedOpenBadge(
  source: BadgeSource,
  privateKey: KeyObject,
  verificationMethod: string,
): Record<string, unknown> {
  const unsigned = buildOpenBadge({ ...source, identityHash: identityHash(source.studentId) });
  return signCredential(unsigned, privateKey, verificationMethod, source.issuedAt);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Inserts iTXt chunks before IEND so a downloaded badge carries the credential. */
export function insertPngText(png: Uint8Array, entries: { keyword: string; text: string }[]): Uint8Array {
  const buf = Buffer.from(png);
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const total = 12 + length;
    if (type === 'IEND') {
      for (const entry of entries) {
        const keyword = Buffer.from(entry.keyword, 'latin1');
        const text = Buffer.from(entry.text, 'utf8');
        const data = Buffer.concat([
          keyword,
          Buffer.from([0, 0, 0]),
          Buffer.from([0, 0]),
          text,
        ]);
        parts.push(pngChunk('iTXt', data));
      }
    }
    parts.push(buf.subarray(offset, offset + total));
    offset += total;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

export function readPngText(png: Uint8Array, keyword: string): string | null {
  const buf = Buffer.from(png);
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'iTXt') {
      const zero = data.indexOf(0);
      const key = data.subarray(0, zero).toString('latin1');
      if (key === keyword) {
        let cursor = zero + 1 + 2;
        const languageEnd = data.indexOf(0, cursor);
        cursor = languageEnd + 1;
        const translatedEnd = data.indexOf(0, cursor);
        return data.subarray(translatedEnd + 1).toString('utf8');
      }
    }
    offset += 12 + length;
  }
  return null;
}
