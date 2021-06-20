import decodeUtf8 from "extlib/js/decodeUtf8";

export class MemoryWalker {
  private readonly dataView: DataView;
  private readonly uint8Array: Uint8Array;

  constructor(readonly buffer: ArrayBuffer, private next: number = 0) {
    this.dataView = new DataView(buffer);
    this.uint8Array = new Uint8Array(buffer);
  }

  jumpTo(ptr: number): this {
    this.next = ptr;
    return this;
  }

  forkAndJump(ptr: number): MemoryWalker {
    return new MemoryWalker(this.buffer, ptr);
  }

  skip(bytes: number): this {
    this.next += bytes;
    return this;
  }

  readAndDereferencePointer(): MemoryWalker {
    return new MemoryWalker(this.buffer, this.readUInt32LE());
  }

  readSliceView(len: number): Uint8Array {
    const start = this.next;
    this.next += len;
    return new Uint8Array(this.buffer, start, len);
  }

  readSliceCopy(len: number): ArrayBuffer {
    return this.buffer.slice(this.next, (this.next += len));
  }

  readBoolean(): boolean {
    return !!this.dataView.getUint8(this.next++);
  }

  readUInt8(): number {
    return this.dataView.getUint8(this.next++);
  }

  readInt32LE(): number {
    const val = this.dataView.getInt32(this.next, true);
    this.next += 4;
    return val;
  }

  readInt32BE(): number {
    const val = this.dataView.getInt32(this.next, false);
    this.next += 4;
    return val;
  }

  readUInt32LE(): number {
    const val = this.dataView.getUint32(this.next, true);
    this.next += 4;
    return val;
  }

  readUInt32BE(): number {
    const val = this.dataView.getUint32(this.next, false);
    this.next += 4;
    return val;
  }

  readInt64LE(): bigint {
    const val = this.dataView.getBigInt64(this.next, true);
    this.next += 8;
    return val;
  }

  readUInt64LE(): bigint {
    const val = this.dataView.getBigUint64(this.next, true);
    this.next += 8;
    return val;
  }

  readDoubleLE(): number {
    const val = this.dataView.getFloat64(this.next, true);
    this.next += 8;
    return val;
  }

  readNullTerminatedString(): string {
    let end = this.next;
    while (this.uint8Array[end]) {
      end++;
    }
    const val = decodeUtf8(this.uint8Array.slice(this.next, end));
    this.next = end + 1;
    return val;
  }

  writeUInt32LE(val: number): this {
    this.dataView.setUint32(this.next, val, true);
    this.next += 4;
    return this;
  }

  writeAll(src: Uint8Array): this {
    this.uint8Array.set(src, this.next);
    this.next += src.byteLength;
    return this;
  }
}
