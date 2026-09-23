import { type JoyIDConfig } from './dapp'

export type Hash = string
export type HexNumber = string
export type HexString = string
export type PackedSince = string

export interface Header {
  timestamp: HexNumber
  number: HexNumber
  epoch: HexNumber
  compactTarget: HexNumber
  dao: Hash
  hash: Hash
  nonce: HexNumber
  parentHash: Hash
  proposalsHash: Hash
  transactionsRoot: Hash
  extraHash: Hash
  version: HexNumber
}
export declare type HashType = 'type' | 'data' | 'data1'
export interface Script {
  codeHash: Hash
  hashType: HashType
  args: HexString
}
export interface OutPoint {
  txHash: Hash
  index: HexNumber
}
export declare type DepType = 'depGroup' | 'code'
export interface CellDep {
  outPoint: OutPoint
  depType: DepType
}
export interface Input {
  previousOutput: OutPoint
  since: PackedSince
}
export interface Output {
  capacity: HexString
  lock: Script
  type?: Script
}
export interface WitnessArgs {
  lock?: HexString
  inputType?: HexString
  outputType?: HexString
}
export interface RawTransaction {
  cellDeps: CellDep[]
  hash?: Hash
  headerDeps: Hash[]
  inputs: Input[]
  outputs: Output[]
  outputsData: HexString[]
  version: HexString
}
export interface CKBTransaction {
  cellDeps: CellDep[]
  hash?: Hash
  headerDeps: Hash[]
  inputs: Input[]
  outputs: Output[]
  outputsData: HexString[]
  version: HexNumber
  witnesses: HexString[]
}

export interface CkbTransactionRequest {
  from: string
  to: string
  amount: string
  /**
   * Optional hex-encoded data to include in the output cell's data field.
   *
   * Supports:
   *   - Hex string with 0x prefix: `"0x494e562d32303236"` (raw bytes)
   *   - UTF-8 string without prefix: `"INV-2026-0042"` (app will hex-encode)
   *
   * Use cases:
   *   - Invoice IDs for POS terminals (permanently on-chain, indexable)
   *   - Memo fields for payment traceability
   *   - IoT/device payment attestation payloads
   *
   * Maps to: `outputsData[0]` in the resulting CKB transaction.
   * Passed through the `nervos:` URI scheme as `?data=<value>`.
   *
   * Note: cell data increases minimum cell capacity by ~1 shannon per byte.
   * Keep under 256 bytes for reasonable tx fees.
   *
   * See: https://github.com/nervina-labs/joyid-sdk-js/issues/59
   */
  data?: string
}

export interface CkbDappConfig extends JoyIDConfig {
  name?: string
  logo?: string
  redirectURL?: string
  rpcURL?: string
  network?: 'mainnet' | 'testnet'
}

export interface SignCkbTxRequest extends CkbDappConfig {
  tx: CkbTransactionRequest
  signerAddress: string
  redirectURL: string
}

export interface SignCkbRawTxRequest extends CkbDappConfig {
  tx: CKBTransaction
  signerAddress: string
  redirectURL: string
  witnessIndexes?: number[]
}

export interface CotaNFTTransactionRequest {
  from: string
  to: string
  tokenKey?: string
  tokenId?: string
  tokenIndex?: string
}

export interface SignCotaNFTRequest extends CkbDappConfig {
  tx: CotaNFTTransactionRequest
  signerAddress: string
  redirectURL: string
}
