import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, hashCkb, log } from "@ckb-js-std/core";

const JS_VM_ARGS_LENGTH = 35;
const HASH_LENGTH = 32;
const TOTAL_ARGS_LENGTH = JS_VM_ARGS_LENGTH + HASH_LENGTH * 2;

const ERROR_INVALID_ARGS = 10;
const ERROR_INVALID_WITNESS = 11;
const ERROR_WRONG_SECRET = 12;
const ERROR_WRONG_RECIPIENT = 13;
const ERROR_INVALID_INPUTS = 14;
const ERROR_INSUFFICIENT_PAYMENT = 15;

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return (
    a.length === b.length &&
    a.every((byte, index) => byte === b[index])
  );
}

function main(): number {
  log.setLevel(log.LogLevel.Debug);

  const script = HighLevel.loadScript();

  if (script.args.byteLength !== TOTAL_ARGS_LENGTH) {
    log.debug("Invalid vault args length");
    return ERROR_INVALID_ARGS;
  }

  const vaultArgs = script.args.slice(JS_VM_ARGS_LENGTH);

  const secretHash = new Uint8Array(
    vaultArgs.slice(0, HASH_LENGTH),
  );

  const recipientLockHash = new Uint8Array(
    vaultArgs.slice(HASH_LENGTH, HASH_LENGTH * 2),
  );

  let secret: ArrayBuffer;

  try {
    const witness = HighLevel.loadWitnessArgs(
      0,
      bindings.SOURCE_GROUP_INPUT,
    );

    secret = witness.lock ?? new ArrayBuffer(0);
  } catch {
    log.debug("Missing or malformed witness");
    return ERROR_INVALID_WITNESS;
  }

  if (secret.byteLength === 0) {
    log.debug("Secret must not be empty");
    return ERROR_INVALID_WITNESS;
  }

  if (!equalBytes(new Uint8Array(hashCkb(secret)), secretHash)) {
    log.debug("Wrong secret");
    return ERROR_WRONG_SECRET;
  }

  const currentLockHash = new Uint8Array(
    HighLevel.loadScriptHash(),
  );

  if (equalBytes(currentLockHash, recipientLockHash)) {
    log.debug("Recipient lock must differ from vault lock");
    return ERROR_INVALID_ARGS;
  }

  let inputCount = 0;

  const inputLocks = new HighLevel.QueryIter(
    HighLevel.loadCellLockHash,
    bindings.SOURCE_INPUT,
  );

  for (const lockHash of inputLocks) {
    const expectedLockHash =
      inputCount === 0 ? currentLockHash : recipientLockHash;

    if (!equalBytes(new Uint8Array(lockHash), expectedLockHash)) {
      log.debug("Invalid input layout");
      return ERROR_INVALID_INPUTS;
    }

    inputCount += 1;
  }

  if (inputCount === 0) {
    return ERROR_INVALID_INPUTS;
  }

  let outputLockHash: Uint8Array;

  try {
    outputLockHash = new Uint8Array(
      HighLevel.loadCellLockHash(0, bindings.SOURCE_OUTPUT),
    );
  } catch {
    log.debug("Cannot read recipient output");
    return ERROR_WRONG_RECIPIENT;
  }

  if (!equalBytes(outputLockHash, recipientLockHash)) {
    log.debug("Wrong recipient");
    return ERROR_WRONG_RECIPIENT;
  }

  const vaultCapacity = HighLevel.loadCellCapacity(
    0,
    bindings.SOURCE_INPUT,
  );

  const recipientCapacity = HighLevel.loadCellCapacity(
    0,
    bindings.SOURCE_OUTPUT,
  );

  if (recipientCapacity < vaultCapacity) {
    log.debug("Recipient receives less than vault capacity");
    return ERROR_INSUFFICIENT_PAYMENT;
  }

  log.debug("Vault unlock conditions passed");
  return 0;
}

bindings.exit(main());