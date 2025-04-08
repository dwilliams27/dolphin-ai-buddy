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

  readAtOffset(baseAddress: bigint | number, offset: number, size: number): Buffer {
    return this.accessor.readAtOffset(baseAddress, offset, size);
  }

  writeAtOffset(baseAddress: bigint | number, offset: number, buffer: Buffer, size: number): boolean {
    return this.accessor.readAtOffset(baseAddress, offset, size);
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
