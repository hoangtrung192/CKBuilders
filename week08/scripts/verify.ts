import { webcrypto } from "node:crypto";
import { verifyBoard } from "../lib/verify-browser";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
const [seed, client, nonce, hash] = process.argv.slice(2);
if (!seed || !client || !nonce || !hash) {
  console.error(
    "Usage: pnpm verify <serverSeed> <clientSeed> <nonce> <commitment>",
  );
  process.exit(1);
}
console.log(await verifyBoard(seed, client, nonce, hash));
