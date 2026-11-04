import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const data = `./artifacts/http-${Date.now()}`;
mkdirSync(data, { recursive: true });
async function start(mode, port) {
  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", String(port)],
    {
      env: {
        ...process.env,
        PAYMENT_MODE: mode,
        DATA_DIR: data,
        FIBER_RPC_URL: "",
      },
      stdio: "pipe",
      windowsHide: true,
    },
  );
  let logs = "";
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + "/api/game");
      if (r.ok) return { child, base };
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`Server did not start: ${logs}`);
}
let server = await start("mock", 3001);
try {
  async function session() {
    const res = await fetch(server.base + "/api/game");
    return res.headers.get("set-cookie").split(";")[0];
  }
  const alice = await session(),
    bob = await session();
  async function call(cookie, body, origin = server.base) {
    const res = await fetch(server.base + "/api/game", {
      method: "POST",
      headers: { cookie, origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }
  const committed = await call(alice, { action: "commit" }),
    id = committed.data.rounds[0].id;
  assert.equal(committed.status, 200);
  assert.equal(committed.data.rounds[0].serverSeed, undefined);
  const starts = await Promise.all([
    call(alice, { action: "start", id, stake: "10", clientSeed: "http-test" }),
    call(alice, { action: "start", id, stake: "10", clientSeed: "http-test" }),
  ]);
  assert.ok(starts.every((r) => r.status === 200));
  assert.equal(
    (await call(alice, { action: "check", id })).data.balance,
    "99000000000",
  );
  assert.equal(
    (await call(bob, { action: "reveal", id, cell: 0 })).status,
    400,
  );
  assert.equal(
    (await call(alice, { action: "cashout", id }, "https://foreign.invalid"))
      .status,
    403,
  );
  const clicks = await Promise.all([
    call(alice, { action: "reveal", id, cell: 0 }),
    call(alice, { action: "reveal", id, cell: 0 }),
  ]);
  assert.deepEqual(clicks.map((r) => r.status).sort(), [200, 400]);
  let state = (await call(alice, { action: "check", id })).data;
  if (state.rounds[0].game === "PLAYING") {
    const payouts = await Promise.all([
      call(alice, { action: "cashout", id }),
      call(alice, { action: "cashout", id }),
    ]);
    assert.ok(payouts.every((r) => r.status === 200));
    state = (await call(alice, { action: "check", id })).data;
    assert.equal(state.balance, "100260000000");
    assert.equal(state.rounds[0].payment, "PAYOUT_PAID");
  } else assert.equal(state.rounds[0].game, "LOST");
  server.child.kill();
  await new Promise((r) => server.child.once("exit", r));
  server = await start("mock", 3001);
  const persisted = await fetch(server.base + "/api/game", {
    headers: { cookie: alice },
  }).then((r) => r.json());
  assert.equal(persisted.rounds[0].id, id);
  assert.equal(persisted.balance, state.balance);
  server.child.kill();
  await new Promise((r) => server.child.once("exit", r));
  server = await start("fiber", 3002);
  const fiber = await fetch(server.base + "/api/game").then((r) => r.json());
  assert.equal(fiber.mode, "fiber");
  assert.equal(fiber.balance, null);
  assert.ok(fiber.setupError.includes("FIBER_RPC_URL"));
  assert.deepEqual(fiber.rounds, []);
  const result = {
    concurrentStart: true,
    duplicateReveal: true,
    ownership: true,
    csrf: true,
    processRestartPersistence: true,
    fiberMissingConfigurationNoFallback: true,
  };
  writeFileSync("artifacts/api-result.json", JSON.stringify(result, null, 2));
  console.log(result);
} finally {
  server.child.kill();
}
