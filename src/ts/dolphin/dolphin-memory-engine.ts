import native from "@/ts/native-module.js";

// TODO
// Tool: Save memory snapshot
// Resource?: Read past memory snapshot
// Tool: "Pointer chain following" hmm
// Tool/resource: DB of known addresses for games

export class DolphinMemoryEngine {
  private static instance: DolphinMemoryEngine;
  private accessor: any;
  private emuRamStartAddress: number = 0;
  
  constructor() {
    if (DolphinMemoryEngine.instance) {
      throw new Error("DolphinMemoryEngine is a singleton class");
    }
    DolphinMemoryEngine.instance = this;
    this.accessor = new native.dolphinMemory.MemoryAccessor();
    this.emuRamStartAddress = this.hook();
    console.error("## Start address:", this.emuRamStartAddress.toString(16));
  }
  
  private hook(): number {
    return this.accessor.hook();
  }
  
  isHooked(): boolean {
    return this.accessor.isHooked();
  }

  read(offset: number, size: number): Buffer {
    return this.accessor.readAtOffset(this.emuRamStartAddress, offset, size);
  }

  write(offset: number, buffer: Buffer): boolean {
    return this.accessor.writeAtOffset(this.emuRamStartAddress, offset, buffer, buffer.length);
  }
}
