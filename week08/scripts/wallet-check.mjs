import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.goto(process.env.BASE_URL || "http://localhost:3000");
  await page
    .getByRole("button", { name: "Connect Wallet", exact: true })
    .click();
  await page.getByText("JoyID Passkey", { exact: true }).first().waitFor();
  await page.screenshot({
    path: "artifacts/external-wallet-picker.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByText("JoyID Passkey", { exact: true }).first().waitFor();
  await page.screenshot({
    path: "artifacts/external-wallet-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "External wallet selector opens with JoyID on desktop and mobile; no page errors. No wallet signed or funded.",
  );
} finally {
  await browser.close();
}
