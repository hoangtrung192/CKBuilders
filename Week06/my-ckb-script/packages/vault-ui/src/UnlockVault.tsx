import { useRef, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";

type Props = {
  signer?: ccc.Signer;
  client: ccc.Client;
  onUnlocked: () => void;
};

type Vault = {
  network: string;
  txHash: string;
  outputIndex: number;
  capacity: string;
  vaultLock: ccc.ScriptLike;
};

type DeploymentScript = {
  codeHash: string;
  hashType: ccc.HashType;
  cellDeps: { cellDep: ccc.CellDepLike }[];
};

type LiveCell = {
  status: string;
  cell?: {
    output: {
      capacity: string;
      lock: {
        code_hash: string;
        hash_type: string;
        args: string;
      };
      type?: unknown;
    };
    data?: { content: string };
  };
};

async function getLiveCell(txHash: string, index: number) {
  const response = await fetch("/ckb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "get_live_cell",
      params: [{
        tx_hash: txHash,
        index: `0x${index.toString(16)}`,
      }, true],
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result as LiveCell;
}

export default function UnlockVault({
  signer,
  client,
  onUnlocked,
}: Props) {
  const [vaultText, setVaultText] = useState(() => {
    try {
      return localStorage.getItem("week06-ui-vault") ?? "";
    } catch {
      return "";
    }
  });

  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const running = useRef(false);
  const submitted = useRef(false);

  function loadSavedVault() {
    try {
      const text = localStorage.getItem("week06-ui-vault");
      if (!text) throw new Error("Chưa có vault được lưu trong trình duyệt.");
      setVaultText(text);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  async function unlock() {
    if (running.current || submitted.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setStatus("");

    try {
      if (!signer) throw new Error("Kết nối ví demo trước.");

      const vault = JSON.parse(vaultText) as Vault;

      if (
        vault.network !== "devnet" ||
        !/^0x[0-9a-fA-F]{64}$/.test(vault.txHash) ||
        !Number.isSafeInteger(vault.outputIndex) ||
        vault.outputIndex < 0 ||
        vault.outputIndex > 0xffffffff
      ) {
        throw new Error("Thông tin vault Devnet không hợp lệ.");
      }

      setStatus("Đang kiểm tra vault trên Devnet...");

      const live = await getLiveCell(vault.txHash, vault.outputIndex);

      if (live.status !== "live" || !live.cell) {
        throw new Error(
          `Vault không còn live (${live.status}). Có thể đã mở hoặc Devnet đã reset.`,
        );
      }

      const output = live.cell.output;

      if (output.type != null || live.cell.data?.content !== "0x") {
        throw new Error("Chỉ hỗ trợ vault CKB thuần, không có type hoặc data.");
      }

      const liveLock = ccc.Script.from({
        codeHash: output.lock.code_hash,
        hashType: output.lock.hash_type,
        args: output.lock.args,
      });

      if (liveLock.hash() !== ccc.Script.from(vault.vaultLock).hash()) {
        throw new Error("Lock trên chain khác thông tin vault.");
      }

      const capacity = BigInt(output.capacity);
      if (capacity !== BigInt(vault.capacity)) {
        throw new Error("Capacity trên chain khác thông tin vault.");
      }

      const args = ccc.bytesFrom(liveLock.args);
      if (args.length !== 99) {
        throw new Error("Vault args phải đúng 99 byte.");
      }

      const secretBytes = ccc.hexFrom(new TextEncoder().encode(secret));
      const expectedSecretHash = ccc.hexFrom(args.slice(35, 67));
      const expectedRecipientHash = ccc.hexFrom(args.slice(67, 99));

      if (ccc.hashCkb(secretBytes) !== expectedSecretHash) {
        throw new Error("Secret không đúng. Chưa gửi giao dịch.");
      }

      const recipient = await signer.getRecommendedAddressObj();

      if (recipient.script.hash() !== expectedRecipientHash) {
        throw new Error("Ví đang kết nối không phải người nhận của vault.");
      }

      const response = await fetch(
        `${import.meta.env.BASE_URL}deployment-devnet.json`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Không tải được deployment-devnet.json.");
      }

      const { vaultCode, jsVm } = await response.json() as {
        vaultCode: DeploymentScript;
        jsVm: DeploymentScript;
      };

      const expectedPrefix = ccc.hexFrom(
        "0x0000" +
        vaultCode.codeHash.slice(2) +
        ccc.hexFrom(ccc.hashTypeToBytes(vaultCode.hashType)).slice(2),
      );

      if (
        liveLock.codeHash.toLowerCase() !== jsVm.codeHash.toLowerCase() ||
        liveLock.hashType !== jsVm.hashType ||
        ccc.hexFrom(args.slice(0, 35)) !== expectedPrefix
      ) {
        throw new Error("Deployment hiện tại không khớp contract của vault.");
      }

      if (!jsVm.cellDeps?.length || !vaultCode.cellDeps?.length) {
        throw new Error("Deployment thiếu cellDeps.");
      }

      const tx = ccc.Transaction.from({
        cellDeps: [
          ...jsVm.cellDeps.map((entry) => entry.cellDep),
          ...vaultCode.cellDeps.map((entry) => entry.cellDep),
        ],
        inputs: [{
          previousOutput: {
            txHash: vault.txHash,
            index: vault.outputIndex,
          },
        }],
        outputs: [{ capacity, lock: recipient.script }],
        outputsData: ["0x"],
        witnesses: [
          ccc.hexFrom(
            ccc.WitnessArgs.from({ lock: secretBytes }).toBytes(),
          ),
        ],
      });

      setStatus("Đang thêm cell riêng để trả phí...");

      await tx.completeInputsByCapacity(signer, 100n * 100_000_000n);
      await tx.completeFeeBy(signer, 100_000);

      if (
        tx.outputs[0].capacity !== capacity ||
        tx.outputs[0].lock.hash() !== expectedRecipientHash
      ) {
        throw new Error("Output phải trả đủ CKB cho đúng người nhận.");
      }

      setStatus("Đang ký và gửi giao dịch mở vault...");
      const hash = await signer.sendTransaction(tx);

      submitted.current = true;
      setTxHash(hash);
      setStatus("Đã gửi. Đang chờ xác nhận...");

      await client.waitTransaction(hash);

      setSecret("");
      setStatus(
        `Vault unlock confirmed. Đã trả ${ccc.fixedPointToString(capacity)} CKB.`,
      );
      onUnlocked();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setStatus(
        submitted.current
          ? "Đã gửi giao dịch; giữ lại tx hash để kiểm tra xác nhận."
          : "",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="card vault-form">
      <p className="eyebrow">04 / MỞ VAULT</p>
      <h2>Nhận lại CKB</h2>

      <fieldset disabled={!signer || busy || Boolean(txHash)}>
        <button
          type="button"
          className="secondary"
          onClick={loadSavedVault}
        >
          Lấy vault vừa tạo
        </button>

        <label className="field">
          <span>Thông tin vault JSON</span>
          <textarea
            rows={8}
            value={vaultText}
            onChange={(event) => setVaultText(event.target.value)}
            placeholder="Lấy vault vừa tạo hoặc dán nội dung vault-ui.json"
          />
        </label>

        <label className="field">
          <span>Secret dùng khi tạo vault</span>
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
        </label>

        <button type="button" onClick={() => { void unlock(); }}>
          {busy ? "Đang xử lý..." : "Mở vault"}
        </button>
      </fieldset>

      {status && <p className="status" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {txHash && (
        <div className="field">
          <span>Unlock transaction hash</span>
          <code>{txHash}</code>
        </div>
      )}
    </section>
  );
}
