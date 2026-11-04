import { test } from "node:test";
import assert from "node:assert/strict";
import { affordableStake, walletBalance } from "../lib/wallet-balance";
import { parseCkb } from "../lib/money";

test("wallet counts only available CKB in enabled ready channels", () => {
  const channel = {
    state: { state_name: "CHANNEL_READY" },
    enabled: true,
    funding_udt_type_script: null,
    local_balance: "0x64",
    offered_tlc_balance: "0x14",
  };
  assert.equal(
    walletBalance([
      channel,
      { ...channel, state: { state_name: "ChannelReady" } },
      { ...channel, state: { state_name: "AWAITING_CHANNEL_READY" } },
      { ...channel, enabled: false },
      { ...channel, funding_udt_type_script: {} },
      { ...channel, offered_tlc_balance: "0xff" },
    ]),
    160n,
  );
  assert.equal(walletBalance([]), 0n);
});

test("max stake respects fees, funds and server cap with exact shannons", () => {
  assert.equal(
    affordableStake(parseCkb("10"), parseCkb("100"), true),
    parseCkb("9.9"),
  );
  assert.equal(
    affordableStake(parseCkb("200"), parseCkb("100"), true),
    parseCkb("100"),
  );
  assert.equal(affordableStake(1n, parseCkb("100"), true), 0n);
  assert.equal(
    affordableStake(parseCkb("10"), parseCkb("100"), false),
    parseCkb("10"),
  );
});
