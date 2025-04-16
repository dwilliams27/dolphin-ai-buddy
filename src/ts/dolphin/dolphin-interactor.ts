import { existsSync, mkdirSync, writeFileSync } from 'fs';
import native from "@/ts/native-module.js";
import { generateTimestampedFilename, SCREENSHOTS_DIR } from '@/ts/utils.js';

export function captureDolphinOffscreen(pid: number, gameID: string) {
  const imageData = native.dolphinScreenGrab.captureWindowByPID(pid, gameID);
  
  if (!imageData || !imageData.buffer || imageData.buffer.length === 0) {
    return new Error('Failed to capture window content');
  }

  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filename = generateTimestampedFilename('screenshot', 'png');
  const outputPath = `${SCREENSHOTS_DIR}/${filename}`;
  writeFileSync(outputPath, imageData.buffer);
  console.error(`Screenshot saved to: ${outputPath}`);

  return filename;
}
