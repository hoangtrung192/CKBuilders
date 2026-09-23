import { ccc } from "@ckb-ccc/ccc";

async function main() {
  const client = new ccc.ClientPublicTestnet();

  const privateKey = process.env.CKB_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("CKB_PRIVATE_KEY is not set");
  }

  const signer = new ccc.SignerCkbPrivateKey(
    client,
    privateKey
  );

  // 1. Address
  const address =
    await signer.getRecommendedAddress();

  console.log("CKB Testnet Address:");
  console.log(address);

  // 2. Balance
  const balance =
    await signer.getBalance();

  console.log("Balance:");
  console.log(
    ccc.fixedPointToString(balance),
    "CKB"
  );

  // 3. Sign message
  const message = "Hello CKBuilders!";

  const signature =
    await signer.signMessage(message);

  console.log("Message:");
  console.log(message);

  console.log("Signature:");
  console.log(signature);

  // 4. Verify
  const isValid =
    await ccc.Signer.verifyMessage(
      message,
      signature
    );

  const isFail =
    await ccc.Signer.verifyMessage(
      "Wrong message",
      signature
    );

  console.log("Valid signature:");
  console.log(isValid);

  console.log("Invalid message:");
  console.log(isFail);

  // 5. Receiver
  const receiver =
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8";

  // 6. Build transaction
  const receiverAddress =
    await ccc.Address.fromString(
      receiver,
      client
    );

  const tx =
    ccc.Transaction.from({
      outputs: [
        {
          capacity:
            ccc.fixedPointFrom("100"),

          lock:
            receiverAddress.script,
        },
      ],
    });

  // 7. Find input cells
  await tx.completeInputsByCapacity(
    signer
  );

  // 8. Complete fee/change
  await tx.completeFeeBy(
    signer
  );

  // 9. Sign
  const signedTx =
    await signer.signTransaction(tx);

  console.log(
    "Transaction signed successfully."
  );

  console.log(
    "Inputs:",
    signedTx.inputs.length
  );

  console.log(
    "Outputs:",
    signedTx.outputs.length
  );

  console.log(
    "Witnesses:",
    signedTx.witnesses.length
  );

  // 10. Broadcast
  const txHash =
    await client.sendTransaction(
      signedTx
    );

  console.log(
    "Transaction broadcast successfully."
  );

  console.log("Transaction Hash:");
  console.log(txHash);
}

main().catch(console.error);