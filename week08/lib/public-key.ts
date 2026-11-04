// Fiber v0.9.1 RPC serializes compressed public keys without 0x.
// SDK 0.3.3 types currently alias these values to 0x-prefixed HexString.
export function publicKey(value: string): string {
  const key = value.replace(/^0x/i, "").toLowerCase();
  if (!/^(02|03)[0-9a-f]{64}$/.test(key))
    throw new Error("Public key Fiber không hợp lệ.");
  return key;
}
