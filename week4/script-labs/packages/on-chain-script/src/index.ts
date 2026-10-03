import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, hashCkb } from "@ckb-js-std/core";

function main(): number {
  const script = HighLevel.loadScript();

  // 35 byte đầu dành cho JS VM loader.
  // Phần còn lại là hash của secret: 32 byte.
  const expectedHash = script.args.slice(35);

  if (expectedHash.byteLength !== 32) {
    console.log("Invalid secret hash length");
    return 1;
  }

  let secret: ArrayBuffer | undefined;

  try {
    secret = HighLevel.loadWitnessArgs(
      0,
      bindings.SOURCE_GROUP_INPUT,
    ).lock;
  } catch {
    console.log("Missing or invalid witness");
    return 2;
  }

  if (!secret || secret.byteLength === 0) {
    console.log("Missing secret");
    return 2;
  }

  const actualHash = new Uint8Array(hashCkb(secret));
  const expectedBytes = new Uint8Array(expectedHash);

  for (let i = 0; i < expectedBytes.length; i++) {
    if (actualHash[i] !== expectedBytes[i]) {
      console.log("Wrong secret");
      return 3;
    }
  }

  console.log("Correct secret: unlock allowed");
  return 0;
}

bindings.exit(main());