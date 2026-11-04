type WalletChannel = {
  state: { state_name: string };
  enabled: boolean;
  funding_udt_type_script: unknown;
  local_balance: string;
  offered_tlc_balance: string;
};

// Keep CKB separate from UDTs and exclude pending/closing/disabled channels.
export function walletBalance(channels: WalletChannel[]): bigint {
  return channels.reduce((total, channel) => {
    if (
      !["CHANNEL_READY", "ChannelReady"].includes(channel.state.state_name) ||
      !channel.enabled ||
      channel.funding_udt_type_script != null
    )
      return total;
    const available =
      BigInt(channel.local_balance) - BigInt(channel.offered_tlc_balance);
    return total + (available > 0n ? available : 0n);
  }, 0n);
}

export const STAKE_FEE_RESERVE = 10_000_000n; // Existing send cap: 0.1 CKB.

export function affordableStake(
  balance: bigint,
  maximum: bigint,
  fiber: boolean,
): bigint {
  const available = balance - (fiber ? STAKE_FEE_RESERVE : 0n);
  return available <= 0n ? 0n : available < maximum ? available : maximum;
}
