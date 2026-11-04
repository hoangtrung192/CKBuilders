import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const consoleErrors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
});
await page.goto(process.env.BASE_URL || "http://localhost:3000");
await page.getByRole("button", { name: "Bắt đầu →", exact: true }).waitFor();
assert.equal(await page.evaluate(() => crossOriginIsolated), true);
await page.getByRole("button", { name: /Dùng số dư/ }).click();
assert.equal(await page.locator("#stake").inputValue(), "100");
await page.locator("#stake").fill("10");
await page.getByRole("button", { name: "Bắt đầu →", exact: true }).click();
await page.getByLabel("Client seed", { exact: true }).fill("browser-check");
await page.getByRole("button", { name: "Xác nhận & bắt đầu →" }).click();
await page
  .getByRole("button", { name: "Ô 1, chưa mở", exact: true })
  .waitFor({ state: "visible" });
await page.waitForFunction(
  () => !document.querySelector('[aria-label="Ô 1, chưa mở"]').disabled,
);
let live = await page.evaluate(
  async () => await (await fetch("/api/game")).json(),
);
assert.equal(live.rounds[0].serverSeed, undefined);
assert.equal(live.rounds[0].mines, undefined);
await page.getByRole("button", { name: "Ô 1, chưa mở", exact: true }).click();
await page.waitForFunction(
  () =>
    !Array.from(document.querySelectorAll("button")).some((b) =>
      b.textContent.includes("Đang xử lý"),
    ),
);
live = await page.evaluate(async () => await (await fetch("/api/game")).json());
if (live.rounds[0].game === "PLAYING") {
  await page.getByRole("button", { name: /Chốt thưởng ·/ }).click();
  await page.waitForFunction(() =>
    document.body.textContent.includes("Đã chốt thưởng"),
  );
} else assert.equal(live.rounds[0].game, "LOST");
await page.getByRole("button", { name: "Kiểm chứng seed & bàn →" }).click();
await page.getByText(/✓ Hợp lệ · Mìn ở ô/).waitFor();
await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
await page.reload();
await page.getByRole("button", { name: "Chơi lại →", exact: true }).waitFor();
const after = await page.evaluate(
  async () => await (await fetch("/api/game")).json(),
);
assert.equal(after.rounds[0].id, live.rounds[0].id);
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
);
await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
// Browser WASM startup is independent of funded HOUSE setup.
await page
  .getByRole("button", { name: "Set up Fiber payments", exact: true })
  .click();
await page.locator("#wallet-password").fill("browser-test-password-only");
await page
  .locator("#wallet-panel")
  .getByRole("button", { name: "Unlock Fiber node", exact: true })
  .click();
let wasm = "";
try {
  await page
    .getByRole("button", { name: "◈ Fiber ready", exact: true })
    .waitFor({ timeout: 120000 });
  wasm = "Browser WASM started; no funds moved.";
  await page
    .getByRole("button", { name: "◈ Fiber ready", exact: true })
    .waitFor();
  await page.getByText("Số dư kênh khả dụng: 0 CKB", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const originalPubkey = await page.locator("#wallet-panel code").textContent();
  await page.screenshot({ path: "artifacts/wasm-node.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Chơi lại →", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Set up Fiber payments", exact: true })
    .click();
  await page.locator("#wallet-password").fill("browser-test-password-only");
  await page
    .locator("#wallet-panel")
    .getByRole("button", { name: "Unlock Fiber node", exact: true })
    .click();
  await page
    .getByRole("button", { name: "◈ Fiber ready", exact: true })
    .waitFor({ timeout: 120000 });
  assert.equal(
    await page.locator("#wallet-panel code").textContent(),
    originalPubkey,
  );
  wasm =
    "Browser WASM started; same identity restored after reload; no funds moved.";
} catch (e) {
  wasm = `Browser WASM startup incomplete: ${e.message} · ${await page.locator("[role=alert]").allTextContents()} · ${consoleErrors.join("; ")}`;
  await page.screenshot({ path: "artifacts/wasm-failure.png", fullPage: true });
}
assert.deepEqual(errors, []);
writeFileSync(
  "artifacts/browser-result.json",
  JSON.stringify(
    {
      desktop: true,
      mobile: true,
      reload: true,
      independentVerifier: true,
      crossOriginIsolated: true,
      wasm,
      errors,
    },
    null,
    2,
  ),
);
console.log(wasm);
console.log(
  "Browser gameplay, reload, verifier and mobile layout checks passed.",
);
await browser.close();
assert.match(wasm, /same identity restored/, wasm);
