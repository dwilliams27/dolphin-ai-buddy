import * as path from 'path';
import { extractStringsFromBuffer, hexDump } from './utils';
const dolphinMemory = require(path.join(__dirname, '../build/Release/dolphin_memory.node'));

export class DolphinMemoryEngine {
  private accessor: any;
  
  constructor() {
    this.accessor = new dolphinMemory.MemoryAccessor();
  }
  
  hook(): number {
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

  readAtOffset(baseAddress: bigint | number, offset: number, size: number): Buffer {
    return this.accessor.readAtOffset(baseAddress, offset, size);
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
}

async function init() {
  console.log("Initializing Dolphin Memory Engine...");
  
  const engine = new DolphinMemoryEngine();
  const startAddress = engine.hook();
  
  console.log("Start address:", startAddress.toString(16));
  
  const data = engine.readAtOffset(startAddress, 0x0, 256);
  console.log("Memory dump:");
  console.log(hexDump(data));

  const strings = extractStringsFromBuffer(data);
  console.log("Extracted strings:");
  strings.forEach(str => {
    console.log(str);
  });
}

init().catch(console.error);

export default DolphinMemoryEngine;
