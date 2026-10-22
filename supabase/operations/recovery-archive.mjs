// Local recovery primitive. No network and no side effects on import.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
const MAGIC = Buffer.from('MWREC01\n');
export async function encryptStream(source, file, key) {
  if (key.length !== 32) throw new Error('invalid-key');
  const nonce = randomBytes(12);
  const header = Buffer.concat([MAGIC, nonce]);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(header);
  const destination = createWriteStream(file, { flags: 'wx', mode: 0o600 });
  async function* encrypted() {
    yield header;
    for await (const chunk of source) yield cipher.update(chunk);
    yield cipher.final();
    yield cipher.getAuthTag();
  }
  await pipeline(Readable.from(encrypted()), destination);
}
export async function encryptBytes(bytes, file, key) {
  await encryptStream(Readable.from([bytes]), file, key);
}
export async function* decryptStream(file, key) {
  const size = (await stat(file)).size;
  if (size < 36 || key.length !== 32) throw new Error('invalid-archive');
  const handle = await open(file, 'r');
  const header = Buffer.alloc(20), tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, 20, 0);
    await handle.read(tag, 0, 16, size - 16);
  } finally { await handle.close(); }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('invalid-header');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(8));
  decipher.setAAD(header); decipher.setAuthTag(tag);
  for await (const chunk of createReadStream(file, { start: 20, end: size - 17 })) yield decipher.update(chunk);
  yield decipher.final();
}
// Authenticate a complete artifact before any restore execution. Streaming output
// alone is not authenticated until the final tag has been checked.
export async function verifyArtifact(file, key) {
  let bytes = 0;
  for await (const chunk of decryptStream(file, key)) bytes += chunk.length;
  return bytes;
}
export async function decryptSmallArtifact(file, key, max = 32 * 1024 * 1024) {
  if ((await stat(file)).size > max) throw new Error('artifact-too-large-for-memory');
  const chunks = [];
  for await (const chunk of decryptStream(file, key)) chunks.push(chunk);
  return Buffer.concat(chunks);
}
