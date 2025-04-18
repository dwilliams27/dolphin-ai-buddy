import { stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export const SCREENSHOTS_DIR = `${path.dirname(fileURLToPath(import.meta.url))}/screenshots`;

export function hexDump(buffer: Buffer): string {
  let result = '';
  const lineWidth = 16;
  
  for (let i = 0; i < buffer.length; i += lineWidth) {
    const addrStr = i.toString(16).padStart(4, '0');

    const lineData = buffer.slice(i, i + lineWidth);
    const hexPart = Array.from(lineData)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');

    const asciiPart = Array.from(lineData)
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
      .join('');
      
    result += `${addrStr}: ${hexPart.padEnd(lineWidth * 3)}  ${asciiPart}\n`;
  }
  
  return result;
}

export function extractStringsFromBuffer(buffer: Buffer): string[] {
  const strings = [];
  let currentString = '';
  
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    
    // Printable ASCII
    if (byte >= 32 && byte <= 126) {
      currentString += String.fromCharCode(byte);
    } else {
      // End of string
      if (currentString.length >= 4) { // Only consider strings of 4+ chars
        strings.push(currentString);
      }
      currentString = '';
    }
  }
  
  // Don't forget the last string
  if (currentString.length >= 4) {
    strings.push(currentString);
  }
  
  return strings;
}

export function hexToBytes(hexString: string) {
  // Remove '0x' prefix if present
  if (hexString.startsWith('0x') || hexString.startsWith('0X')) {
    hexString = hexString.slice(2);
  }
  
  // Validate the hex string
  if (!/^[0-9A-Fa-f]+$/.test(hexString)) {
    throw new Error('Invalid hexadecimal string');
  }
  
  // Convert hex to decimal
  return parseInt(hexString, 16);
}

export function generateTimestampedFilename(prefix: string, extension: string): string {
  const now = new Date();
  
  // Format: HH-MM-SS
  const timestamp = String(now.getHours()).padStart(2, '0') + '-' +
    String(now.getMinutes()).padStart(2, '0') + '-' +
    String(now.getSeconds()).padStart(2, '0');
  
  return `${prefix}_${timestamp}.${extension}`;
}

export async function isPngFile(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return false;
    
    return path.extname(filePath).toLowerCase() === '.png';
  } catch (error) {
    return false;
  }
}

export function getKeyCode(key: string): number {
  const keyCodes: Record<string, number> = {
    '~': 50,
    '1': 18,
    'F1': 122,
    'F2': 120,
    'F3': 99,
    'F4': 118,
    'F5': 96,
    'F6': 97,
    'F7': 98,
    'F8': 100,
    'F9': 101,
    'F10': 109,
    'F11': 103,
    'F12': 111,
  };
  
  return keyCodes[key] || 0;
}
