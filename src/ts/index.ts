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

  // Test memory regions to find emulated RAM
  testMemoryRegions(): boolean {
    return this.accessor.testMemoryRegions();
  }

  // Test reading at a specific offset from a given base address
  testReadAtOffset(baseAddress: bigint, offset: number): void {
    return this.accessor.testReadAtOffset(baseAddress, offset);
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

async function testDolphinMemory() {
  console.log("Starting Dolphin memory test...");
  
  // Initialize the engine
  const engine = new DolphinMemoryEngine();
  
  // Hook to the process
  const hooked = engine.hook();
  console.log(`Hooked to Dolphin process: ${hooked}`);
  
  if (!hooked) {
    console.log("Failed to hook to Dolphin process. Make sure Dolphin is running.");
    return;
  }
  
  // Test memory regions to find candidate for emulated RAM
  console.log("\nTesting memory regions to find emulated RAM...");
  const regionsFound = engine.testMemoryRegions();
  console.log(`Memory regions test success: ${regionsFound}`);
  
  // If regions were found, test reading from specific candidate addresses
  if (regionsFound) {
    // Based on the successful read we already identified
    const baseAddress = 0x11e800000; // Use as a Number instead of BigInt
    
    console.log("\nTesting reads from the identified memory region:");
    
    // Test several offsets
    const offsets = [0x0, 0x100, 0x1000, 0x8000, 0x10000, 0x100000, 0x1000000];
    
    for (const offset of offsets) {
      console.log(`\nReading at offset 0x${offset.toString(16)}:`);
      
      try {
        // Try direct read using your existing API
        const data = engine.readBytes(baseAddress + offset, 16);
        console.log(`  Read successful: ${bufferToHexString(data)}`);
        
        // Try to interpret the data in different ways
        if (data.length >= 4) {
          // GameCube/Wii use Big Endian (BE) encoding
          const u32be = data.readUInt32BE(0);
          console.log(`  As UInt32BE (GameCube native): 0x${u32be.toString(16).padStart(8, '0')}`);
          
          // Show as little endian too for comparison
          const u32le = data.readUInt32LE(0);
          console.log(`  As UInt32LE: 0x${u32le.toString(16).padStart(8, '0')}`);
        }
      } catch (err: any) {
        console.log(`  Error reading: ${err.message}`);
      }
    }
    
    // Now try some more targeted reads at addresses that might be interesting for GameCube
    // GameCube memory mapping typically starts at 0x80000000 in the virtual address space
    console.log("\nTrying to read from potential GameCube memory mapped addresses:");
    
    // Calculate physical addresses by subtracting 0x80000000 from GameCube virtual addresses
    // This is a common mapping pattern in Dolphin
    const gcAddresses = [
      { virtual: 0x80000000, name: "Start of main RAM" },
      { virtual: 0x80003100, name: "Common game data area" },
      { virtual: 0x80000030, name: "OS info" },
      { virtual: 0x80000034, name: "Arena low" },
      { virtual: 0x80000038, name: "Arena high" }
    ];
    
    for (const gcAddr of gcAddresses) {
      // Calculate physical offset (subtract GameCube base address)
      const physOffset = gcAddr.virtual - 0x80000000;
      
      console.log(`\nReading potential GameCube address ${gcAddr.name}:`);
      console.log(`  Virtual: 0x${gcAddr.virtual.toString(16)}, Physical offset: 0x${physOffset.toString(16)}`);
      
      try {
        const data = engine.readBytes(baseAddress + physOffset, 16);
        console.log(`  Read successful: ${bufferToHexString(data)}`);
      } catch (err: any) {
        console.log(`  Error reading: ${err.message}`);
      }
    }
  }
  
  console.log("\nMemory test completed.");
}

// Helper function to convert buffer to hex string
function bufferToHexString(buffer: any) {
  return Array.from(buffer)
    .map((b: any) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

// Run the test
testDolphinMemory().catch(console.error);

export default DolphinMemoryEngine;
