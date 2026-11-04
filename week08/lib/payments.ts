import {
  FiberRpcClient,
  scriptToAddress,
  type CkbInvoice,
  type HexString,
} from "@fiber-pay/sdk";
import { parseCkb } from "./money";
import type { Round } from "./store";
import { publicKey } from "./public-key";
export const hex = (n: bigint): HexString => `0x${n.toString(16)}`;
export interface PaymentAdapter {
  createStake(r: Round): Promise<string>;
  recoverStake(r: Round): Promise<string>;
  stakeStatus(r: Round): Promise<string>;
  validatePayout(r: Round, invoice: string): Promise<string>;
  send(r: Round): Promise<{ status: string; fee: string }>;
  reconcile(r: Round): Promise<{ status: string; fee: string }>;
}
export class MockPaymentAdapter implements PaymentAdapter {
  async createStake(r: Round) {
    return `demo:${r.stakeHash}`;
  }
  async recoverStake(r: Round) {
    return this.createStake(r);
  }
  async stakeStatus() {
    return "Paid";
  }
  async validatePayout(r: Round) {
    return `demo-payout:${r.id}`;
  }
  async send() {
    return { status: "Success", fee: "0" };
  }
  async reconcile() {
    return { status: "Success", fee: "0" };
  }
}
export function validateInvoice(
  i: CkbInvoice,
  amount: string,
  recipient?: string,
  now = Date.now(),
) {
  if (i.currency !== "Fibt" || !i.amount || BigInt(i.amount) !== BigInt(amount))
    throw new Error("Invoice phải là CKB Testnet, đúng số tiền.");
  if (i.data.attrs.some((a) => "udt_script" in a))
    throw new Error("Không chấp nhận UDT.");
  const expiry = i.data.attrs.find((a) => "expiry_time" in a);
  if (
    !expiry ||
    !("expiry_time" in expiry) ||
    BigInt(i.data.timestamp) + BigInt(expiry.expiry_time) * 1000n <= BigInt(now)
  )
    throw new Error("Invoice hết hạn hoặc thiếu expiry.");
  const payee = i.data.attrs.find((a) => "payee_public_key" in a);
  if (
    recipient &&
    (!payee ||
      !("payee_public_key" in payee) ||
      publicKey(payee.payee_public_key) !== publicKey(recipient))
  )
    throw new Error("Invoice sai người nhận đã gắn với ván.");
  if (!/^0x[0-9a-f]{64}$/i.test(i.data.payment_hash))
    throw new Error("Payment hash không hợp lệ.");
}
export class FiberPaymentAdapter implements PaymentAdapter {
  get client(): FiberRpcClient {
    if (!process.env.FIBER_RPC_URL)
      throw new Error(
        "Thiếu FIBER_RPC_URL: cấu hình HOUSE node Testnet trong .env.local.",
      );
    return new FiberRpcClient({
      url: process.env.FIBER_RPC_URL,
      timeout: 10000,
      biscuitToken: process.env.FIBER_RPC_TOKEN || undefined,
    });
  }
  async createStake(r: Round) {
    await this.readiness();
    const result = await this.client.newInvoice({
      amount: hex(BigInt(r.stake)),
      currency: "Fibt",
      description: `Fiber Mines ${r.id}`,
      payment_preimage: r.stakePreimage as HexString,
      hash_algorithm: "sha256",
      expiry: "0x384",
    });
    validateInvoice(result.invoice, r.stake);
    if (result.invoice.data.payment_hash !== r.stakeHash)
      throw new Error("HOUSE trả hash không khớp.");
    return result.invoice_address;
  }
  async createLiquidityInvoice(amountCkb: string) {
    const amount = parseCkb(amountCkb);
    if (amount <= 0n) throw new Error("Enter a positive CKB amount.");
    await this.readiness();
    const result = await this.client.newInvoice({
      amount: hex(amount),
      currency: "Fibt",
      description: "Fiber Mines HOUSE liquidity",
      expiry: "0xe10",
    });
    validateInvoice(result.invoice, amount.toString());
    return result.invoice_address;
  }
  async recoverStake(r: Round) {
    const existing = await this.client.getInvoice({
      payment_hash: r.stakeHash as HexString,
    });
    if (existing.invoice.data.payment_hash !== r.stakeHash)
      throw new Error("HOUSE trả hash không khớp.");
    // Recovery must still be possible when an already-paid invoice has expired.
    validateInvoice(
      existing.invoice,
      r.stake,
      undefined,
      Math.min(Date.now(), r.expires - 1),
    );
    return existing.invoice_address;
  }
  async stakeStatus(r: Round) {
    const result = await this.client.getInvoice({
      payment_hash: r.stakeHash as HexString,
    });
    // Paid invoices remain valid after their original expiry.
    validateInvoice(
      result.invoice,
      r.stake,
      undefined,
      Math.min(Date.now(), r.expires - 1),
    );
    if (result.invoice.data.payment_hash !== r.stakeHash)
      throw new Error("Sai stake hash.");
    return result.status;
  }
  async validatePayout(r: Round, invoice: string) {
    const result = await this.client.parseInvoice({ invoice });
    validateInvoice(result.invoice, r.payout, r.recipient);
    return result.invoice.data.payment_hash;
  }
  async send(r: Round) {
    await this.readiness();
    const result = await this.client.sendPayment({
      invoice: r.payoutInvoice,
      max_fee_amount: hex(parseCkb(process.env.FIBER_FEE_BUDGET_CKB || "0.1")),
    });
    if (result.payment_hash !== r.payoutHash)
      throw new Error("Sai payout hash.");
    return { status: result.status, fee: BigInt(result.fee).toString() };
  }
  async reconcile(r: Round) {
    const result = await this.client.getPayment({
      payment_hash: r.payoutHash as HexString,
    });
    return { status: result.status, fee: BigInt(result.fee).toString() };
  }
  async readiness() {
    if (!process.env.FIBER_HOUSE_PUBKEY)
      throw new Error(
        "Thiếu FIBER_HOUSE_PUBKEY: điền public key HOUSE trong .env.local.",
      );
    const [node, peers, channels] = await Promise.all([
      this.client.nodeInfo(),
      this.client.listPeers(),
      this.client.listChannels({}),
    ]);
    if (
      node.chain_hash !==
      "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606"
    )
      throw new Error("HOUSE không ở CKB Testnet. Từ chối thao tác.");
    if (
      publicKey(node.pubkey) !== publicKey(process.env.FIBER_HOUSE_PUBKEY || "")
    )
      throw new Error("HOUSE pubkey không khớp cấu hình.");
    const ready = channels.channels.filter(
      (c) =>
        c.enabled &&
        ["CHANNEL_READY", "ChannelReady"].includes(c.state.state_name) &&
        !c.funding_udt_type_script,
    );
    const outbound = ready.reduce(
      (a, c) => a + BigInt(c.local_balance) - BigInt(c.offered_tlc_balance),
      0n,
    );
    const inbound = ready.reduce(
      (a, c) => a + BigInt(c.remote_balance) - BigInt(c.received_tlc_balance),
      0n,
    );
    return {
      version: node.version,
      pubkey: node.pubkey,
      peers: peers.peers.length,
      channels: channels.channels.map((c) => ({
        id: c.channel_id,
        pubkey: c.pubkey,
        state: c.state.state_name,
      })),
      outbound: outbound.toString(),
      inbound: inbound.toString(),
      fundingAddress: scriptToAddress(
        node.default_funding_lock_script,
        "testnet",
      ),
    };
  }
}
