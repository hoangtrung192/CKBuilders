import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const base = process.env.BASE_URL || "http://localhost:3000";
  await page.goto(base);
  assert.equal(
    await page.evaluate(() => crossOriginIsolated),
    true,
    "Main page must support Fiber WASM",
  );
  await page.evaluate(() => {
    window.walletPopupMessage = new Promise((resolve) =>
      window.addEventListener("message", (event) => {
        if (event.data === "fixture-wallet-popup") resolve(true);
      }),
    );
  });
  await page
    .context()
    .route("http://127.0.0.1:3000/popup-fixture", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<script>window.opener.postMessage("fixture-wallet-popup", ${JSON.stringify(base)})</script>`,
      }),
    );
  const popupEvent = page.waitForEvent("popup");
  await page.evaluate(() => {
    window.open("http://127.0.0.1:3000/popup-fixture", "wallet-popup-fixture");
  });
  const popup = await popupEvent;
  assert.equal(
    await page.evaluate(() =>
      Promise.race([
        window.walletPopupMessage,
        new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
      ]),
    ),
    true,
    "Cross-origin wallet popup must retain communication with the isolated page",
  );
  await popup.close();
  await page.goto(`${base}/compat`);
  assert.equal(
    await page.evaluate(() => crossOriginIsolated),
    true,
    "Compatibility page must support Fiber WASM",
  );
  console.log(
    "Main-page WASM isolation, cross-origin popup messaging, and compatibility isolation passed.",
  );
} finally {
  await browser.close();
}
