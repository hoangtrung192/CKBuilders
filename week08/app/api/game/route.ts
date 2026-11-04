import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { game, mode } from "../../../lib/runtime";
import { FiberPaymentAdapter } from "../../../lib/payments";
import {
  bindRoundChannel,
  prepareClose,
  resultProof,
  syncSettlement,
} from "../../../lib/settlement";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function session(req: NextRequest) {
  const cookie = req.cookies.get("fiber-mines-session")?.value;
  return cookie && /^[a-f0-9]{64}$/.test(cookie)
    ? cookie
    : randomBytes(32).toString("hex");
}
function response(data: unknown, sid: string, status = 200) {
  const res = NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
  res.cookies.set("fiber-mines-session", sid, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE === "true",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
export async function GET(req: NextRequest) {
  const sid = session(req);
  try {
    if (mode() === "fiber" && !process.env.FIBER_RPC_URL) {
      return response(
        {
          ...game().state(sid),
          setupError:
            "Thiếu FIBER_RPC_URL. Cấu hình HOUSE node Testnet trong .env.local rồi restart.",
        },
        sid,
      );
    }
    return response(game().state(sid), sid);
  } catch {
    return response(
      {
        error:
          "Không đọc được cấu hình hoặc database. Kiểm tra cấu hình server.",
      },
      sid,
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  const sid = session(req);
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return response({ error: "Origin không hợp lệ." }, sid, 403);
  if (Number(req.headers.get("content-length") || 0) > 16384)
    return response({ error: "Request quá lớn." }, sid, 413);
  try {
    const raw = await req.text();
    if (raw.length > 16384) throw new Error("Request quá lớn.");
    const b = JSON.parse(raw) as Record<string, unknown>;
    const action = String(b.action || ""),
      id = String(b.id || "");
    const g = game();
    switch (action) {
      case "commit":
        g.commit(sid);
        break;
      case "start": {
        let binding;
        if (g.mode === "fiber") {
          const ready = await (g.adapter as FiberPaymentAdapter).readiness();
          if (
            BigInt(ready.outbound) < g.budget ||
            BigInt(ready.inbound) <= 0n ||
            !process.env.FIBER_PEER_ADDRESS
          )
            throw new Error(
              "Kênh HOUSE chưa đủ liquidity hai chiều hoặc thiếu peer WSS. Kiểm tra setup.",
            );
          const existing = g.store.get(id, sid);
          binding =
            existing.game === "COMMITTED"
              ? await bindRoundChannel(
                  g,
                  String(b.channelId || ""),
                  String(b.recipient || ""),
                  String(b.walletAddress || ""),
                  String(b.stake || ""),
                )
              : existing.settlement;
        }
        await g.start(
          sid,
          id,
          String(b.stake || ""),
          String(b.clientSeed || ""),
          String(b.recipient || ""),
          binding,
        );
        break;
      }
      case "reveal":
        g.reveal(sid, id, typeof b.cell === "number" ? b.cell : -1);
        break;
      case "cashout":
        g.cashout(sid, id);
        if (g.mode === "mock") await g.pay(sid, id);
        break;
      case "pay":
        await g.pay(sid, id, String(b.invoice || ""));
        break;
      case "check":
        await g.reconcile(sid, id);
        break;
      case "prepare-close":
        await prepareClose(g, sid, id);
        break;
      case "sync-settlement":
        await syncSettlement(
          g,
          sid,
          id,
          b.proofTxHash ? String(b.proofTxHash) : undefined,
        );
        break;
      case "receipt": {
        if (g.mode !== "fiber")
          throw new Error("Demo rounds have no on-chain receipt.");
        return response(resultProof(g.store.get(id, sid)), sid);
      }
      case "funding-status": {
        const txHash = String(b.txHash || "");
        if (!/^0x[0-9a-f]{64}$/i.test(txHash))
          throw new Error("Funding transaction hash is invalid.");
        const rpcUrl = process.env.CKB_RPC_URL || "https://testnet.ckbapp.dev/";
        const rpc = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "get_transaction",
            params: [txHash],
          }),
          cache: "no-store",
        });
        if (!rpc.ok) throw new Error("Could not query CKB Testnet transaction status.");
        const payload = await rpc.json();
        if (payload.error) throw new Error("CKB Testnet rejected the status query.");
        return response(
          {
            status: payload.result?.tx_status?.status || "unknown",
            reason: payload.result?.tx_status?.reason || null,
          },
          sid,
        );
      }
      case "reset":
        g.reset(sid);
        break;
      case "setup": {
        const a = new FiberPaymentAdapter();
        return response(
          {
            setup: await a.readiness(),
            peer: process.env.FIBER_PEER_ADDRESS || "",
            house: process.env.FIBER_HOUSE_PUBKEY || "",
          },
          sid,
        );
      }
      case "create-house-liquidity-invoice": {
        if (mode() !== "fiber")
          throw new Error("HOUSE liquidity invoices are available in Fiber mode only.");
        const invoice = await new FiberPaymentAdapter().createLiquidityInvoice(
          String(b.amount || ""),
        );
        return response({ invoice }, sid);
      }
      default:
        throw new Error("Thao tác không hợp lệ.");
    }
    // The seventh safe reveal locks a win inside its transaction, then pays demo.
    if (action === "reveal" && g.mode === "mock") {
      const r = g.store.get(id, sid);
      if (r.game === "WON") await g.pay(sid, id);
    }
    return response(g.state(sid), sid);
  } catch (e) {
    // Never return raw SDK/transport errors (they may contain private RPC URLs).
    const message = e instanceof Error ? e.message : "Thao tác thất bại.";
    const safe =
      !message.startsWith("Thiếu FIBER_") &&
      /https?:|biscuit|fetch|ECONN|RPC|timeout/i.test(message)
        ? "Không liên lạc được HOUSE node. Kiểm tra setup; payment chưa xác định phải được đối soát."
        : message;
    return response({ error: safe }, sid, 400);
  }
}
