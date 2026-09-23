export declare interface Blake160 {
    (data: Uint8Array | string): Uint8Array;
    (data: Uint8Array | string, encode: 'binary'): Uint8Array;
    (data: Uint8Array | string, encode: 'hex'): string;
    (data: Uint8Array | string, encode: 'binary' | 'hex'): Uint8Array | string;
}
export declare const blake160: Blake160;
export default blake160;
