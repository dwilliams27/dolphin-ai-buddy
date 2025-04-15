import { writeFileSync } from 'fs';
import native from "@/ts/native-module.js";

export function captureDolphinOffscreen(outputPath: string, pid: number, gameID: string) {
  return new Promise((resolve, reject) => {
    try {
      const imageData = native.dolphinScreenGrab.captureWindowByPID(pid, gameID);
      
      if (!imageData || !imageData.buffer || imageData.buffer.length === 0) {
        reject(new Error('Failed to capture window content'));
        return;
      }

      writeFileSync(outputPath, imageData.buffer);
      console.error(`Screenshot saved to: ${outputPath}`);
      resolve(outputPath);
    } catch (error) {
      reject(error);
    }
  });
}
