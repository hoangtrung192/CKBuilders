// Simulated external provider/RPC regression test. Never signs or broadcasts.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const lockQueries = new Set();
  const respond = (request) => {
    let result = null;
    if (request.method === "get_cells_capacity") {
      lockQueries.add(JSON.stringify(request.params[0].script));
      result = {
        capacity: "0x2540be400",
        block_hash: `0x${"1".repeat(64)}`,
        block_number: "0x1",
      }; // 100 CKB per lock
    }
    if (request.method === "get_fee_rate_statistics")
      result = { mean: "0x3e8", median: "0x3e8" };
    return { jsonrpc: "2.0", id: request.id, result };
  };
  await page.routeWebSocket(/testnet\.ckb/, (socket) =>
    socket.onMessage((message) => {
      const request = JSON.parse(String(message));
      socket.send(
        JSON.stringify(
          Array.isArray(request) ? request.map(respond) : respond(request),
        ),
      );
    }),
  );
  await page.route(/https:\/\/testnet\.ckb/, async (route) => {
    if (route.request().method() !== "POST") return route.abort();
    const request = route.request().postDataJSON();
    await route.fulfill({
      json: Array.isArray(request) ? request.map(respond) : respond(request),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.addInitScript(() => {
    let connected = false;
    const listeners = new Map();
    const provider = {
      on(name, listener) {
        listeners.set(name, listener);
      },
      removeListener(name) {
        listeners.delete(name);
      },
      async request({ method }) {
        if (method === "eth_requestAccounts") connected = true;
        if (["eth_accounts", "eth_requestAccounts"].includes(method))
          return connected
            ? ["0x1234567890123456789012345678901234567890"]
            : [];
        if (method === "eth_chainId") return "0x1";
        throw new Error(`Fixture refuses signing: ${method}`);
      },
    };
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "4ae47d4e-38d4-4712-ad65-ed82a319fa02",
              name: "Fixture Wallet",
              icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
              rdns: "test.fixture.wallet",
            },
            provider,
          },
        }),
      );
    window.addEventListener("eip6963:requestProvider", announce);
  });
  await page.goto(process.env.BASE_URL || "http://localhost:3000");
  await page
    .getByRole("button", { name: "Connect Wallet", exact: true })
    .click();
  await page.getByText("Fixture Wallet", { exact: true }).first().click();
  await page.locator(".wallet-connect").filter({ hasText: /CKB/ }).waitFor();
  const expected = `${lockQueries.size * 100} CKB`;
  assert.ok(
    (await page.locator(".wallet-connect").innerText()).includes(expected),
  );
  await page.locator(".wallet-connect").click();
  const walletAddress = await page.locator(".external-wallet code").innerText();
  assert.ok(walletAddress.startsWith("ckt1"));
  await page.getByRole("button", { name: "Close wallet", exact: true }).click();
  let confirmed = false;
  const state = () => ({
    mode: "fiber",
    balance: null,
    maxStake: "100",
    edge: 200,
    rounds: [
      {
        id: "receipt-ui-fixture",
        game: "LOST",
        payment: "NO_PAYOUT",
        payout: "0",
        stake: "1000000000",
        gross: "0",
        opened: [0],
        safeCount: 0,
        mines: [0, 1],
        multiplier: "1",
        edge: 200,
        commitment: "fixture",
        clientSeed: "fixture",
        nonce: "fixture",
        recipient: `02${"1".repeat(64)}`,
        stakeHash: "",
        payoutHash: "",
        settlement: {
          channelId: `0x${"a".repeat(64)}`,
          walletAddress,
          fundingOutpoint: { tx_hash: `0x${"b".repeat(64)}`, index: "0x0" },
          closeScript: {
            code_hash: `0x${"c".repeat(64)}`,
            hash_type: "type",
            args: "0x",
          },
          closeTxHash: `0x${"d".repeat(64)}`,
          returnedAmount: "4200000000",
          closeStatus: confirmed ? "confirmed" : "pending",
          proofTxHash: confirmed ? `0x${"e".repeat(64)}` : undefined,
          proofStatus: confirmed ? "confirmed" : undefined,
        },
      },
    ],
  });
  await page.route("**/api/game", (route) => route.fulfill({ json: state() }));
  await page.getByRole("button", { name: "↻ Làm mới", exact: true }).click();
  await page
    .getByLabel("Game balances")
    .locator("div")
    .nth(2)
    .getByText("42 CKB", { exact: true })
    .waitFor();
  assert.ok(
    (await page.locator(".wallet-connect").innerText()).includes(expected),
    "Pending return must not be added to spendable wallet balance",
  );
  confirmed = true;
  await page
    .getByRole("button", { name: "Refresh confirmation", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "✓ SETTLED ON TESTNET", exact: true })
    .waitFor();
  await page
    .getByLabel("Game balances")
    .locator("div")
    .nth(2)
    .getByText("0 CKB", { exact: true })
    .waitFor();
  await page.locator(".wallet-connect").click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect Wallet", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "SIMULATED: external provider connection, CKB balance, pending/confirmed receipt UI, no optimistic double credit, and disconnect passed. No transaction signed or broadcast.",
  );
} finally {
  await browser.close();
}
