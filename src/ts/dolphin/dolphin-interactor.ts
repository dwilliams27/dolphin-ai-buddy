import { existsSync, mkdirSync, writeFileSync } from 'fs';
import native from "@/ts/native-module.js";
import { generateTimestampedFilename } from '@/ts/utils.js';
import { fileURLToPath } from 'url';
import path from 'path';

export function captureDolphinOffscreen(pid: number, gameID: string) {
  const imageData = native.dolphinScreenGrab.captureWindowByPID(pid, gameID);
  
  if (!imageData || !imageData.buffer || imageData.buffer.length === 0) {
    return new Error('Failed to capture window content');
  }

  const screenshotsDir = `${path.dirname(fileURLToPath(import.meta.url))}/screenshots`;
  if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });
  const filename = generateTimestampedFilename('screenshot', 'png');
  const outputPath = `${screenshotsDir}/${filename}`;
  writeFileSync(outputPath, imageData.buffer);
  console.error(`Screenshot saved to: ${outputPath}`);

  return filename;
}
