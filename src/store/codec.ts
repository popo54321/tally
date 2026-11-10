// Packing text small for storage. 'gz1:' + base64 of gzip where the browser can compress (Chrome 80+,
// Android's WebView, Safari 16.4+); otherwise 'js1:' + the plain text. Both forms always read back.

const GZ = 'gz1:', PLAIN = 'js1:';
const canGzip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function streamBytes(input: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([input as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}
function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function pack(text: string): Promise<string> {
  if (!canGzip()) return PLAIN + text;
  try { return GZ + toBase64(await streamBytes(new TextEncoder().encode(text), new CompressionStream('gzip'))); }
  catch (e) { return PLAIN + text; }
}

export async function unpack(stored: string): Promise<string> {
  if (stored.startsWith(PLAIN)) return stored.slice(PLAIN.length);
  if (stored.startsWith(GZ)) {
    if (!canGzip()) throw new Error('this browser cannot read compressed data');
    return new TextDecoder().decode(await streamBytes(fromBase64(stored.slice(GZ.length)), new DecompressionStream('gzip')));
  }
  throw new Error('unknown packed format');
}
