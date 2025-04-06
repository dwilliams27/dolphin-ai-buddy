import * as path from 'path';
const dolphinMemory = require(path.join(__dirname, '../build/Release/dolphin_memory.node'));

export class DolphinMemoryEngine {
  private accessor: any;
  
  constructor() {
    this.accessor = new dolphinMemory.MemoryAccessor();
  }

  detatch(): void {
    return this.accessor.detatch();
  }
  
  hook(): boolean {
    return this.accessor.hook();
  }
  
  isHooked(): boolean {
    return this.accessor.isHooked();
  }
  
  readBytes(address: number, size: number): Buffer {
    return this.accessor.readBytes(address, size);
  }
  
  writeBytes(address: number, buffer: Buffer): boolean {
    return this.accessor.writeBytes(address, buffer);
  }
  
  // Helper methods for common types
  readUInt8(address: number): number {
    const buffer = this.readBytes(address, 1);
    return buffer.readUInt8(0);
  }
  
  readUInt32(address: number): number {
    const buffer = this.readBytes(address, 4);
    // GameCube/Wii use big-endian
    return buffer.readUInt32BE(0);
  }
  
  // Add other read/write methods for different types
}

const testing = new DolphinMemoryEngine();
console.log(testing.hook());
console.log(testing.isHooked());
testing.detatch();

export default DolphinMemoryEngine;
