import { getStore, type Mode } from "./store";
import { Game } from "./game";
import { FiberPaymentAdapter, MockPaymentAdapter } from "./payments";
import { parseCkb } from "./money";
export function mode(): Mode {
  const value = process.env.PAYMENT_MODE || "fiber";
  if (value !== "mock" && value !== "fiber")
    throw new Error("PAYMENT_MODE phải là mock hoặc fiber.");
  return value;
}
export function game() {
  const m = mode();
  return new Game(
    getStore(m),
    m,
    m === "mock" ? new MockPaymentAdapter() : new FiberPaymentAdapter(),
    parseCkb(
      m === "mock" ? "100000" : process.env.FIBER_HOUSE_BUDGET_CKB || "0",
    ),
    m === "mock" ? 0n : parseCkb(process.env.FIBER_FEE_BUDGET_CKB || "0.1"),
  );
}
