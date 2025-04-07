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
