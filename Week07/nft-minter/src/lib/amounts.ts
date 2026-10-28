export const CKB = 100_000_000n;
export function formatCkb(value: bigint): string {
  const sign = value < 0n ? '-' : ''; const n = value < 0n ? -value : value;
  const fraction = (n % CKB).toString().padStart(8, '0').replace(/0+$/, '');
  return `${sign}${n / CKB}${fraction ? `.${fraction}` : ''}`;
}
