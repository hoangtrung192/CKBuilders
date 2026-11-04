import { createHash, createHmac } from "node:crypto";
export const ALGORITHM = "fiber-mines-v1";
export const commit = (seed: string) =>
  createHash("sha256").update(seed, "utf8").digest("hex");
// UTF-8 seed string is the HMAC key. Each uint32 consumes the first four bytes
// of HMAC(key, JSON.stringify([version, clientSeed, nonce, counter])), big-endian.
export function board(
  seed: string,
  clientSeed: string,
  nonce: string,
): number[] {
  const cells = Array.from({ length: 9 }, (_, i) => i);
  let counter = 0;
  for (let i = 8; i > 0; i--) {
    const bound = i + 1,
      limit = Math.floor(0x100000000 / bound) * bound;
    let x: number;
    do {
      x = createHmac("sha256", seed)
        .update(JSON.stringify([ALGORITHM, clientSeed, nonce, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (x >= limit);
    const j = x % bound;
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, 2).sort((a, b) => a - b);
}
