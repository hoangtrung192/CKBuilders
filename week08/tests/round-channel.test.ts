import { test } from "node:test";
import assert from "node:assert/strict";
import type { FiberBrowserNode } from "@fiber-pay/sdk/browser";
import type { ccc } from "@ckb-ccc/connector-react";
import { openRoundChannel } from "../lib/round-channel";

function storage() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    },
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  };
}
function fixture() {
  const channelId = `0x${"a".repeat(64)}`;
  const codeHash = `0x${"b".repeat(64)}`;
  const pubkey = `02${"c".repeat(64)}`;
  let opened = 0,
    submitted = 0,
    mutate = true,
    failOpening = false;
  const unsigned = {
    version: "0x0",
    cell_deps: [],
    header_deps: [],
    inputs: [
      {
        since: "0x0",
        previous_output: { tx_hash: `0x${"d".repeat(64)}`, index: "0x0" },
      },
    ],
    outputs: [
      {
        capacity: "0x2540be400",
        lock: {
          code_hash: codeHash,
          hash_type: "type",
          args: `0x${"e".repeat(40)}`,
        },
        type: null,
      },
    ],
    outputs_data: ["0x"],
    witnesses: [],
  };
  const node = {
    async nodeInfo() {
      return { pubkey };
    },
    async listChannels() {
      return {
        channels:
          opened && !failOpening
            ? [
                {
                  channel_id: channelId,
                  state: { state_name: "NEGOTIATING_FUNDING" },
                },
              ]
            : [],
      };
    },
    async openChannelWithExternalFunding() {
      opened++;
      if (failOpening) throw new Error("network timeout");
      return { channel_id: channelId, unsigned_funding_tx: unsigned };
    },
    async submitSignedFundingTx() {
      submitted++;
      return { channel_id: channelId, funding_tx_hash: `0x${"f".repeat(64)}` };
    },
  } as unknown as FiberBrowserNode;
  const signer = {
    client: {
      addressPrefix: "ckt",
      async getKnownScript() {
        return {
          codeHash,
          hashType: "type",
          cellDeps: [
            {
              cellDep: {
                outPoint: { txHash: `0x${"1".repeat(64)}`, index: 0 },
                depType: "code",
              },
            },
          ],
        };
      },
    },
    async getRecommendedAddress() {
      return "ckt1-fixture-wallet";
    },
    async getRecommendedAddressObj() {
      return {
        script: { codeHash, hashType: "type", args: `0x${"e".repeat(40)}` },
      };
    },
    async signTransaction(transaction: Record<string, unknown>) {
      const signed = structuredClone(transaction) as {
        outputs: { capacity: string }[];
        witnesses: string[];
      };
      if (mutate) signed.outputs[0].capacity = "0x123";
      signed.witnesses = ["0x00"];
      return signed;
    },
  } as unknown as ccc.Signer;
  return {
    node,
    signer,
    pubkey,
    counts: () => ({ opened, submitted }),
    acceptSignature: () => {
      mutate = false;
    },
    failOpening: () => {
      failOpening = true;
    },
  };
}
test("a wallet cannot change the negotiated funding transaction; retry reuses the channel", async () => {
  const restore = storage();
  try {
    const f = fixture();
    await assert.rejects(
      () => openRoundChannel(f.node, f.signer, f.pubkey, "499"),
      /Only signatures may change/,
    );
    assert.deepEqual(f.counts(), { opened: 1, submitted: 0 });
    f.acceptSignature();
    const result = await openRoundChannel(f.node, f.signer, f.pubkey, "499");
    assert.ok(result.fundingTxHash);
    assert.deepEqual(f.counts(), { opened: 1, submitted: 1 });
  } finally {
    restore();
  }
});
test("an unknown channel-opening request cannot silently open another channel", async () => {
  const restore = storage();
  try {
    const f = fixture();
    f.failOpening();
    await assert.rejects(
      () => openRoundChannel(f.node, f.signer, f.pubkey, "499"),
      /network timeout/,
    );
    await assert.rejects(
      () => openRoundChannel(f.node, f.signer, f.pubkey, "499"),
      /unknown result/,
    );
    assert.deepEqual(f.counts(), { opened: 1, submitted: 0 });
  } finally {
    restore();
  }
});
