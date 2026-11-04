"use client";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  useRef,
} from "react";
import Link from "next/link";
import { ExternalWallet } from "./external-wallet";
import { useWalletAccount } from "./wallet-account";
import { SettlementPanel } from "./settlement-panel";
import {
  archiveRoundChannel,
  loadRoundChannel,
  openRoundChannel,
  prepareRoundChannelFunding,
  type RoundChannel,
} from "../lib/round-channel";
import type { RoundSettlement } from "../lib/settlement-types";
import type { FiberBrowserNode } from "@fiber-pay/sdk/browser";
import { formatCkb, multiplier, parseCkb, payout } from "../lib/money";
import { verifyBoard } from "../lib/verify-browser";
import { publicKey } from "../lib/public-key";
import {
  affordableStake,
  STAKE_FEE_RESERVE,
  walletBalance,
} from "../lib/wallet-balance";
type Round = {
  id: string;
  commitment: string;
  clientSeed: string;
  nonce: string;
  stake: string;
  opened: number[];
  safeCount: number;
  game: string;
  payment: string;
  payout: string;
  gross: string;
  multiplier: string;
  nextMultiplier: string | null;
  invoice: string;
  stakeHash: string;
  payoutHash: string;
  expires: number;
  serverSeed?: string;
  mines?: number[];
  payerStatus: string;
  receiverStatus: string;
  fee: string;
  error: string;
  edge: number;
  recipient: string;
  settlement?: RoundSettlement | null;
};
type State = {
  mode: "mock" | "fiber";
  balance: string | null;
  rounds: Round[];
  maxStake: string;
  edge: number;
  setupError?: string;
};
type Setup = {
  version: string;
  pubkey: string;
  peers: number;
  channels: { id: string; state: string }[];
  outbound: string;
  inbound: string;
  fundingAddress: string;
};
const labels: Record<string, string> = {
  COMMITTED: "Sẵn sàng nhận cược",
  AWAITING_STAKE: "Chờ thanh toán cược",
  PLAYING: "Đang chơi",
  WON: "Đã chốt thưởng",
  LOST: "Trúng mìn",
  CANCELLED: "Đã hủy",
};
export default function Home() {
  const { account, error: accountError } = useWalletAccount();
  const [state, setState] = useState<State | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [stake, setStake] = useState("10"),
    [seed, setSeed] = useState(""),
    [verified, setVerified] = useState("");
  const [selected, setSelected] = useState(""),
    [setup, setSetup] = useState<Setup | null>(null),
    [peer, setPeer] = useState(""),
    [house, setHouse] = useState("");
  const [password, setPassword] = useState(""),
    [pubkey, setPubkey] = useState(""),
    [address, setAddress] = useState(""),
    [nodeStatus, setNodeStatus] = useState("Chưa khởi động");
  const [channelAmount, setChannelAmount] = useState("499"),
    [channels, setChannels] = useState(""),
    [playerPayment, setPlayerPayment] = useState("");
  const [houseLiquidityInvoice, setHouseLiquidityInvoice] = useState("");
  const [houseLiquidityAmount, setHouseLiquidityAmount] = useState("352.9");
  const node = useRef<FiberBrowserNode | null>(null);
  const roundChannel = useRef<RoundChannel | null>(null);
  const [channelState, setChannelState] = useState("Not opened");
  const setupPanel = useRef<HTMLDetailsElement | null>(null);
  const [nodeReady, setNodeReady] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const refreshWallet = useCallback(async () => {
    if (!node.current)
      throw new Error("Thiết lập Fiber payments trước khi chơi CKB Testnet.");
    try {
      const result = await node.current.listChannels({ include_closed: true });
      const selected = result.channels.filter(
        (channel) => channel.channel_id === roundChannel.current?.channelId,
      );
      const balance = walletBalance(selected);
      setChannelState(selected[0]?.state.state_name || "Not opened");
      setAvailableBalance(balance);
      setBalanceError("");
      return balance;
    } catch (e) {
      setAvailableBalance(null);
      setBalanceError("Không đọc được số dư ví. Hãy thử làm mới.");
      throw e;
    }
  }, []);
  useEffect(() => {
    if (!nodeReady) return;
    const timer = setInterval(() => {
      void refreshWallet().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [nodeReady, refreshWallet]);
  const current =
    state?.rounds.find((r) =>
      ["COMMITTED", "AWAITING_STAKE", "PLAYING"].includes(r.game),
    ) || state?.rounds[0];
  useEffect(() => {
    if (current?.game !== "COMMITTED" || seed) return;
    setSeed(
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join(""),
    );
  }, [current?.id, current?.game, seed]);
  const detail = state?.rounds.find((r) => r.id === selected) || current;
  const playing = current?.game === "PLAYING",
    ended = current && ["WON", "LOST", "CANCELLED"].includes(current.game);
  async function refresh() {
    const res = await fetch("/api/game", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setState(data);
  }
  useEffect(() => {
    let alive = true;
    fetch("/api/game", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (alive) setState(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      if (node.current) await refreshWallet().catch(() => {});
      setBusy(false);
    }
  }
  async function command(action: string, fields: Record<string, unknown> = {}) {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...fields }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.rounds) setState(data);
    return data;
  }
  const act = (action: string, fields: Record<string, unknown> = {}) =>
    task(async () => {
      await command(action, fields);
      setVerified("");
    });
  async function begin() {
    await task(async () => {
      if (state?.mode === "fiber" && !nodeReady) {
        setWalletOpen(true);
        throw new Error("Thiết lập Fiber payments trước khi chơi CKB Testnet.");
      }
      if (state?.mode === "fiber" && !account)
        throw new Error("Connect your CKB Testnet wallet first.");
      await command("commit");
      setSelected("");
      setVerified("");
      setSeed(
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join(""),
      );
    });
  }
  async function setupHouse() {
    const data = await command("setup");
    setSetup(data.setup);
    setPeer(data.peer);
    setHouse(data.house);
    return data;
  }
  async function createHouseLiquidityInvoice() {
    await task(async () => {
      const result = await command("create-house-liquidity-invoice", {
        amount: houseLiquidityAmount,
      });
      const invoice = String(result.invoice || "");
      if (!invoice) throw new Error("HOUSE did not return an invoice.");
      setHouseLiquidityInvoice(invoice);
      setPlayerPayment(
        `HOUSE invoice created for ${houseLiquidityAmount} CKB. It expires in 1 hour.`,
      );
    });
  }
  async function preparePlayer() {
    const { startPlayer } = await import("../lib/player-node");
    const result = await startPlayer(password);
    node.current = result.node;
    setNodeReady(true);
    setPubkey(result.pubkey);
    setAddress(result.address);
    if (account)
      roundChannel.current = loadRoundChannel(result.pubkey, account.address);
    setNodeStatus("Node Testnet đang chạy · IndexedDB");
    setPassword("");
    await refreshWallet();
  }
  async function prepareRoundChannel() {
    await task(async () => {
      if (!account) throw new Error("Connect a CKB Testnet wallet first.");
      if (!node.current) throw new Error("Unlock your Fiber node first.");
      const config = await setupHouse();
      if (!config.peer)
        throw new Error("HOUSE has no public WSS peer address configured.");
      await node.current.connectPeer({
        address: config.peer,
        pubkey: publicKey(config.house) as `0x${string}`,
      });
      const player = (await node.current.nodeInfo()).pubkey;
      const wallet = await account.signer.getRecommendedAddress();
      let saved = loadRoundChannel(player, wallet);
      roundChannel.current = saved;
      if (saved) {
        const playerChannels = await node.current.listChannels({ include_closed: true });
        const previousChannel = playerChannels.channels.find(
          (channel) => channel.channel_id === saved?.channelId,
        );
        const previousStatus = previousChannel?.state.state_name || "Not found";
        setChannelState(previousStatus);
        const normalizedStatus = previousStatus.toLowerCase();
        if (
          normalizedStatus.includes("shutting_down") ||
          normalizedStatus.includes("shuttingdown") ||
          normalizedStatus.includes("closing")
        )
          throw new Error(
            "Kênh PLAYER đang SHUTTING_DOWN. Không thể mở lại hoặc ký giao dịch cấp vốn cho kênh này. Hãy đợi settlement và giao dịch đóng được xác nhận, rồi mới tạo round channel mới.",
          );

        const previousSettlement = state?.rounds.find(
          (round) => round.settlement?.channelId === saved?.channelId,
        )?.settlement;
        if (previousSettlement && previousSettlement.closeStatus !== "confirmed")
          throw new Error(
            "Round channel cũ chưa settlement xong. Hoàn tất claim/đóng kênh và chờ CKB xác nhận trước khi tạo kênh mới.",
          );
        if (previousSettlement?.closeStatus === "confirmed") {
          if (previousChannel && !["CLOSED", "Closed"].includes(previousStatus))
            throw new Error(
              `Settlement đã xác nhận nhưng PLAYER vẫn báo kênh ${previousStatus}. Làm mới trạng thái kênh; chưa tạo kênh mới.`,
            );
          archiveRoundChannel(player, wallet, saved.channelId);
          saved = null;
          roundChannel.current = null;
          setChannelState("Not opened");
        } else if (
          !previousSettlement && previousChannel && ["CLOSED", "Closed"].includes(previousStatus)
        ) {
          throw new Error(
            "Kênh cũ đã CLOSED nhưng không tìm thấy settlement tương ứng trong lịch sử ứng dụng. Khôi phục/đối soát round cũ trước khi tạo kênh mới.",
          );
        }
      }
      if (saved && !saved.fundingTxHash) {
        const record = await openRoundChannel(
          node.current,
          account.signer,
          config.house,
          channelAmount,
          config.setup.channels,
        );
        roundChannel.current = record;
        setChannels(`Signing and submitting funding for ${record.channelId}.`);
        await refreshWallet();
        return;
      }
      let fundingStatus: string | undefined;
      if (saved?.fundingTxHash) {
        const checked = await command("funding-status", {
          txHash: saved.fundingTxHash,
        });
        fundingStatus = String(checked.status || "unknown");
        if (fundingStatus !== "rejected") {
          setChannels(`Previous funding transaction ${fundingStatus}; waiting for its channel state.`);
          throw new Error("The existing funding transaction is not rejected; do not create another channel.");
        }
      }
      const record = await prepareRoundChannelFunding(
        node.current,
        account.signer,
        config.house,
        channelAmount,
        config.setup.channels,
        fundingStatus,
      );
      roundChannel.current = record;
      setChannels(
        `Unsigned funding transaction prepared for ${record.channelId}. Click again to sign it in your CKB wallet.`,
      );
      await refreshWallet();
    });
  }
  async function payHouseLiquidity() {
    await task(async () => {
      if (!node.current || !nodeReady)
        throw new Error("Unlock the PLAYER Fiber node first.");
      if (!account) throw new Error("Connect the CKB Testnet wallet first.");
      const config = await setupHouse();
      const expected = parseCkb(houseLiquidityAmount);
      if (expected <= 0n) throw new Error("Enter a positive CKB amount.");
      const parsed = await node.current.parseInvoice({
        invoice: houseLiquidityInvoice.trim(),
      });
      const invoice = parsed.invoice;
      if (
        invoice.currency !== "Fibt" ||
        !invoice.amount ||
        BigInt(invoice.amount) !== expected
      )
        throw new Error("Invoice must be a CKB Testnet invoice for the exact amount entered.");
      const payee = invoice.data.attrs.find((attr) => "payee_public_key" in attr);
      if (
        !payee ||
        !("payee_public_key" in payee) ||
        publicKey(payee.payee_public_key) !== publicKey(config.house)
      )
        throw new Error("Invoice recipient is not the configured HOUSE node.");
      const expiry = invoice.data.attrs.find((attr) => "expiry_time" in attr);
      if (
        !expiry ||
        !("expiry_time" in expiry) ||
        BigInt(invoice.data.timestamp) + BigInt(expiry.expiry_time) * 1000n <=
          BigInt(Date.now())
      )
        throw new Error("HOUSE invoice is expired or has no expiry.");
      const available = await refreshWallet();
      const required = expected + STAKE_FEE_RESERVE;
      if (available < required)
        throw new Error(
          `PLAYER round channel has ${formatCkb(available)} CKB outbound; this payment needs ${formatCkb(required)} CKB including the 0.1 CKB fee reserve.`,
        );
      const paymentKey = `fiber-mines-house-liquidity:${invoice.data.payment_hash}`;
      const previous = localStorage.getItem(paymentKey);
      const result = previous
        ? await node.current.getPayment({
            payment_hash: invoice.data.payment_hash as `0x${string}`,
          })
        : await (async () => {
            localStorage.setItem(paymentKey, "sending");
            return node.current!.sendPayment({
              invoice: houseLiquidityInvoice.trim(),
              max_fee_amount: "0x989680",
            });
          })();
      localStorage.setItem(paymentKey, result.status);
      setPlayerPayment(
        `PLAYER → HOUSE liquidity: ${result.status} · ${houseLiquidityAmount} CKB · fee ${formatCkb(BigInt(result.fee))} CKB`,
      );
      const updated = await setupHouse();
      setChannels(JSON.stringify(updated.setup.channels));
      if (result.status !== "Success")
        throw new Error(`Liquidity payment status is ${result.status}; do not send it again. Check payment by hash.`);
    });
  }
  async function startRound() {
    if (!current || !state) return;
    await task(async () => {
      const clientSeed =
        seed ||
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
          v.toString(16).padStart(2, "0"),
        ).join("");
      if (!seed) setSeed(clientSeed);
      const amount = parseCkb(stake);
      const maximum = parseCkb(state.maxStake);
      if (amount <= 0n) throw new Error("Enter a positive stake amount.");
      if (amount > maximum)
        throw new Error(`The maximum stake is ${state.maxStake} CKB.`);
      let balance: bigint;
      if (state.mode === "fiber") {
        if (!roundChannel.current)
          throw new Error(
            "No PLAYER round channel is open. Open a channel in Fiber Testnet setup first.",
          );
        if (
          !account ||
          roundChannel.current.walletAddress !== account.address
        )
          throw new Error("Connect the wallet that funded this round channel.");
        if (!node.current)
          throw new Error("Unlock the PLAYER Fiber node first.");
        const result = await node.current.listChannels({
          include_closed: true,
        });
        const channel = result.channels.find(
          (item) => item.channel_id === roundChannel.current?.channelId,
        );
        const channelStatus = channel?.state.state_name || "Not opened";
        setChannelState(channelStatus);
        balance = channel ? walletBalance([channel]) : 0n;
        setAvailableBalance(balance);
        const normalizedChannelStatus = channelStatus.toLowerCase();
        if (
          normalizedChannelStatus.includes("shutting_down") ||
          normalizedChannelStatus.includes("shuttingdown") ||
          normalizedChannelStatus.includes("closing")
        )
          throw new Error(
            "Kênh PLAYER cũ đang đóng (SHUTTING_DOWN), không thể mở lại. Chờ settlement/đóng kênh hoàn tất và xác nhận xong, rồi mở một round channel mới trong Thiết lập Fiber Testnet.",
          );
        if (["CLOSED", "Closed"].includes(channelStatus))
          throw new Error(
            "Kênh round trước đã đóng. Hãy mở một round channel mới trong Thiết lập Fiber Testnet rồi kiểm tra liquidity.",
          );
        if (
          !channel ||
          !["CHANNEL_READY", "ChannelReady"].includes(channelStatus)
        )
          throw new Error(
            `PLAYER round channel is ${channelStatus}. Open it, sign the funding transaction, and wait for CHANNEL_READY before starting.`,
          );
        const required = amount + STAKE_FEE_RESERVE;
        if (balance < required)
          throw new Error(
            `PLAYER round channel has ${formatCkb(balance)} CKB outbound; this ${stake} CKB stake needs ${formatCkb(required)} CKB including the 0.1 CKB fee reserve. Open/rebalance the channel, then check liquidity again.`,
          );
      } else {
        balance = BigInt(state.balance || "0");
        if (amount > balance)
          throw new Error(
            `The demo balance is ${formatCkb(balance)} CKB; the stake is ${stake} CKB.`,
          );
      }
      const data = await command("start", {
        id: current.id,
        stake,
        clientSeed,
        recipient: pubkey,
        channelId: roundChannel.current?.channelId,
        walletAddress: account?.address,
      });
      if (state.mode === "fiber") {
        const created = (data.rounds as Round[]).find(
          (round) => round.id === current.id,
        );
        if (created?.invoice) await payStake(created);
      }
      setVerified("");
    });
  }
  async function payStake(target?: Round) {
    const r = target || current;
    if (!node.current || !r) throw new Error("Khởi động node PLAYER trước.");
    const parsed = await node.current.parseInvoice({
      invoice: r.invoice,
    });
    if (
      parsed.invoice.currency !== "Fibt" ||
      !parsed.invoice.amount ||
      BigInt(parsed.invoice.amount) !== BigInt(r.stake) ||
      parsed.invoice.data.payment_hash !== r.stakeHash
    )
      throw new Error("Invoice cược không khớp ván.");
    let result;
    // Persist the hash BEFORE sending; unknown attempts are only reconciled on reload.
    const key = `fiber-mines-stake:${r.id}`;
    if (localStorage.getItem(key))
      result = await node.current.getPayment({
        payment_hash: r.stakeHash as `0x${string}`,
      });
    else {
      if ((await refreshWallet()) < BigInt(r.stake) + STAKE_FEE_RESERVE)
        throw new Error("Số dư ví không đủ cho cược và dự phòng phí 0.1 CKB.");
      localStorage.setItem(key, r.stakeHash);
      result = await node.current.sendPayment({
        invoice: r.invoice,
        max_fee_amount: "0x989680",
      });
    }
    setPlayerPayment(
      `PLAYER payer: ${result.status} · Phí ${formatCkb(BigInt(result.fee))} CKB`,
    );
    await command("check", { id: r.id });
  }
  async function receivePayout(r: Round) {
    if (!node.current)
      throw new Error("Khởi động lại node PLAYER bằng cùng mật khẩu.");
    if (r.payoutHash) {
      await command("check", { id: r.id });
    } else {
      const key = `fiber-mines-payout:${r.id}`;
      let invoice = localStorage.getItem(key);
      if (!invoice) {
        const result = await node.current.newInvoice({
          amount: `0x${BigInt(r.payout).toString(16)}`,
          currency: "Fibt",
          description: `Fiber Mines payout ${r.id}`,
          expiry: "0xe10",
        });
        invoice = result.invoice_address;
        localStorage.setItem(key, invoice);
      }
      await command("pay", { id: r.id, invoice });
    }
    await refresh();
    const invoice = localStorage.getItem(`fiber-mines-payout:${r.id}`);
    if (invoice) {
      const parsed = await node.current.parseInvoice({ invoice });
      const receiver = await node.current.getInvoice({
        payment_hash: parsed.invoice.data.payment_hash,
      });
      setPlayerPayment(
        `PLAYER receiver: ${receiver.status} · Hash ${receiver.invoice.data.payment_hash}`,
      );
    }
  }
  let preview = "0";
  const onStakeTick = useEffectEvent(() => {
    if (busy || !current) return;
    void command("check", { id: current.id }).catch((error: unknown) =>
      setError(
        error instanceof Error
          ? error.message
          : "Could not reconcile stake payment.",
      ),
    );
  });
  useEffect(() => {
    if (state?.mode !== "fiber" || current?.game !== "AWAITING_STAKE") return;
    const timer = setInterval(onStakeTick, 4000);
    return () => clearInterval(timer);
  }, [state?.mode, current?.id, current?.game]);
  const playBalance =
    state?.mode === "fiber"
      ? account && roundChannel.current?.walletAddress === account.address
        ? availableBalance
        : null
      : state?.balance
        ? BigInt(state.balance)
        : null;
  const maxPlayable =
    playBalance === null || !state
      ? 0n
      : affordableStake(
          playBalance,
          parseCkb(state.maxStake),
          state.mode === "fiber",
        );
  try {
    preview = payout(parseCkb(stake), 1, state?.edge).toString();
  } catch {}
  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">✦</span> FIBER<span>MINES</span>
        </Link>
        <div className="network">
          <i />{" "}
          {state?.mode === "fiber"
            ? "CKB Testnet"
            : "Demo credits — no real CKB"}
        </div>
        <span className="week">WEEK 08 / TESTNET ARCADE</span>
        <ExternalWallet onSetup={() => setWalletOpen(true)} />
      </header>
      <button
        className="fiber-setup-toggle"
        disabled={!state || busy}
        aria-expanded={walletOpen}
        aria-controls="wallet-panel"
        onClick={() => setWalletOpen(!walletOpen)}
      >
        {nodeReady ? "◈ Fiber ready" : "Set up Fiber payments"}
      </button>
      {walletOpen && (
        <section
          id="wallet-panel"
          className="panel wallet-panel"
          aria-label="Round channel setup"
        >
          <h2>Round channel · CKB Testnet</h2>
          <p>
            Your external wallet holds your funds and signs channel funding.
            Unlock the local Fiber identity to run your round channel. Reuse its
            password and this browser profile after reload.
          </p>
          <p className="muted">
            If Fiber cannot start in this browser,{" "}
            <a href="/compat">open compatibility mode</a> and use an extension
            wallet. Modern Chromium supports popup wallets on the main page.
          </p>
          {!nodeReady ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void task(preparePlayer);
              }}
            >
              <label htmlFor="wallet-password">
                Fiber identity password · at least 10 characters
              </label>
              <input
                id="wallet-password"
                type="password"
                autoComplete="off"
                minLength={10}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              <button className="primary" disabled={busy}>
                {busy ? "Đang kết nối…" : "Unlock Fiber node"}
              </button>
            </form>
          ) : (
            <>
              <p role="status">
                Đã kết nối · {pubkey.slice(0, 12)}…{pubkey.slice(-8)}
              </p>
              <label>Local Fiber identity · public key</label>
              <code className="break">{pubkey}</code>
              <p>
                Số dư kênh khả dụng:{" "}
                {availableBalance === null ? "—" : formatCkb(availableBalance)}{" "}
                CKB
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  task(async () => {
                    await refreshWallet();
                  })
                }
              >
                Làm mới số dư
              </button>
              <a
                href="#fiber-setup"
                onClick={() => {
                  if (setupPanel.current) setupPanel.current.open = true;
                }}
              >
                Thiết lập kênh Fiber →
              </a>
            </>
          )}
          <p className="muted">
            Play uses CKB in a ready Fiber channel. Your wallet signs funding
            directly; after the round, cooperative close returns funds to the
            same wallet. HOUSE must provide the channel liquidity needed for
            rewards.
          </p>
          {nodeReady && (
            <div className="round-channel-setup">
              <label htmlFor="round-channel-capacity">
                Round channel funding · CKB Testnet
              </label>
              <input
                id="round-channel-capacity"
                inputMode="decimal"
                value={channelAmount}
                onChange={(event) => setChannelAmount(event.target.value)}
                disabled={busy}
              />
              <button
                className="primary"
                disabled={busy || !account}
                onClick={prepareRoundChannel}
              >
                {roundChannel.current && !roundChannel.current.fundingTxHash
                  ? "Sign prepared funding transaction"
                  : "Prepare round channel funding"}
              </button>
              <p>
                Your wallet signs the funding transaction and receives the
                channel return address. Each round uses a fresh channel and
                closes after play. HOUSE must supply return liquidity.
              </p>
              <p role="status">Channel: {channelState}</p>
              {channelState.toLowerCase().includes("shutting_down") ||
              channelState.toLowerCase().includes("shuttingdown") ||
              channelState.toLowerCase().includes("closing") ? (
                <p role="alert">
                  Kênh đang đóng. Không ký funding và không mở lại kênh này; chờ settlement được xác nhận rồi tạo kênh mới.
                </p>
              ) : null}
            </div>
          )}
          {state?.mode === "mock" && (
            <p>
              App đang ở chế độ demo: cược dùng demo credits. Để chơi bằng ví,
              cấu hình PAYMENT_MODE=fiber và HOUSE node rồi khởi động lại
              server.
            </p>
          )}
        </section>
      )}
      <section className="intro">
        <div>
          <p className="eyebrow">CKB TESTNET ARCADE / SEASON 08</p>
          <h1>
            MINE<span>RUN</span>
            <span className="title-spark">✦</span>
          </h1>
          <p>Find the gems. Dodge the mines. Bring your CKB home.</p>
        </div>
        <div className="run-info">
          <span>THE PERFECT RUN</span>
          <strong>
            {multiplier(7, state?.edge)}
            <small>×</small>
          </strong>
          <p>7 safe picks · cash out anytime</p>
        </div>
      </section>
      <section className="wallet-strip" aria-label="Game balances">
        <div>
          <span>WALLET · ON-CHAIN</span>
          <strong>
            {account ? formatCkb(account.balance) : "—"}
            <small> CKB</small>
          </strong>
          <p>
            {account
              ? `${account.address.slice(0, 10)}…${account.address.slice(-6)}`
              : "Connect your Testnet wallet"}
          </p>
        </div>
        <div>
          <span>
            {state?.mode === "mock"
              ? "PRACTICE CREDITS"
              : "ROUND CHANNEL · PLAYABLE"}
          </span>
          <strong>
            {playBalance === null ? "—" : formatCkb(playBalance)}
            <small> {state?.mode === "mock" ? "credits" : "CKB"}</small>
          </strong>
          <p>
            {state?.mode === "mock"
              ? "No real funds in practice mode"
              : channelState}
          </p>
        </div>
        <div>
          <span>RETURN TO WALLET · PENDING</span>
          <strong>
            {formatCkb(
              state?.rounds.reduce(
                (sum, round) =>
                  sum +
                  (round.settlement?.walletAddress === account?.address &&
                  round.settlement?.closeStatus === "pending"
                    ? BigInt(round.settlement.returnedAmount || "0")
                    : 0n),
                0n,
              ) || 0n,
            )}
            <small> CKB</small>
          </strong>
          <p>Waiting for CKB inclusion · counted separately</p>
        </div>
      </section>
      {accountError && (
        <div className="alert" role="alert">
          {accountError}
        </div>
      )}
      {balanceError && (
        <div className="alert" role="status">
          {balanceError}
        </div>
      )}
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      {state?.setupError && (
        <div role="alert" className="alert">
          {state.setupError}
        </div>
      )}
      {!state ? (
        <div className="panel loading">
          Đang tải session…{" "}
          <button onClick={() => task(refresh)}>Thử lại</button>
        </div>
      ) : (
        <>
          <section className="game-layout">
            <aside className="panel controls">
              <div className="panel-heading">
                <span className="step">01</span>
                <h2>Đặt cược của bạn</h2>
              </div>
              <label htmlFor="stake">
                Số tiền cược{" "}
                <span>{state.mode === "mock" ? "DEMO" : "CKB"}</span>
              </label>
              <div className="stake-input">
                <input
                  id="stake"
                  inputMode="decimal"
                  value={stake}
                  disabled={
                    busy || !!playing || current?.game === "AWAITING_STAKE"
                  }
                  onChange={(e) => setStake(e.target.value)}
                />
                <b>◈</b>
              </div>
              <div className="quick-stakes">
                {["1", "10", "25", "100"].map((n) => (
                  <button
                    key={n}
                    disabled={
                      busy || !!playing || current?.game === "AWAITING_STAKE"
                    }
                    onClick={() => setStake(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                disabled={
                  busy ||
                  !!playing ||
                  current?.game === "AWAITING_STAKE" ||
                  maxPlayable <= 0n
                }
                onClick={() => setStake(formatCkb(maxPlayable))}
              >
                Dùng số dư · Max {formatCkb(maxPlayable)}
              </button>
              <div className="rules">
                <p>
                  <span>Số mìn</span>
                  <b>2 / 9 ô</b>
                </p>
                <p>
                  <span>House edge</span>
                  <b>{state.edge / 100}%</b>
                </p>
                <p>
                  <span>Cược tối đa</span>
                  <b>{state.maxStake}</b>
                </p>
                <p>
                  <span>Gross sau 1 ô</span>
                  <b className="mint">{formatCkb(preview)}</b>
                </p>
              </div>
              {current?.game === "COMMITTED" ? (
                <>
                  <div className="commit-note">
                    ✓ Đã nhận server commitment. Bây giờ chọn client seed trước
                    khi thanh toán.
                  </div>
                  <label htmlFor="seed">Client seed</label>
                  <input
                    id="seed"
                    value={seed}
                    maxLength={128}
                    onChange={(e) => setSeed(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={startRound}
                  >
                    {busy ? "Đang xử lý…" : "Xác nhận & bắt đầu →"}
                  </button>
                </>
              ) : !playing && current?.game !== "AWAITING_STAKE" ? (
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !!state.setupError ||
                    (state.mode === "fiber" &&
                      !!ended &&
                      !!current?.settlement &&
                      current.settlement.closeStatus !== "confirmed")
                  }
                  onClick={begin}
                >
                  {ended ? "Chơi lại →" : "Bắt đầu →"}
                </button>
              ) : null}
              {playing && (
                <button
                  className="primary"
                  disabled={busy || !current.opened.length}
                  onClick={() => act("cashout", { id: current.id })}
                >
                  Chốt thưởng · {formatCkb(current.gross)}
                </button>
              )}
              {current?.game === "AWAITING_STAKE" && (
                <>
                  <p className="muted">
                    Thanh toán invoice rồi kiểm tra HOUSE Paid để mở bàn.
                  </p>
                  <button
                    className="primary"
                    disabled={busy || !nodeReady || !current.invoice}
                    onClick={() => task(payStake)}
                  >
                    PLAYER trả invoice
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => act("check", { id: current.id })}
                  >
                    Kiểm tra khoản cược
                  </button>
                </>
              )}
              <p className="fee-note">
                Gross gồm cược gốc. Phí{" "}
                {state.mode === "mock"
                  ? "demo: 0."
                  : "routing tách riêng; PLAYER giới hạn 0.1 CKB. HOUSE trả phí payout."}{" "}
                Tối đa 7 ô an toàn; ô thứ 7 tự chốt.
              </p>
            </aside>
            <div className="panel board-panel">
              <div className="board-heading">
                <div>
                  <span className="live-dot" />{" "}
                  {current ? labels[current.game] : "Sẵn sàng khám phá"}
                </div>
                <span>3 × 3 GRID</span>
              </div>
              <div
                className={`round-banner ${ended ? (current?.game === "WON" ? "round-won" : "round-lost") : ""}`}
                role="status"
              >
                <span>
                  {playing
                    ? "EXPEDITION LIVE"
                    : ended
                      ? current?.game === "WON"
                        ? "TREASURE SECURED"
                        : current?.game === "LOST"
                          ? "MINE HIT"
                          : "ROUND CANCELLED"
                      : "YOUR NEXT DISCOVERY AWAITS"}
                </span>
                <strong>
                  {playing
                    ? `${current?.safeCount || 0} / 7 GEMS`
                    : ended
                      ? `${formatCkb(current?.gross || "0")} ${state.mode === "mock" ? "CREDITS" : "CKB"}`
                      : "7 GEMS. 2 MINES."}
                </strong>
              </div>
              <div className="board" aria-label="Bàn mìn 3 nhân 3">
                {Array.from({ length: 9 }, (_, i) => {
                  const opened = current?.opened.includes(i),
                    mine = ended && current?.mines?.includes(i);
                  return (
                    <button
                      key={i}
                      aria-label={`Ô ${i + 1}${mine ? ", mìn" : opened ? ", an toàn" : ", chưa mở"}`}
                      disabled={busy || !playing || !!opened}
                      className={`tile ${mine ? "mine" : opened ? "safe" : ""}`}
                      onClick={() =>
                        act("reveal", { id: current?.id, cell: i })
                      }
                    >
                      <span aria-hidden="true">
                        {mine ? (
                          <svg viewBox="0 0 80 80" className="mine-icon">
                            <path
                              d="M40 8v64M8 40h64M17 17l46 46M17 63l46-46"
                              stroke="currentColor"
                              strokeWidth="6"
                            />
                            <circle cx="40" cy="40" r="22" fill="#ff6687" />
                            <circle cx="33" cy="32" r="7" fill="#ffd1dc" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 80 80"
                            className={`gem-icon ${opened ? "revealed-gem" : "hidden-gem"}`}
                          >
                            <path
                              d="M20 14h40L75 34 40 72 5 34Z"
                              fill="currentColor"
                            />
                            <path
                              d="M20 14 28 34 40 72 5 34Z"
                              fill="#fff"
                              opacity=".18"
                            />
                            <path
                              d="M60 14 52 34 40 72 75 34Z"
                              fill="#000"
                              opacity=".25"
                            />
                            <path
                              d="M20 14 40 9 60 14 52 34H28Z"
                              fill="#fff"
                              opacity=".35"
                            />
                            <path
                              d="M5 34h70M28 34l12-25 12 25"
                              stroke="#fff"
                              strokeOpacity=".22"
                              strokeWidth="1.5"
                            />
                          </svg>
                        )}
                      </span>
                      <small>{String(i + 1).padStart(2, "0")}</small>
                    </button>
                  );
                })}
              </div>
              <div className="board-footer">
                <span>
                  ◆ <b>{current?.safeCount || 0}</b> / 7 an toàn
                </span>
                <span>✹ 2 mìn ẩn</span>
                <span>⌨ Tab + Enter</span>
              </div>
              <div className="stats">
                <div>
                  <span>Multiplier hiện tại</span>
                  <strong>
                    {current?.multiplier || "1"}
                    <em>×</em>
                  </strong>
                </div>
                <div>
                  <span>Ô an toàn tiếp theo</span>
                  <strong className="mint">
                    {ended
                      ? "—"
                      : current?.nextMultiplier || multiplier(1, state.edge)}
                    <em>×</em>
                  </strong>
                </div>
                <div>
                  <span>Gross payout</span>
                  <strong>{formatCkb(current?.gross || "0")}</strong>
                </div>
                <div>
                  <span>Profit trước phí</span>
                  <strong>
                    {current &&
                    ["PLAYING", "WON", "LOST"].includes(current.game)
                      ? formatCkb(BigInt(current.gross) - BigInt(current.stake))
                      : "0"}
                  </strong>
                </div>
              </div>
            </div>
          </section>
          <SettlementPanel
            key={current?.id || "new"}
            round={current}
            node={node.current}
            command={command}
            claim={async () => {
              if (current) await receivePayout(current);
            }}
            demo={state.mode === "mock"}
          />
          <section className="ladder" aria-label="Bảng multiplier">
            {[1, 2, 3, 4, 5, 6, 7].map((k) => (
              <div
                className={
                  current?.opened.length === k && current.game !== "LOST"
                    ? "reached"
                    : ""
                }
                key={k}
              >
                <span>{k} ô an toàn</span>
                <b>{multiplier(k, state.edge)}×</b>
              </div>
            ))}
          </section>
          <section className="bottom-grid">
            <div className="panel history">
              <div className="panel-heading">
                <span className="step">02</span>
                <h2>Lịch sử ván</h2>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => task(refresh)}
                >
                  ↻ Làm mới
                </button>
              </div>
              {!state.rounds.length ? (
                <div className="empty">
                  Chưa có ván nào. Bắt đầu hành trình với 10 credits.
                </div>
              ) : (
                <div className="history-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Ván</th>
                        <th>Cược</th>
                        <th>Kết quả</th>
                        <th>Gross</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.rounds.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => {
                            setSelected(r.id);
                            setVerified("");
                          }}
                        >
                          <td>
                            <button
                              className="text-button"
                              onClick={() => {
                                setSelected(r.id);
                                setVerified("");
                              }}
                            >
                              #{r.id.slice(0, 6)}
                            </button>
                          </td>
                          <td>{formatCkb(r.stake)}</td>
                          <td>
                            <span className={`status ${r.game.toLowerCase()}`}>
                              {labels[r.game]}
                              {r.payment === "PAYOUT_PENDING" && (
                                <small> · PAYOUT_PENDING</small>
                              )}
                            </span>
                          </td>
                          <td className={r.game === "WON" ? "mint" : ""}>
                            {formatCkb(r.payout)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="panel fairness">
              <div className="panel-heading">
                <span className="step">03</span>
                <h2>Kiểm chứng ván</h2>
                <span className="shield">◇</span>
              </div>
              <p className="muted">
                Commit trước cược. Reveal sau ván. Tự kiểm tra bàn bằng Web
                Crypto độc lập.
              </p>
              {detail ? (
                <>
                  <label>SHA-256 commitment</label>
                  <code>{detail.commitment}</code>
                  <details>
                    <summary>
                      Chi tiết seed & thanh toán · #{detail.id.slice(0, 6)}
                    </summary>
                    <dl>
                      <dt>Client seed</dt>
                      <dd>{detail.clientSeed || "Chưa chọn"}</dd>
                      <dt>Nonce</dt>
                      <dd>{detail.nonce}</dd>
                      <dt>Server seed</dt>
                      <dd>
                        {detail.serverSeed || "Được giữ kín đến cuối ván"}
                      </dd>
                      <dt>Game / Payment</dt>
                      <dd>
                        {detail.game} / {detail.payment}
                      </dd>
                      <dt>Stake hash</dt>
                      <dd>{detail.stakeHash || "—"}</dd>
                      <dt>HOUSE receiver / payer</dt>
                      <dd>
                        {detail.receiverStatus || "—"} /{" "}
                        {detail.payerStatus || "—"}
                      </dd>
                      <dt>Stake invoice</dt>
                      <dd>{detail.invoice || "—"}</dd>
                      <dt>Invoice expiry</dt>
                      <dd>
                        {detail.expires
                          ? new Date(detail.expires).toLocaleString("vi-VN")
                          : "—"}
                      </dd>
                      <dt>Payout hash</dt>
                      <dd>{detail.payoutHash || "—"}</dd>
                      <dt>Phí payout HOUSE</dt>
                      <dd>{formatCkb(detail.fee || "0")}</dd>
                    </dl>
                  </details>
                  {detail.error && <p className="alert">{detail.error}</p>}
                  {detail.payment === "PAYOUT_PENDING" && (
                    <>
                      <p className="mint">
                        Khoản phải trả: {formatCkb(detail.payout)} ·
                        PAYOUT_PENDING
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          state.mode === "mock"
                            ? act("pay", { id: detail.id })
                            : task(() => receivePayout(detail))
                        }
                      >
                        Nhận thưởng / đối soát
                      </button>
                    </>
                  )}
                  {detail.game === "AWAITING_STAKE" && (
                    <button
                      disabled={busy}
                      onClick={() => act("check", { id: detail.id })}
                    >
                      Kiểm tra lại stake
                    </button>
                  )}
                  {detail.serverSeed && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        task(async () => {
                          const v = await verifyBoard(
                            detail.serverSeed!,
                            detail.clientSeed,
                            detail.nonce,
                            detail.commitment,
                          );
                          setVerified(
                            v.valid &&
                              JSON.stringify(v.mines) ===
                                JSON.stringify(detail.mines)
                              ? `✓ Hợp lệ · Mìn ở ô ${v.mines.map((n) => n + 1).join(", ")}`
                              : "✕ Không khớp",
                          );
                        })
                      }
                    >
                      Kiểm chứng seed & bàn →
                    </button>
                  )}
                  <p className="mint" role="status">
                    {verified}
                  </p>
                </>
              ) : (
                <div className="empty">
                  Commitment sẽ xuất hiện khi bạn bắt đầu.
                </div>
              )}
            </div>
          </section>
          {detail && detail.id !== current?.id && (
            <SettlementPanel
              key={`history-${detail.id}`}
              round={detail}
              node={node.current}
              command={command}
              claim={async () => {
                await receivePayout(detail);
              }}
              demo={state.mode === "mock"}
              autoClaim={false}
            />
          )}
        </>
      )}
      <details id="fiber-setup" ref={setupPanel} className="panel setup">
        <summary>
          ⚡ Thiết lập Fiber Testnet <span>Node · Channel · Liquidity</span>
        </summary>
        <p>
          Chỉ Testnet. HOUSE cần node backend và kênh có vốn hai chiều. Ví
          on-chain không đồng nghĩa với liquidity kênh. Đổi PAYMENT_MODE trong
          .env.local và restart để chơi Fiber.
        </p>
        <button disabled={busy} onClick={() => task(setupHouse)}>
          Kiểm tra HOUSE node
        </button>
        {setup && (
          <>
            <p>
              Node {setup.version} · {setup.peers} peer ·{" "}
              {setup.channels.length} channel
            </p>
            <code>{setup.pubkey}</code>
            <p>
              HOUSE → PLAYER: {formatCkb(setup.outbound)} CKB · PLAYER → HOUSE:{" "}
              {formatCkb(setup.inbound)} CKB
            </p>
            <code>{JSON.stringify(setup.channels)}</code>
            <label>Địa chỉ cấp vốn HOUSE (CKB Testnet)</label>
            <code>{setup.fundingAddress}</code>
          </>
        )}
        <div className="setup-fields">
          <label>
            Mật khẩu node PLAYER (dẫn xuất identity tại browser)
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy} onClick={() => task(preparePlayer)}>
            Khởi động / mở khóa PLAYER
          </button>
        </div>
        <p>{nodeStatus}</p>
        {pubkey && <code>PLAYER {pubkey}</code>}
        {address && (
          <>
            <p>Địa chỉ cấp vốn PLAYER (CKB Testnet):</p>
            <code>{address}</code>
          </>
        )}
        <label>
          Peer WSS HOUSE
          <input
            value={peer}
            onChange={(e) => setPeer(e.target.value)}
            placeholder="/dns4/…/tcp/443/wss/p2p/…"
          />
        </label>
        <label>
          Pubkey HOUSE
          <input value={house} onChange={(e) => setHouse(e.target.value)} />
        </label>
        <button
          disabled={busy || !nodeReady}
          onClick={() =>
            task(async () => {
              await node.current!.connectPeer({
                address: peer,
                pubkey: publicKey(house) as `0x${string}`,
              });
              setNodeStatus("Đã kết nối peer HOUSE");
            })
          }
        >
          Kết nối peer
        </button>
        <label>
          Vốn kênh PLAYER (CKB)
          <input
            inputMode="decimal"
            value={channelAmount}
            onChange={(e) => setChannelAmount(e.target.value)}
          />
        </label>
        <div className="round-channel-setup">
          <p>
            Rebalance the ready channel by paying a HOUSE invoice from PLAYER.
            For a 10 CKB test stake, 352.9 CKB covers the 352.8 CKB maximum
            payout plus the configured 0.1 CKB fee reserve.
          </p>
          <p className="muted">
            Thứ tự mở kênh: xử lý settlement cũ trước; bấm chuẩn bị vốn một lần;
            khi nút đổi sang ký giao dịch thì bấm lại và xác nhận trong ví; chờ
            CHANNEL_READY. Sau đó tạo invoice HOUSE mới, thanh toán từ PLAYER và
            kiểm tra liquidity trước khi chơi.
          </p>
          <label>
            HOUSE liquidity amount · CKB
            <input
              inputMode="decimal"
              value={houseLiquidityAmount}
              onChange={(event) => setHouseLiquidityAmount(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            HOUSE Fiber Testnet invoice
            <input
              value={houseLiquidityInvoice}
              onChange={(event) => setHouseLiquidityInvoice(event.target.value)}
              placeholder="fibt1…"
              disabled={busy}
            />
          </label>
          <button disabled={busy} onClick={createHouseLiquidityInvoice}>
            Tạo invoice HOUSE mới (hạn 1 giờ)
          </button>
          <button
            disabled={busy || !nodeReady || !account || !houseLiquidityInvoice.trim()}
            onClick={payHouseLiquidity}
          >
            Pay HOUSE liquidity from PLAYER
          </button>
        </div>
        <button
          disabled={busy || !nodeReady || !account}
          onClick={prepareRoundChannel}
        >
          {roundChannel.current && !roundChannel.current.fundingTxHash
            ? "Sign prepared funding transaction"
            : "Prepare round channel funding"}
        </button>
        <button
          disabled={busy || !nodeReady}
          onClick={() =>
            task(async () => {
              const result = await node.current!.listChannels({ include_closed: true });
              const saved = roundChannel.current;
              const savedChannel = result.channels.find(
                (channel) => channel.channel_id === saved?.channelId,
              );
              setChannelState(savedChannel?.state.state_name || "Not opened");
              setAvailableBalance(savedChannel ? walletBalance([savedChannel]) : 0n);
              setChannels(
                JSON.stringify(
                  result.channels.map((c) => ({
                    id: c.channel_id,
                    state: c.state.state_name,
                    outbound: formatCkb(
                      BigInt(c.local_balance) - BigInt(c.offered_tlc_balance),
                    ),
                    inbound: formatCkb(
                      BigInt(c.remote_balance) - BigInt(c.received_tlc_balance),
                    ),
                  })),
                ),
              );
            })
          }
        >
          Kiểm tra kênh / liquidity PLAYER
        </button>
        <code>{channels || "Chưa đọc trạng thái kênh"}</code>
        <p role="status" className="break">
          {playerPayment}
        </p>
        <p className="muted">
          Giữ mật khẩu và dữ liệu IndexedDB. Không xóa dữ liệu browser khi còn
          tiền/kênh. HOUSE phải cấu hình phần vốn đối ứng để trả thưởng; không
          mở thêm kênh khi giao dịch trước chưa rõ trạng thái.
        </p>
      </details>
      <footer>
        <span>
          FIBER MINES <b>·</b> WEEK08
        </span>
        <p>
          Game Testnet có backend điều hành. Commit/reveal kiểm tra bàn, không
          bảo đảm HOUSE trả tiền.
        </p>
        {state?.mode === "mock" && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => act("reset")}
          >
            ↻ Reset 1,000 demo credits
          </button>
        )}
      </footer>
    </main>
  );
}
