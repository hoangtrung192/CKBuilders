"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readInt64 = exports.readInt32 = exports.readInt16 = exports.readInt8 = exports.writeInt64 = exports.writeInt32 = exports.writeInt16 = exports.writeInt8 = exports.readUInt64 = exports.readUInt32 = exports.readUInt16 = exports.readUInt8 = exports.writeUInt64 = exports.writeUInt32 = exports.writeUInt16 = exports.writeUInt8 = exports.compare = exports.fromBase64 = exports.toBase64 = exports.fromHex = exports.toHex = exports.concat = exports.fromUtf8 = exports.toUtf8 = void 0;
function toUtf8(bytes) {
    return Buffer.from(bytes || []).toString();
}
exports.toUtf8 = toUtf8;
function fromUtf8(s) {
    return Uint8Array.from(Buffer.from(s || "", "utf8"));
}
exports.fromUtf8 = fromUtf8;
function concat(arrays) {
    return Uint8Array.from(Buffer.concat(arrays));
}
exports.concat = concat;
function toHex(bytes) {
    return Buffer.from(bytes || []).toString("hex");
}
exports.toHex = toHex;
function fromHex(hexString) {
    return Uint8Array.from(Buffer.from(hexString || "", "hex"));
}
exports.fromHex = fromHex;
function toBase64(bytes) {
    return Buffer.from(bytes).toString("base64");
}
exports.toBase64 = toBase64;
function fromBase64(base64) {
    return Uint8Array.from(Buffer.from(base64 || "", "base64"));
}
exports.fromBase64 = fromBase64;
function compare(v1, v2) {
    return Buffer.from(v1).compare(Buffer.from(v2));
}
exports.compare = compare;
function checkReadOffset(buffer, offset, byteLength) {
    // Direct Uint8Array indexing does not validate these values, while Node.js
    // Buffer throws.
    if (!Number.isInteger(offset) ||
        !Number.isInteger(byteLength) ||
        offset < 0 ||
        byteLength < 0 ||
        offset + byteLength > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
}
function writeUInt8(buffer, offset, value) {
    if (offset + 1 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    const buf = Buffer.alloc(1);
    buf.writeUInt8(value, 0);
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 1;
}
exports.writeUInt8 = writeUInt8;
function writeUInt16(buffer, offset, value, littleEndian) {
    if (offset + 2 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    littleEndian = littleEndian.toUpperCase();
    const buf = Buffer.alloc(2);
    if (littleEndian === "LE") {
        buf.writeUInt16LE(value, 0);
    }
    else {
        buf.writeUInt16BE(value, 0);
    }
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 2;
}
exports.writeUInt16 = writeUInt16;
function writeUInt32(buffer, offset, value, littleEndian) {
    if (offset + 4 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    littleEndian = littleEndian.toUpperCase();
    const buf = Buffer.alloc(4);
    if (littleEndian === "LE") {
        buf.writeUInt32LE(value, 0);
    }
    else {
        buf.writeUInt32BE(value, 0);
    }
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 4;
}
exports.writeUInt32 = writeUInt32;
function writeUInt64(buffer, offset, value, littleEndian) {
    if (offset + 8 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    littleEndian = littleEndian.toUpperCase();
    const buf = Buffer.alloc(8);
    if (value > 0xffffffffffffffffn) {
        throw new Error(`The value of "value" is out of range. It must be >= 0 and <= ${0xffffffffffffffffn}. Received ${value}`);
    }
    if (littleEndian === "LE") {
        buf.writeBigUInt64LE(value, 0);
    }
    else {
        buf.writeBigUInt64BE(value, 0);
    }
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 8;
}
exports.writeUInt64 = writeUInt64;
function readUInt8(buffer, offset) {
    checkReadOffset(buffer, offset, 1);
    return buffer[offset];
}
exports.readUInt8 = readUInt8;
function readUInt16(buffer, offset, littleEndian) {
    checkReadOffset(buffer, offset, 2);
    littleEndian = littleEndian.toUpperCase();
    // Match Node.js Buffer's implementation by expressing each byte's
    // positional value.
    return littleEndian === "LE"
        ? buffer[offset] + buffer[offset + 1] * 2 ** 8
        : buffer[offset] * 2 ** 8 + buffer[offset + 1];
}
exports.readUInt16 = readUInt16;
function readUInt32(buffer, offset, littleEndian) {
    checkReadOffset(buffer, offset, 4);
    littleEndian = littleEndian.toUpperCase();
    // Multiplication preserves the unsigned range; bitwise operators coerce
    // values to signed int32.
    return littleEndian === "LE"
        ? buffer[offset] +
            buffer[offset + 1] * 2 ** 8 +
            buffer[offset + 2] * 2 ** 16 +
            buffer[offset + 3] * 2 ** 24
        : buffer[offset] * 2 ** 24 +
            buffer[offset + 1] * 2 ** 16 +
            buffer[offset + 2] * 2 ** 8 +
            buffer[offset + 3];
}
exports.readUInt32 = readUInt32;
function readUInt64(buffer, offset, littleEndian) {
    checkReadOffset(buffer, offset, 8);
    littleEndian = littleEndian.toUpperCase();
    let lo;
    let hi;
    // As in Node.js Buffer's implementation, compose exact 32-bit halves before
    // converting to BigInt. This needs only two BigInt conversions instead of one
    // conversion and shift per byte.
    if (littleEndian === "LE") {
        lo =
            buffer[offset] +
                buffer[offset + 1] * 2 ** 8 +
                buffer[offset + 2] * 2 ** 16 +
                buffer[offset + 3] * 2 ** 24;
        hi =
            buffer[offset + 4] +
                buffer[offset + 5] * 2 ** 8 +
                buffer[offset + 6] * 2 ** 16 +
                buffer[offset + 7] * 2 ** 24;
    }
    else {
        hi =
            buffer[offset] * 2 ** 24 +
                buffer[offset + 1] * 2 ** 16 +
                buffer[offset + 2] * 2 ** 8 +
                buffer[offset + 3];
        lo =
            buffer[offset + 4] * 2 ** 24 +
                buffer[offset + 5] * 2 ** 16 +
                buffer[offset + 6] * 2 ** 8 +
                buffer[offset + 7];
    }
    return (BigInt(hi) << 32n) + BigInt(lo);
}
exports.readUInt64 = readUInt64;
function writeInt8(buffer, offset, value) {
    if (offset + 1 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    const buf = Buffer.alloc(1);
    buf.writeInt8(value, 0);
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 1;
}
exports.writeInt8 = writeInt8;
function writeInt16(buffer, offset, value, littleEndian) {
    if (offset + 2 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    littleEndian = littleEndian.toUpperCase();
    const buf = Buffer.alloc(2);
    if (littleEndian === "LE") {
        buf.writeInt16LE(value, 0);
    }
    else {
        buf.writeInt16BE(value, 0);
    }
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 2;
}
exports.writeInt16 = writeInt16;
function writeInt32(buffer, offset, value, littleEndian) {
    if (offset + 4 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    littleEndian = littleEndian.toUpperCase();
    const buf = Buffer.alloc(4);
    if (littleEndian === "LE") {
        buf.writeInt32LE(value, 0);
    }
    else {
        buf.writeInt32BE(value, 0);
    }
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 4;
}
exports.writeInt32 = writeInt32;
function writeInt64(buffer, offset, value, littleEndian) {
    if (offset + 8 > buffer.length) {
        throw new Error("Offset is outside the bounds of Uint8Array");
    }
    if (value > 0x7fffffffffffffffn || value < -0x8000000000000000n) {
        throw new Error(`The value of "value" is out of range. It must be >= ${-0x8000000000000000n} and <= ${0x7fffffffffffffffn}. Received ${value}`);
    }
    littleEndian = littleEndian.toUpperCase();
    const buf = Buffer.alloc(8);
    if (littleEndian === "LE") {
        buf.writeBigInt64LE(value, 0);
    }
    else {
        buf.writeBigInt64BE(value, 0);
    }
    buffer.set(Uint8Array.from(buf), offset);
    return offset + 8;
}
exports.writeInt64 = writeInt64;
function readInt8(buffer, offset) {
    checkReadOffset(buffer, offset, 1);
    const val = buffer[offset];
    // Convert from two's complement explicitly instead of using Node.js
    // Buffer's branchless sign-extension expression.
    return val < 0x80 ? val : val - 0x100;
}
exports.readInt8 = readInt8;
function readInt16(buffer, offset, littleEndian) {
    checkReadOffset(buffer, offset, 2);
    littleEndian = littleEndian.toUpperCase();
    const val = littleEndian === "LE"
        ? buffer[offset] + buffer[offset + 1] * 2 ** 8
        : buffer[offset] * 2 ** 8 + buffer[offset + 1];
    // Convert from two's complement explicitly instead of using Node.js
    // Buffer's branchless sign-extension expression.
    return val < 0x8000 ? val : val - 0x10000;
}
exports.readInt16 = readInt16;
function readInt32(buffer, offset, littleEndian) {
    checkReadOffset(buffer, offset, 4);
    littleEndian = littleEndian.toUpperCase();
    // Node.js Buffer's implementation shifts only the most-significant byte so
    // JavaScript sign-extends it.
    return littleEndian === "LE"
        ? buffer[offset] +
            buffer[offset + 1] * 2 ** 8 +
            buffer[offset + 2] * 2 ** 16 +
            (buffer[offset + 3] << 24)
        : (buffer[offset] << 24) +
            buffer[offset + 1] * 2 ** 16 +
            buffer[offset + 2] * 2 ** 8 +
            buffer[offset + 3];
}
exports.readInt32 = readInt32;
function readInt64(buffer, offset, littleEndian) {
    checkReadOffset(buffer, offset, 8);
    littleEndian = littleEndian.toUpperCase();
    let lo;
    let hi;
    // Node.js Buffer's implementation makes hi a signed int32. Combining signed
    // hi with unsigned lo produces the 64-bit two's-complement value without an
    // extra BigInt correction.
    if (littleEndian === "LE") {
        lo =
            buffer[offset] +
                buffer[offset + 1] * 2 ** 8 +
                buffer[offset + 2] * 2 ** 16 +
                buffer[offset + 3] * 2 ** 24;
        hi =
            buffer[offset + 4] +
                buffer[offset + 5] * 2 ** 8 +
                buffer[offset + 6] * 2 ** 16 +
                (buffer[offset + 7] << 24);
    }
    else {
        hi =
            (buffer[offset] << 24) +
                buffer[offset + 1] * 2 ** 16 +
                buffer[offset + 2] * 2 ** 8 +
                buffer[offset + 3];
        lo =
            buffer[offset + 4] * 2 ** 24 +
                buffer[offset + 5] * 2 ** 16 +
                buffer[offset + 6] * 2 ** 8 +
                buffer[offset + 7];
    }
    return (BigInt(hi) << 32n) + BigInt(lo);
}
exports.readInt64 = readInt64;
