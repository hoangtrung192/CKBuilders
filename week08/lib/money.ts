export const UNIT = 100_000_000n;
export function parseCkb(value: string): bigint {
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/.test(value))
    throw new Error("Số tiền cần là số dương, tối đa 8 chữ số thập phân.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(8, "0"));
}
export function formatCkb(value: string | bigint): string {
  const n = BigInt(value),
    sign = n < 0n ? "-" : "",
    a = n < 0n ? -n : n;
  return (
    sign +
    (a / UNIT).toString() +
    (a % UNIT
      ? "." + (a % UNIT).toString().padStart(8, "0").replace(/0+$/, "")
      : "")
  );
}
export function choose(n: number, k: number): bigint {
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - i + 1)) / BigInt(i);
  return r;
}
export function payout(stake: bigint, k: number, edge = 200): bigint {
  if (!Number.isInteger(k) || k < 1 || k > 7) return 0n;
  return (
    (stake * BigInt(10000 - edge) * choose(9, k)) / (10000n * choose(7, k))
  );
}
export function multiplier(k: number, edge = 200): string {
  return k ? formatCkb(payout(UNIT, k, edge)) : "1";
}
