// Independent Web Crypto implementation: does not import the server's shuffle.
export async function verifyBoard(
  seed: string,
  clientSeed: string,
  nonce: string,
  commitment: string,
) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(seed));
  const digest = Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(seed),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  let counter = 0;
  for (let i = 8; i > 0; i--) {
    const bound = i + 1,
      limit = Math.floor(4294967296 / bound) * bound;
    let n: number;
    do {
      const bytes = await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode(
          JSON.stringify(["fiber-mines-v1", clientSeed, nonce, counter++]),
        ),
      );
      n = new DataView(bytes).getUint32(0, false);
    } while (n >= limit);
    const j = n % bound;
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return {
    valid: digest === commitment,
    mines: cells.slice(0, 2).sort((a, b) => a - b),
  };
}
