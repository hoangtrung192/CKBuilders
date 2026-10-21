import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ccc } from "@ckb-ccc/connector-react";

type Props = {
  signer?: ccc.Signer;
  client: ccc.Client;
  onCreated: () => void;
};

type DeploymentScript = {
  codeHash: string;
  hashType: ccc.HashType;
};

export default function CreateVault({
  signer,
  client,
  onCreated,
}: Props) {
  const [amount, setAmount] = useState("300");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [vaultJson, setVaultJson] = useState("");
  const running = useRef(false);
  const submitted = useRef(false);

  async function createVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (running.current || submitted.current) return;

    running.current = true;
    setBusy(true);
    setError("");
    setStatus("");

    try {
      if (!signer) {
        throw new Error("Kết nối ví demo trước.");
      }

      if (!/^\d+(\.\d{1,8})?$/.test(amount.trim())) {
        throw new Error("Số CKB phải hợp lệ, tối đa 8 chữ số thập phân.");
      }

      const capacity = ccc.fixedPointFrom(amount.trim());

      if (capacity < 140n * 100_000_000n) {
        throw new Error("Vault này cần ít nhất 140 CKB để chứa lock args.");
      }

      if (!secret.trim()) {
        throw new Error("Nhập secret để khóa vault.");
      }

      // Để trống địa chỉ thì trả về chính ví đang kết nối.
      const recipient = recipientAddress.trim()
        ? await ccc.Address.fromString(recipientAddress.trim(), client)
        : await signer.getRecommendedAddressObj();

      setStatus("Đang đọc cấu hình contract...");

      const response = await fetch(
        `${import.meta.env.BASE_URL}deployment-devnet.json`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Không tải được deployment-devnet.json.");
      }

      const deployment = await response.json() as {
        vaultCode: DeploymentScript;
        jsVm: DeploymentScript;
      };

      const { vaultCode, jsVm } = deployment;

      if (
        !/^0x[0-9a-fA-F]{64}$/.test(vaultCode?.codeHash ?? "") ||
        !/^0x[0-9a-fA-F]{64}$/.test(jsVm?.codeHash ?? "")
      ) {
        throw new Error("Deployment thiếu codeHash hợp lệ.");
      }

      // Hash đúng UTF-8 của secret, không tự bỏ khoảng trắng.
      const secretHash = ccc.hashCkb(
        new TextEncoder().encode(secret),
      );
      const recipientLockHash = recipient.script.hash();

      const args = ccc.hexFrom(
        "0x0000" +
        vaultCode.codeHash.slice(2) +
        ccc.hexFrom(ccc.hashTypeToBytes(vaultCode.hashType)).slice(2) +
        secretHash.slice(2) +
        recipientLockHash.slice(2),
      );

      if (ccc.bytesFrom(args).length !== 99) {
        throw new Error("Vault args phải đúng 99 byte.");
      }

      const vaultLock = ccc.Script.from({
        codeHash: jsVm.codeHash,
        hashType: jsVm.hashType,
        args,
      });

      const tx = ccc.Transaction.from({
        outputs: [{ capacity, lock: vaultLock }],
        outputsData: ["0x"],
      });

      setStatus("Đang chọn cell và tính phí...");
      await tx.completeInputsByCapacity(signer);
      await tx.completeFeeBy(signer, 1000);

      if (
        tx.outputs[0].capacity !== capacity ||
        tx.outputs[0].lock.hash() !== vaultLock.hash()
      ) {
        throw new Error("Output vault bị thay đổi khi hoàn thiện giao dịch.");
      }

      setStatus("Đang ký và gửi giao dịch...");
      const hash = await signer.sendTransaction(tx);

      submitted.current = true;
      setTxHash(hash);

      const record = {
        network: "devnet",
        rpcUrl: "http://127.0.0.1:8114",
        txHash: hash,
        outputIndex: 0,
        capacity: capacity.toString(),
        recipientAddress: recipient.toString(),
        recipientLockHash,
        secretHash,
        vaultLock: {
          codeHash: vaultLock.codeHash,
          hashType: vaultLock.hashType,
          args: vaultLock.args,
        },
      };

      const json = JSON.stringify(record, null, 2);
      setVaultJson(json);

      try {
        localStorage.setItem("week06-ui-vault", json);
      } catch {
        // Vẫn có thể tải thông tin vault bằng nút bên dưới.
      }

      setStatus("Đã gửi. Đang chờ Devnet xác nhận...");
      await client.waitTransaction(hash);

      setStatus("Vault creation confirmed.");
      setSecret("");
      onCreated();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : String(error),
      );

      setStatus(
        submitted.current
          ? "Đã gửi giao dịch. Giữ lại tx hash; chưa xác nhận được trạng thái."
          : "",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function downloadVault() {
    const url = URL.createObjectURL(
      new Blob([vaultJson + "\n"], { type: "application/json" }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "vault-ui.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="card vault-form">
      <p className="eyebrow">03 / TẠO VAULT</p>
      <h2>Khóa CKB bằng secret</h2>
      <p className="muted">
        Để trống người nhận để dùng chính ví demo đang kết nối.
        Nhớ giữ lại secret để mở vault.
      </p>

      <form onSubmit={(event) => { void createVault(event); }}>
        <fieldset disabled={!signer || busy || Boolean(txHash)}>
          <label className="field">
            <span>Số CKB</span>
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Địa chỉ nhận</span>
            <input
              placeholder="Để trống = ví demo hiện tại"
              value={recipientAddress}
              onChange={(event) => setRecipientAddress(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Secret</span>
            <input
              required
              type="password"
              autoComplete="off"
              placeholder="Ví dụ: week06-secret"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </label>

          <button type="submit">
            {busy ? "Đang xử lý..." : "Tạo vault"}
          </button>
        </fieldset>
      </form>

      {!signer && <p className="muted">Kết nối ví demo để bắt đầu.</p>}
      {status && <p className="status" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {txHash && (
        <div className="field">
          <span>Create transaction hash</span>
          <code>{txHash}</code>
        </div>
      )}

      {vaultJson && (
        <button
          type="button"
          className="secondary"
          onClick={downloadVault}
        >
          Tải thông tin vault
        </button>
      )}
    </section>
  );
}
