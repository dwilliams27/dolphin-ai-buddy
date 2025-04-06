// @ts-nocheck

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
  readAtOffset(baseAddress: bigint, offset: number, size: number): Buffer {
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
  
  // Add other read/write methods for different types
}

async function findDoubleData() {
  console.log("Starting scan for Mario Kart: Double Dash (GM4E01)...");
  
  // Initialize the engine
  const engine = new DolphinMemoryEngine();
  
  // Hook to the process
  const hooked = engine.hook();
  console.log(`Hooked to Dolphin process: ${hooked}`);
  
  if (!hooked) {
    console.log("Failed to hook to Dolphin process. Make sure Dolphin is running.");
    return;
  }
  
  // Scan multiple memory regions
  const potentialRegions = [
    { name: "Region 1", addr: BigInt("0x11e800000") },
    { name: "Region 2", addr: BigInt("0x126840000") },
    { name: "Region 3", addr: BigInt("0x133800000") },
    { name: "Region 4", addr: BigInt("0x161000000") },
    { name: "Region 5", addr: BigInt("0x1ea000000") },
    { name: "Region 6", addr: BigInt("0x1ebee4000") },
    { name: "Region 7", addr: BigInt("0x22a72c000") },
    { name: "Region 8", addr: BigInt("0x22cc88000") },
    { name: "Region 9", addr: BigInt("0x282000000") }
  ];
  
  // Target strings to look for
  const targetStrings = [
    "GM4E01",            // Game ID
    "DOUBLE DASH",       // Part of the game title
    "MARIO KART",        // Part of the game title
    "NINTENDO",          // Nintendo copyright
    "ITEM.ARC",          // Common file in Double Dash
    "COURSE",            // Common term for tracks
    "LUIGI",             // Character name
    "MARIO",             // Character name
    "PEACH",             // Character name
    "BOWSER",            // Character name
    "YOSHI",             // Character name
    "MUSHROOM",          // Item and course name
    "STAR",              // Item name
    "SHELL",             // Item name
    "BANANA"             // Item name
  ];
  
  console.log(`Looking for strings related to Mario Kart: Double Dash...`);
  
  // Search for the target strings in all regions
  for (const region of potentialRegions) {
    console.log(`\nScanning ${region.name} at 0x${region.addr.toString(16)}...`);
    
    // Search in larger chunks to cover more memory efficiently
    const chunkSize = 16384; // 16KB chunks
    const maxOffset = 0x2000000; // Scan up to 32MB of each region
    
    for (let offset = 0; offset < maxOffset; offset += chunkSize) {
      try {
        // Read a chunk of memory
        const data = engine.readAtOffset(region.addr, offset, chunkSize);
        
        // Convert to string for easier searching
        const dataString = Buffer.from(data).toString('utf8');
        
        // Check for each target string
        for (const target of targetStrings) {
          const index = dataString.indexOf(target);
          if (index !== -1) {
            console.log(`  Found "${target}" at region offset 0x${(offset + index).toString(16)}!`);
            
            // Get context around the match
            const contextStart = Math.max(0, index - 16);
            const contextEnd = Math.min(data.length, index + target.length + 16);
            const contextData = data.slice(contextStart, contextEnd);
            
            console.log(`  Context:`);
            console.log(bufferToHexString(contextData));
            
            // Try to read more around this address to get more context
            const extendedData = engine.readAtOffset(region.addr, offset + index - 32, 128);
            console.log(`  Extended context:`);
            console.log(bufferToHexString(extendedData));
            
            // If we found the game ID, this is almost certainly the right location
            if (target === "GM4E01") {
              console.log(`\n*** FOUND GAME ID "GM4E01" ***`);
              console.log(`Region: ${region.name}`);
              console.log(`Base Address: 0x${region.addr.toString(16)}`);
              console.log(`Offset: 0x${(offset + index).toString(16)}`);
              console.log(`Absolute Address: 0x${(BigInt(region.addr) + BigInt(offset + index)).toString(16)}`);
              
              // Read a larger chunk for more comprehensive information
              const headerData = engine.readAtOffset(region.addr, offset + index - 64, 256);
              console.log(`\nHeader region data:`);
              console.log(bufferToHexString(headerData));
              
              // Try to identify some key data structures
              findDoubleDashDataStructures(engine, region.addr, offset);
            }
          }
        }
        
        // Also try binary search for the game ID bytes
        const gameIdBytes = Buffer.from("GM4E01");
        for (let i = 0; i < data.length - 6; i++) {
          let matchFound = true;
          for (let j = 0; j < 6; j++) {
            if (data[i + j] !== gameIdBytes[j]) {
              matchFound = false;
              break;
            }
          }
          
          if (matchFound) {
            console.log(`\n*** FOUND GAME ID "GM4E01" (binary match) ***`);
            console.log(`Region: ${region.name}`);
            console.log(`Base Address: 0x${region.addr.toString(16)}`);
            console.log(`Offset: 0x${(offset + i).toString(16)}`);
            console.log(`Absolute Address: 0x${(BigInt(region.addr) + BigInt(offset + i)).toString(16)}`);
            
            // Get extended context
            const extendedData = engine.readAtOffset(region.addr, offset + i - 64, 256);
            console.log(`\nContext around game ID:`);
            console.log(bufferToHexString(extendedData));
            
            // Try to identify some key data structures
            findDoubleDashDataStructures(engine, region.addr, offset);
          }
        }
        
      } catch (err) {
        // Skip errors, just continue with the next chunk
        console.log(`  Error at offset 0x${offset.toString(16)}: ${err.message}`);
      }
      
      // Log progress for large regions
      if (offset % (chunkSize * 64) === 0 && offset > 0) {
        console.log(`  Scanned up to offset 0x${offset.toString(16)}`);
      }
    }
  }
  
  console.log("\nScan completed.");
}

// Function to look for specific Double Dash data structures
function findDoubleDashDataStructures(engine, baseAddr, startOffset) {
  // Mario Kart: Double Dash has several known memory structures we can look for
  // These are examples and would need to be adjusted based on actual game data
  
  console.log("\nLooking for Double Dash specific data structures...");
  
  try {
    // Typical ranges where player data might be stored
    const playerDataOffsets = [
      0x1000, 0x2000, 0x5000, 0x10000, 0x20000, 0x50000, 0x100000
    ];
    
    for (const offset of playerDataOffsets) {
      try {
        const data = engine.readAtOffset(baseAddr, startOffset + offset, 64);
        
        // Look for patterns that might indicate player data
        // (This is hypothetical and would need to be tuned to actual game data)
        // For example, player positions, speed values, lap counts, etc.
        
        console.log(`Checking potential player data at offset 0x${(startOffset + offset).toString(16)}:`);
        console.log(bufferToHexString(data));
        
        // We could add specific pattern matching here as we learn more about 
        // Double Dash's memory layout
        
      } catch (err) {
        // Skip errors
      }
    }
  } catch (err) {
    console.log(`Error in findDoubleDashDataStructures: ${err.message}`);
  }
}

// Helper function to convert buffer to hex string with ASCII representation
function bufferToHexString(buffer) {
  let result = '';
  const lineWidth = 16;
  
  for (let i = 0; i < buffer.length; i += lineWidth) {
    // Address
    const addrStr = i.toString(16).padStart(4, '0');
    
    // Hex part
    const lineData = buffer.slice(i, i + lineWidth);
    const hexPart = Array.from(lineData)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
      
    // ASCII part
    const asciiPart = Array.from(lineData)
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
      .join('');
      
    result += `${addrStr}: ${hexPart.padEnd(lineWidth * 3)}  ${asciiPart}\n`;
  }
  
  return result;
}

// Run the scan
findDoubleData().catch(console.error);

export default DolphinMemoryEngine;
