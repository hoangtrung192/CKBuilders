"use client";
import type { FiberBrowserNode } from "@fiber-pay/sdk/browser";
let current: FiberBrowserNode | undefined;
export async function startPlayer(password: string) {
  if (!crossOriginIsolated)
    throw new Error(
      "Fiber needs browser isolation. Use a current Chromium browser on localhost/HTTPS, or open /compat with an extension wallet.",
    );
  if (!password || password.length < 10)
    throw new Error(
      "Mật khẩu node cần ít nhất 10 ký tự; dùng lại mật khẩu này sau reload.",
    );
  if (!current) {
    const { FiberBrowserNode, PasswordCredentialProvider } =
      await import("@fiber-pay/sdk/browser");
    const { Fiber } = await import("@nervosnetwork/fiber-js");
    const credential = new PasswordCredentialProvider("fiber-mines-player-v1");
    await credential.unlock({ password });
    const key = await credential.getFiberKeyPair();
    const fingerprint = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new Uint8Array(key)),
      ),
      (v) => v.toString(16).padStart(2, "0"),
    ).join("");
    const previous = localStorage.getItem("fiber-mines-identity-check");
    if (previous && previous !== fingerprint) {
      await credential.lock();
      throw new Error(
        "Mật khẩu không khớp identity đã lưu. Dùng mật khẩu ban đầu; không tạo node khác trên dữ liệu kênh cũ.",
      );
    }
    localStorage.setItem("fiber-mines-identity-check", fingerprint);
    current = new FiberBrowserNode({
      network: "testnet",
      credential,
      wasmFactory: () => new Fiber(),
      nodeConfig: {
        bootnodes: [],
        databasePrefix: "/fiber-mines-player-v1",
        logLevel: "error",
      },
    });
  }
  if (!current.isRunning) await current.start({ password });
  const { scriptToAddress } = await import("@fiber-pay/sdk/browser");
  const info = await current.nodeInfo();
  return {
    node: current,
    pubkey: info.pubkey,
    address: scriptToAddress(info.default_funding_lock_script, "testnet"),
  };
}
