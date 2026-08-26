import { createHash } from "crypto";

/** Small SHA-256 Bloom filter used to avoid repeating generated names. */
export class BloomFilter {
  private readonly bits: Uint8Array;

  constructor(private readonly size = 4096, private readonly hashes = 5) {
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  private positions(item: string): number[] {
    const digest = createHash("sha256").update(item).digest();
    const positions: number[] = [];
    for (let i = 0; i < this.hashes; i += 1) {
      const offset = (i * 4) % 28;
      const value = digest.readUInt32BE(offset);
      positions.push(value % this.size);
    }
    return positions;
  }

  add(item: string): void {
    for (const position of this.positions(item)) {
      this.bits[position >> 3] |= 1 << (position & 7);
    }
  }

  has(item: string): boolean {
    return this.positions(item).every(
      (position) => (this.bits[position >> 3] & (1 << (position & 7))) !== 0,
    );
  }
}
