import { createHash, randomBytes, randomUUID } from "node:crypto";
import { board, commit, ALGORITHM } from "./fair";
import { parseCkb, payout, multiplier } from "./money";
import { Store, type Mode, type Round } from "./store";
import { type PaymentAdapter } from "./payments";
import { publicKey } from "./public-key";
import type { RoundSettlement } from "./settlement-types";
export class Game {
  constructor(
    public store: Store,
    public mode: Mode,
    public adapter: PaymentAdapter,
    public budget = parseCkb("100000"),
    public feeBudget = 0n,
  ) {}
  view(r: Round) {
    const ended = ["WON", "LOST", "CANCELLED"].includes(r.game);
    const safeCount = r.opened.length - (r.game === "LOST" ? 1 : 0);
    const {
      id,
      commitment,
      clientSeed,
      nonce,
      stake,
      opened,
      game,
      payment,
      created,
      invoice,
      expires,
      recipient,
      payout: paid,
      payoutHash,
      stakeHash,
      payerStatus,
      receiverStatus,
      fee,
      error,
      edge,
    } = r;
    return {
      id,
      commitment,
      clientSeed,
      nonce,
      stake,
      opened,
      game,
      payment,
      created,
      invoice,
      expires,
      recipient,
      payout: paid,
      payoutHash,
      stakeHash,
      payerStatus,
      receiverStatus,
      fee,
      error,
      edge,
      algorithm: ALGORITHM,
      settlement: r.settlement || null,
      safeCount,
      gross:
        game === "LOST" || game === "CANCELLED"
          ? "0"
          : payout(BigInt(stake), opened.length, edge).toString(),
      multiplier: multiplier(safeCount, edge),
      nextMultiplier:
        !ended && safeCount < 7 ? multiplier(safeCount + 1, edge) : null,
      ...(ended
        ? { serverSeed: r.seed, mines: board(r.seed, r.clientSeed, r.nonce) }
        : {}),
    };
  }
  state(session: string) {
    this.store.session(session);
    return {
      mode: this.mode,
      balance:
        this.mode === "mock" ? this.store.balance(session).toString() : null,
      rounds: this.store.list(session).map((r) => this.view(r)),
      maxStake: process.env.MAX_STAKE_CKB || "100",
      edge: this.edge(),
    };
  }
  edge() {
    const edge = Number(process.env.HOUSE_EDGE_BPS || "200");
    if (!Number.isInteger(edge) || edge < 0 || edge > 1000)
      throw new Error("HOUSE_EDGE_BPS cần nằm trong 0..1000.");
    return edge;
  }
  commit(session: string) {
    return this.store.tx(() => {
      this.store.session(session);
      const active = this.store
        .list(session)
        .find((r) =>
          ["COMMITTED", "AWAITING_STAKE", "PLAYING"].includes(r.game),
        );
      if (active) return this.view(active);
      const seed = randomBytes(32).toString("hex");
      const r: Round = {
        id: randomUUID(),
        session,
        seed,
        commitment: commit(seed),
        clientSeed: "",
        nonce: randomBytes(16).toString("hex"),
        edge: this.edge(),
        stake: "0",
        reserve: "0",
        opened: [],
        game: "COMMITTED",
        payment: "NONE",
        payout: "0",
        created: Date.now(),
        stakeHash: "",
        stakePreimage: "",
        invoice: "",
        expires: 0,
        stakeCreationStarted: false,
        recipient: "",
        payoutInvoice: "",
        payoutHash: "",
        payoutAttempt: "",
        payerStatus: "",
        receiverStatus: "",
        fee: "0",
        error: "",
      };
      this.store.save(r);
      return this.view(r);
    });
  }
  async start(
    session: string,
    id: string,
    amount: string,
    clientSeed: string,
    recipient = "",
    settlement?: RoundSettlement,
  ) {
    const stake = parseCkb(amount);
    if (stake <= 0n || stake > parseCkb(process.env.MAX_STAKE_CKB || "100"))
      throw new Error("Cược ngoài hạn mức.");
    if (!clientSeed || clientSeed.length > 128)
      throw new Error("Client seed cần 1–128 ký tự.");
    if (this.mode === "fiber") recipient = publicKey(recipient);
    const prepared = this.store.tx(() => {
      const r = this.store.get(id, session);
      if (r.game !== "COMMITTED") {
        if (
          r.stake === stake.toString() &&
          r.clientSeed === clientSeed &&
          r.recipient === recipient
        ) {
          if (settlement && r.settlement?.channelId !== settlement.channelId)
            throw new Error("Round channel is already locked.");
          return r;
        }
        throw new Error("Ván đã khóa điều kiện cược.");
      }
      const reserve = payout(stake, 7, r.edge) + this.feeBudget;
      const used = this.store
        .list()
        .reduce((a, x) => a + BigInt(x.reserve), 0n);
      if (this.budget + this.store.houseNet() - used < reserve)
        throw new Error("HOUSE không đủ vốn dự phòng cho ván này.");
      if (this.mode === "mock" && this.store.balance(session) < stake)
        throw new Error("Không đủ demo credits.");
      const preimage = randomBytes(32);
      if (settlement) {
        this.store.claimChannel(settlement.channelId, id);
        r.settlement = settlement;
      }
      Object.assign(r, {
        stake: stake.toString(),
        clientSeed,
        recipient,
        reserve: reserve.toString(),
        game: "AWAITING_STAKE",
        payment: "STAKE_PENDING",
        stakePreimage: `0x${preimage.toString("hex")}`,
        stakeHash: `0x${createHash("sha256").update(preimage).digest("hex")}`,
        expires: Date.now() + 900000,
      });
      this.store.save(r);
      this.store.payment(r, "stake", r.stakeHash, {
        status: "CREATING",
        amount: r.stake,
      });
      return r;
    });
    if (prepared.game !== "AWAITING_STAKE" || prepared.invoice)
      return this.view(prepared);
    const claimed = this.store.tx(() => {
      const r = this.store.get(id, session);
      if (r.stakeCreationStarted) return false;
      r.stakeCreationStarted = true;
      this.store.save(r);
      return true;
    });
    if (!claimed) return this.view(this.store.get(id, session));
    try {
      const invoice = await this.adapter.createStake(prepared);
      this.store.tx(() => {
        const r = this.store.get(id, session);
        r.invoice = invoice;
        r.error = "";
        this.store.save(r);
      });
      if (this.mode === "mock") return await this.checkStake(session, id);
    } catch {
      this.markError(
        id,
        "Không tạo/khôi phục được invoice HOUSE. Kiểm tra node rồi đối soát lại; hash đã được lưu.",
      );
    }
    return this.view(this.store.get(id, session));
  }
  markError(id: string, error: string) {
    this.store.tx(() => {
      const r = this.store.get(id);
      r.error = error;
      this.store.save(r);
    });
  }
  async checkStake(session: string, id: string) {
    let r = this.store.get(id, session);
    if (r.game !== "AWAITING_STAKE") return this.view(r);
    if (!r.invoice) {
      try {
        const invoice = await this.adapter.recoverStake(r);
        this.store.tx(() => {
          r = this.store.get(id, session);
          r.invoice = invoice;
          this.store.save(r);
        });
      } catch {
        this.markError(
          id,
          "Invoice chưa xác định. Giữ reserve; kiểm tra HOUSE RPC và thử đối soát lại.",
        );
        return this.view(this.store.get(id));
      }
    }
    const status = await this.adapter.stakeStatus(r);
    return this.store.tx(() => {
      r = this.store.get(id, session);
      if (r.game !== "AWAITING_STAKE") return this.view(r);
      r.receiverStatus = status;
      this.store.payment(r, "stake", r.stakeHash, { status, amount: r.stake });
      if (status === "Paid") {
        if (this.mode === "mock") {
          const balance = this.store.balance(session);
          if (balance < BigInt(r.stake))
            throw new Error("Không đủ demo credits.");
          this.store.balanceSet(session, balance - BigInt(r.stake));
        }
        this.store.ledger(`${id}:stake`, BigInt(r.stake));
        r.game = "PLAYING";
        r.payment = "STAKE_PAID";
        r.error = "";
      } else if (["Expired", "Cancelled"].includes(status)) {
        r.game = "CANCELLED";
        r.payment = "STAKE_UNPAID";
        r.reserve = "0";
      }
      this.store.save(r);
      return this.view(r);
    });
  }
  reveal(session: string, id: string, cell: number) {
    return this.store.tx(() => {
      const r = this.store.get(id, session);
      if (r.game !== "PLAYING")
        throw new Error("Ván chưa sẵn sàng hoặc đã kết thúc.");
      if (
        !Number.isInteger(cell) ||
        cell < 0 ||
        cell > 8 ||
        r.opened.includes(cell)
      )
        throw new Error("Ô không hợp lệ hoặc đã mở.");
      r.opened.push(cell);
      if (board(r.seed, r.clientSeed, r.nonce).includes(cell)) {
        r.game = "LOST";
        r.payout = "0";
        r.reserve = "0";
        r.payment = "NO_PAYOUT";
      } else if (r.opened.length === 7) this.lockWin(r);
      this.store.save(r);
      return this.view(r);
    });
  }
  lockWin(r: Round) {
    r.game = "WON";
    r.payout = payout(BigInt(r.stake), r.opened.length, r.edge).toString();
    r.payment = "PAYOUT_PENDING";
    r.reserve = (BigInt(r.payout) + this.feeBudget).toString();
  }
  cashout(session: string, id: string) {
    return this.store.tx(() => {
      const r = this.store.get(id, session);
      if (r.game === "WON") return this.view(r);
      if (r.game !== "PLAYING" || r.opened.length < 1)
        throw new Error("Mở ít nhất 1 ô an toàn trước khi chốt.");
      this.lockWin(r);
      this.store.save(r);
      return this.view(r);
    });
  }
  async pay(session: string, id: string, invoice = "") {
    let r = this.store.get(id, session);
    if (r.game !== "WON") throw new Error("Ván chưa có khoản thưởng.");
    if (r.payment === "PAYOUT_PAID") return this.view(r);
    if (r.payoutAttempt) return this.reconcile(session, id);
    const hash = await this.adapter.validatePayout(r, invoice);
    const send = this.store.tx(() => {
      r = this.store.get(id, session);
      if (r.payoutAttempt) return false;
      r.payoutInvoice = invoice;
      r.payoutHash = hash;
      r.payoutAttempt = randomUUID();
      r.payerStatus = "SUBMITTED";
      this.store.payment(r, "payout", hash, {
        attempt: r.payoutAttempt,
        status: "SUBMITTED",
        amount: r.payout,
      });
      this.store.save(r);
      return true;
    });
    if (!send) return this.view(this.store.get(id, session));
    try {
      const result = await this.adapter.send(r);
      return this.finishPayment(session, id, result);
    } catch {
      this.markError(
        id,
        "Payout chưa xác định. Khoản thắng được giữ; đối soát hash cũ, không gửi lại.",
      );
      return this.view(this.store.get(id, session));
    }
  }
  async reconcile(session: string, id: string) {
    const r = this.store.get(id, session);
    if (r.game === "AWAITING_STAKE") return this.checkStake(session, id);
    if (!r.payoutAttempt || r.payment === "PAYOUT_PAID") return this.view(r);
    try {
      return this.finishPayment(session, id, await this.adapter.reconcile(r));
    } catch {
      this.markError(
        id,
        "Chưa đọc được payment cũ. Giữ PAYOUT_PENDING; không tạo payment mới.",
      );
      return this.view(this.store.get(id, session));
    }
  }
  finishPayment(
    session: string,
    id: string,
    result: { status: string; fee: string },
  ) {
    return this.store.tx(() => {
      const r = this.store.get(id, session);
      if (r.payment === "PAYOUT_PAID") return this.view(r);
      r.payerStatus = result.status;
      r.fee = result.fee;
      if (result.status === "Success") {
        if (this.mode === "mock")
          this.store.balanceSet(
            session,
            this.store.balance(session) + BigInt(r.payout),
          );
        this.store.ledger(
          `${id}:payout`,
          -BigInt(r.payout) - BigInt(result.fee),
        );
        r.payment = "PAYOUT_PAID";
        r.reserve = "0";
        r.error = "";
      } else
        r.error =
          result.status === "Failed"
            ? "HOUSE báo Failed. Khoản thưởng vẫn được giữ; owner cần đối soát và xử lý, không tự gửi lại."
            : "Payment đang xử lý; kiểm tra lại hash cũ.";
      this.store.payment(r, "payout", r.payoutHash, {
        attempt: r.payoutAttempt,
        ...result,
      });
      this.store.save(r);
      return this.view(r);
    });
  }
  reset(session: string) {
    if (this.mode !== "mock") throw new Error("Reset chỉ dành cho demo.");
    this.store.tx(() => {
      for (const r of this.store.list(session)) {
        if (r.payment === "PAYOUT_PENDING")
          throw new Error("Hoàn tất payout đang chờ trước khi reset.");
        if (["COMMITTED", "AWAITING_STAKE", "PLAYING"].includes(r.game)) {
          r.game = "CANCELLED";
          r.reserve = "0";
          this.store.save(r);
        }
      }
      this.store.balanceSet(session, parseCkb("1000"));
    });
  }
}
