export type Content = { contentType: string; bytes: Uint8Array };
export const TEXT_LIMIT = 2048;
export const IMAGE_LIMIT = 20480;
export function textContent(text: string): Content {
  const bytes = new TextEncoder().encode(text);
  if (!text.trim()) throw new Error('Enter non-empty text.');
  if (bytes.length > TEXT_LIMIT) throw new Error('Text exceeds 2 KiB UTF-8.');
  return { contentType: 'text/plain', bytes };
}
export function validateImageBytes(bytes: Uint8Array, mime: string): void {
  if (!bytes.length) throw new Error('Image is empty.');
  if (bytes.length > IMAGE_LIMIT) throw new Error('Image exceeds the 20 KiB product limit.');
  const png = [137,80,78,71,13,10,26,10].every((x,i) => bytes[i] === x);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(mime === 'image/png' && png) && !(mime === 'image/jpeg' && jpeg)) throw new Error('Choose a PNG/JPEG whose signature matches its MIME type.');
}
export async function imageContent(file: File): Promise<Content> {
  if (file.size > IMAGE_LIMIT) throw new Error('Image exceeds the 20 KiB product limit.');
  const bytes = new Uint8Array(await file.arrayBuffer()); validateImageBytes(bytes, file.type);
  await checkDecodable(bytes, file.type);
  return { contentType: file.type, bytes };
}
export async function checkDecodable(bytes: Uint8Array, mime: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  try { const img = new Image(); img.src = url; await img.decode(); if (!img.width || !img.height) throw new Error(); }
  catch { throw new Error('Image cannot be decoded. Choose a valid PNG/JPEG.'); }
  finally { URL.revokeObjectURL(url); }
}
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/insufficient|not enough|unable to complete/i.test(message)) return 'Insufficient spendable CKB. Fund the active wallet on the configured network with plain CKB cells, then refresh.';
  if (/dead|unknown.*input|resolve.*unknown/i.test(message)) return 'An input is no longer live. Refresh your collection and build a new review.';
  return message;
}
