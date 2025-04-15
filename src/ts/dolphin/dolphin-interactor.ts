import { writeFileSync } from 'fs';
import native from "@/ts/native-module.js";

export function captureDolphinOffscreen(outputPath: string, pid: number) {
  return new Promise((resolve, reject) => {
    try {
      const imageData = native.dolphinScreenGrab.captureWindowByPID(pid);
      
      if (!imageData || !imageData.buffer || imageData.buffer.length === 0) {
        reject(new Error('Failed to capture window content'));
        return;
      }

      writeFileSync(outputPath, imageData.buffer);
      console.log(`Screenshot saved to: ${outputPath}`);
      resolve(outputPath);
    } catch (error) {
      reject(error);
    }
  });
}
